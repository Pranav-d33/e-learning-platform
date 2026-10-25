import "server-only";
import type { z } from "zod";
import type { Question, Quiz } from "@/lib/tutor/types";
import type { QuestionPatchSchema } from "@/lib/tutor/schemas";
import { normalizeAnswer } from "@/lib/tutor/text";
import { getQuiz, saveQuiz } from "@/lib/store/repo";
import { HttpError } from "./http";

type Patch = z.infer<typeof QuestionPatchSchema>;

/**
 * PATCH /api/quizzes/:id/questions/:qid — applies a teacher edit, marks it
 * teacher-edited (never "verified"), and re-checks structure so it can still be scored.
 */
export async function updateQuestion(quizId: string, questionId: string, patch: Patch): Promise<Quiz> {
  const quiz = await getQuiz(quizId);
  if (!quiz) throw new HttpError(404, "Quiz not found.");
  const index = quiz.questions.findIndex((q) => q.id === questionId);
  if (index < 0) throw new HttpError(404, "Question not found in this quiz.");
  const q: Question = structuredClone(quiz.questions[index]);
  const problems: string[] = [];

  if (patch.questionText !== undefined) q.questionText = patch.questionText;
  if (patch.teacherNote !== undefined) q.teacherNote = patch.teacherNote || null;

  if (q.type === "mcq") {
    if (patch.options) {
      const ids = patch.options.map((o) => o.id.toUpperCase());
      if (new Set(ids).size !== ids.length) problems.push("Option letters must be unique.");
      if (new Set(patch.options.map((o) => normalizeAnswer(o.text))).size !== patch.options.length)
        problems.push("Two options have the same text.");
      q.options = patch.options.map((o) => ({ id: o.id.toUpperCase(), text: o.text }));
    }
    if (patch.correctOptionId !== undefined) q.correctOptionId = patch.correctOptionId.toUpperCase();
    const correct = q.options?.find((o) => o.id === q.correctOptionId);
    if (!correct) problems.push("Choose which option is correct.");
    else q.expectedAnswer = correct.text;
  } else if (q.type === "fill_blank") {
    if (patch.acceptedAnswers) {
      q.acceptedAnswers = [...new Set(patch.acceptedAnswers)];
      q.expectedAnswer = q.acceptedAnswers[0];
    }
  } else {
    if (patch.expectedAnswer !== undefined) q.expectedAnswer = patch.expectedAnswer;
    if (patch.rubric) {
      const criteria = patch.rubric.criteria.map((c, i) => ({ id: `c${i + 1}`, criterion: c.criterion, points: c.points }));
      q.rubric = { maxScore: criteria.reduce((s, c) => s + c.points, 0), criteria };
    }
  }
  if (problems.length) throw new HttpError(422, problems.join(" "), { problems });

  q.teacherEdited = true;
  q.groundingStatus = "teacher_edited";
  const answerChanged =
    patch.options !== undefined ||
    patch.correctOptionId !== undefined ||
    patch.acceptedAnswers !== undefined ||
    patch.expectedAnswer !== undefined ||
    patch.rubric !== undefined;
  if (answerChanged && !q.groundingIssues.includes("Answer key edited by teacher — not re-checked against the source."))
    q.groundingIssues = [...q.groundingIssues, "Answer key edited by teacher — not re-checked against the source."];
  quiz.questions[index] = q;
  return saveQuiz({ ...quiz, status: "draft" });
}

export async function deleteQuestion(quizId: string, questionId: string): Promise<Quiz> {
  const quiz = await getQuiz(quizId);
  if (!quiz) throw new HttpError(404, "Quiz not found.");
  const next = quiz.questions.filter((q) => q.id !== questionId);
  if (next.length === quiz.questions.length) throw new HttpError(404, "Question not found in this quiz.");
  return saveQuiz({ ...quiz, questions: next, status: "draft" });
}
