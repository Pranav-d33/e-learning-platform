import "server-only";
import { randomUUID } from "node:crypto";
import { getAiConfig } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/client";
import { evaluateAnswer } from "@/lib/ai/tasks";
import { hash } from "@/lib/tutor/plan";
import { demoEvaluate, scoreFillBlank, scoreMcq } from "@/lib/tutor/score";
import type { AnswerEvaluation, AnswerInput, Attempt, Question, Quiz, StudentQuestion } from "@/lib/tutor/types";
import { quizStartProblems } from "@/lib/tutor/validate";
import { getAttempt, getChunks, getDocument, getQuiz, saveAttempt, saveQuiz } from "@/lib/store/repo";
import { HttpError } from "./http";

/** Removes everything a student must not see before submitting: keys, rubrics, evidence. */
export function toStudentQuestion(q: Question, order?: string[]): StudentQuestion {
  const options = q.options
    ? (order ?? q.options.map((o) => o.id))
        .map((id) => q.options!.find((o) => o.id === id))
        .filter((o): o is { id: string; text: string } => !!o)
        .map((o, i) => ({ id: o.id, label: String.fromCharCode(65 + i), text: o.text }))
    : null;
  return {
    id: q.id,
    type: q.type,
    questionText: q.questionText,
    passage: q.passage ? { text: q.passage.text, title: q.passage.title } : null,
    options,
    maxScore: q.rubric.maxScore || 1,
  };
}

function studentView(quiz: Quiz, attempt: Attempt) {
  return {
    attempt: { id: attempt.id, quizId: quiz.id, startedAt: attempt.startedAt, submittedAt: attempt.submittedAt },
    quiz: { id: quiz.id, title: quiz.title, grade: quiz.grade, subject: quiz.subject, count: quiz.questions.length },
    questions: quiz.questions.map((q) => toStudentQuestion(q, attempt.optionOrder[q.id])),
  };
}

/** POST /api/quizzes/:id/attempts */
export async function startAttempt(quizId: string) {
  const quiz = await getQuiz(quizId);
  if (!quiz) throw new HttpError(404, "Quiz not found. It may have been deleted, or temporary storage was cleared.");
  const problems = quizStartProblems(quiz.questions);
  if (problems.length) throw new HttpError(409, "Fix these problems before starting the quiz.", { problems });
  if (quiz.status !== "ready") await saveQuiz({ ...quiz, status: "ready" });
  const id = randomUUID();
  const optionOrder: Record<string, string[]> = {};
  for (const q of quiz.questions)
    if (q.options) optionOrder[q.id] = q.options.map((o) => o.id).sort((a, b) => hash(id + a) - hash(id + b));
  const attempt: Attempt = {
    id,
    quizId,
    startedAt: new Date().toISOString(),
    submittedAt: null,
    optionOrder,
    answers: {},
    totalScore: 0,
    maxScore: quiz.questions.reduce((s, q) => s + (q.rubric.maxScore || 1), 0),
    evaluationStatus: "in_progress",
    evaluations: [],
  };
  await saveAttempt(attempt);
  return studentView(quiz, attempt);
}

/** GET /api/attempts/:id — resume an in-progress attempt (student view only). */
export async function getStudentAttempt(attemptId: string) {
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new HttpError(404, "This quiz attempt was not found.");
  const quiz = await getQuiz(attempt.quizId);
  if (!quiz) throw new HttpError(404, "The quiz for this attempt no longer exists.");
  return studentView(quiz, attempt);
}

async function evidenceFor(q: Question): Promise<string> {
  const parts: string[] = [];
  if (q.passage) parts.push(q.passage.text);
  for (const ref of q.sourceRefs) {
    const doc = await getDocument(ref.documentId);
    const chunk = doc ? (await getChunks(doc)).find((c) => c.id === ref.chunkId) : undefined;
    parts.push(chunk ? chunk.text : ref.quote);
  }
  return [...new Set(parts)].join("\n---\n").slice(0, 3500);
}

async function evaluateOpen(q: Question, answer: AnswerInput | undefined): Promise<Omit<AnswerEvaluation, "id" | "attemptId">> {
  const text = answer?.text?.trim() ?? "";
  const llm = getAiConfig().llm;
  if (!text || !llm) return demoEvaluate(q, answer);
  try {
    return await evaluateAnswer(llm, q, text, await evidenceFor(q));
  } catch (err) {
    console.warn("[attempts] evaluation failed", err);
    return {
      questionId: q.id,
      answerText: text,
      optionId: null,
      score: 0,
      maxScore: q.rubric.maxScore,
      feedback:
        err instanceof AiError
          ? `This answer couldn't be scored automatically (${err.userMessage}) — a teacher should review it.`
          : "This answer couldn't be scored automatically — a teacher should review it.",
      matchedCriteria: [],
      missingCriteria: [],
      evaluator: "none",
      reviewFlag: true,
      confidence: null,
    };
  }
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** POST /api/attempts/:id/submit — idempotent: resubmitting returns the stored result. */
export async function submitAttempt(attemptId: string, answers: Record<string, AnswerInput>) {
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new HttpError(404, "This quiz attempt was not found.");
  if (attempt.submittedAt) return getResults(attemptId);
  const quiz = await getQuiz(attempt.quizId);
  if (!quiz) throw new HttpError(404, "The quiz for this attempt no longer exists.");

  const evaluations = await pool(quiz.questions, 3, async (q) => {
    const a = answers[q.id];
    const e =
      q.type === "mcq"
        ? scoreMcq(q, a?.optionId && q.options?.some((o) => o.id === a.optionId) ? a : undefined)
        : q.type === "fill_blank"
          ? scoreFillBlank(q, a)
          : await evaluateOpen(q, a);
    return { ...e, id: randomUUID(), attemptId } satisfies AnswerEvaluation;
  });
  const done: Attempt = {
    ...attempt,
    answers,
    submittedAt: new Date().toISOString(),
    evaluations,
    totalScore: evaluations.reduce((s, e) => s + (e.evaluator === "none" ? 0 : e.score), 0),
    maxScore: evaluations.reduce((s, e) => s + e.maxScore, 0),
    evaluationStatus: evaluations.some((e) => e.reviewFlag || e.evaluator === "none") ? "needs_review" : "complete",
  };
  await saveAttempt(done);
  return resultsView(quiz, done);
}

function resultsView(quiz: Quiz, attempt: Attempt) {
  return {
    attempt: {
      id: attempt.id,
      quizId: attempt.quizId,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      evaluationStatus: attempt.evaluationStatus,
    },
    quiz: { id: quiz.id, title: quiz.title, grade: quiz.grade, subject: quiz.subject, generator: quiz.generator },
    items: quiz.questions.map((question) => ({
      question,
      evaluation: attempt.evaluations.find((e) => e.questionId === question.id) ?? null,
    })),
  };
}

/** GET /api/attempts/:id/results */
export async function getResults(attemptId: string) {
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new HttpError(404, "These results were not found.");
  if (!attempt.submittedAt) throw new HttpError(409, "This attempt has not been submitted yet.");
  const quiz = await getQuiz(attempt.quizId);
  if (!quiz) throw new HttpError(404, "The quiz for these results no longer exists.");
  return resultsView(quiz, attempt);
}
