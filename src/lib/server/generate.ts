import "server-only";
import { randomUUID } from "node:crypto";
import { getAiConfig, type LlmConfig } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/client";
import { buildSources, embedTexts, generateQuestions, judgeGrounding } from "@/lib/ai/tasks";
import { DEMO_BANK } from "@/lib/tutor/demo-textbook";
import { generateFromBank, generateRuleBased, planTypeCounts } from "@/lib/tutor/demo-generate";
import { inScope, selectContext } from "@/lib/tutor/retrieve";
import type { Chunk, Question, Quiz, QuizConfig, SourceDocument } from "@/lib/tutor/types";
import { TYPE_LABEL } from "@/lib/tutor/types";
import { dedupeQuestions, validateQuestion } from "@/lib/tutor/validate";
import { getChunks, getDocument, getQuiz, saveQuiz } from "@/lib/store/repo";
import { HttpError, type Emit } from "./http";

function scopeLabel(doc: SourceDocument, config: QuizConfig): string {
  const { chapter, pageFrom, pageTo } = config.scope;
  if (chapter) return chapter.split(/\s+[—–-]\s+/)[0];
  if (pageFrom || pageTo) return `pp. ${pageFrom ?? 1}–${pageTo ?? doc.pageCount}`;
  return "All content";
}

async function loadScoped(config: QuizConfig) {
  const doc = await getDocument(config.documentId);
  if (!doc) throw new HttpError(404, "That source document no longer exists. It may have been deleted, or temporary storage was cleared.");
  if (doc.status !== "ready") throw new HttpError(409, "That document is not ready yet. Wait for indexing to finish, or re-upload it.");
  const chunks = await getChunks(doc);
  const scoped = chunks.filter((c) => inScope(c, config.scope));
  if (scoped.length === 0)
    throw new HttpError(
      422,
      "No readable text was found in that chapter or page range, so no grounded questions can be written. Choose another chapter, widen the page range, or check the document preview.",
    );
  return { doc, chunks, scoped };
}

async function queryVectorFor(doc: SourceDocument, objective: string): Promise<Float32Array | null> {
  const emb = getAiConfig().embeddings;
  if (!emb || !doc.embedding || doc.embedding.model !== emb.model || !objective.trim()) return null;
  try {
    const [v] = await embedTexts(emb, [objective]);
    return Float32Array.from(v);
  } catch {
    return null; // fall back to keyword retrieval
  }
}

/** Rules first, then dedupe, then the optional LLM judge. Returns usable questions + warnings. */
async function checkQuestions(raw: Question[], supplied: Chunk[], llm: LlmConfig | null, emit?: Emit) {
  const warnings: string[] = [];
  const map = new Map(supplied.map((c) => [c.id, c]));
  const valid: Question[] = [];
  for (const q of raw) {
    const r = validateQuestion(q, map);
    if (r.fatal.length) warnings.push(`A ${TYPE_LABEL[q.type].toLowerCase()} question was removed: ${r.fatal[0]}`);
    else valid.push(r.question);
  }
  const { kept, dropped } = dedupeQuestions(valid);
  if (dropped) warnings.push(`${dropped} near-duplicate question(s) were removed.`);

  if (llm?.judge && kept.length) {
    emit?.({ stage: "judging", count: kept.length });
    try {
      const verdicts = await judgeGrounding(
        llm,
        kept.map((q, i) => ({
          id: `Q${i + 1}`,
          question: q.questionText,
          answer: q.type === "fill_blank" ? q.acceptedAnswers.join(" / ") : q.expectedAnswer,
          evidence: q.sourceRefs.map((r) => map.get(r.chunkId)?.text ?? r.quote).join("\n---\n").slice(0, 3000),
        })),
      );
      kept.forEach((q, i) => {
        const v = verdicts.get(`Q${i + 1}`);
        if (v && !v.supported) {
          q.groundingIssues.push(`AI evidence check: ${v.reason || "the answer key may not be supported by the cited text."}`);
          q.groundingStatus = "needs_review";
        }
      });
    } catch (err) {
      warnings.push(
        `The AI evidence check could not run${err instanceof AiError ? ` (${err.userMessage})` : ""}; rule-based checks were still applied.`,
      );
    }
  }
  return { questions: kept, warnings };
}

/** POST /api/quizzes/generate */
export async function generateQuiz(config: QuizConfig, emit: Emit, opts: { forceDemo?: boolean } = {}): Promise<Quiz> {
  const base = getAiConfig();
  // forceDemo: the teacher chose the deterministic generator after a live-model failure.
  const ai = opts.forceDemo ? { ...base, mode: "demo" as const, llm: null } : base;
  const { doc, chunks } = await loadScoped(config);
  emit({ stage: "retrieving" });
  const selection = selectContext({
    chunks,
    scope: config.scope,
    objective: config.learningObjective,
    queryVector: await queryVectorFor(doc, config.learningObjective),
  });
  const pages = [...new Set(selection.chunks.map((c) => c.pageNumber))].sort((a, b) => a - b);
  emit({ stage: "generating", mode: ai.mode, sources: selection.chunks.length, pages, retrieval: selection.retrieval });

  const quizId = randomUUID();
  let raw: Question[];
  const warnings: string[] = [];
  if (ai.llm) {
    try {
      const out = await generateQuestions(ai.llm, {
        config,
        quizId,
        plan: planTypeCounts(config.questionTypes, config.questionCount),
        sources: buildSources(selection.chunks),
      });
      raw = out.questions;
      warnings.push(...out.warnings.map((w) => `Model note: ${w}`));
    } catch (err) {
      if (err instanceof AiError) throw new HttpError(502, err.userMessage, { canUseDemo: true, kind: err.kind });
      throw err;
    }
  } else if (doc.isDemo) {
    const out = generateFromBank(config, quizId, chunks);
    raw = out.questions;
    warnings.push(...out.warnings);
  } else {
    const out = generateRuleBased(config, quizId, selection.chunks);
    raw = out.questions;
    warnings.push(...out.warnings);
  }

  emit({ stage: "validating", count: raw.length });
  const supplied = doc.isDemo && !ai.llm ? chunks.filter((c) => inScope(c, config.scope)) : selection.chunks;
  const checked = await checkQuestions(raw, supplied, ai.llm, emit);
  warnings.push(...checked.warnings);
  if (checked.questions.length < config.questionCount)
    warnings.unshift(
      `Only ${checked.questions.length} of ${config.questionCount} requested questions could be grounded in this scope. The quiz was returned short rather than padded with unsupported questions.`,
    );
  if (checked.questions.length === 0)
    throw new HttpError(422, "No grounded questions could be produced for this scope. Try different question types, another chapter, or a wider page range.", {
      warnings,
      canUseDemo: !!ai.llm,
    });

  const now = new Date().toISOString();
  const quiz: Quiz = {
    id: quizId,
    title: `${doc.title.split(/\s+[—–]\s+/)[0]} · ${scopeLabel(doc, config)}`,
    documentIds: [doc.id],
    grade: config.grade,
    subject: config.subject,
    chapterScope: config.scope,
    questionTypes: config.questionTypes,
    difficulty: config.difficulty,
    questionCount: config.questionCount,
    learningObjective: config.learningObjective,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    generator: { mode: ai.mode, model: ai.llm?.model ?? null, retrieval: selection.retrieval },
    warnings,
    questions: checked.questions,
  };
  return saveQuiz(quiz);
}

export function configFromQuiz(quiz: Quiz): QuizConfig {
  return {
    documentId: quiz.documentIds[0],
    grade: quiz.grade,
    subject: quiz.subject,
    scope: quiz.chapterScope,
    questionCount: 1,
    difficulty: quiz.difficulty,
    questionTypes: quiz.questionTypes,
    learningObjective: quiz.learningObjective,
  };
}

/** POST /api/quizzes/:id/questions/:qid/regenerate — replaces one question in place. */
export async function regenerateQuestion(quizId: string, questionId: string): Promise<Quiz> {
  const quiz = await getQuiz(quizId);
  if (!quiz) throw new HttpError(404, "Quiz not found.");
  const index = quiz.questions.findIndex((q) => q.id === questionId);
  if (index < 0) throw new HttpError(404, "Question not found in this quiz.");
  const old = quiz.questions[index];
  const ai = getAiConfig();
  const base = configFromQuiz(quiz);
  const config: QuizConfig = { ...base, questionTypes: [old.type], questionCount: 1 };
  const { doc, chunks } = await loadScoped(config);

  let raw: Question[] = [];
  let supplied: Chunk[];
  if (ai.llm) {
    const selection = selectContext({ chunks, scope: config.scope, objective: config.learningObjective });
    supplied = selection.chunks;
    try {
      raw = (
        await generateQuestions(ai.llm, {
          config,
          quizId,
          plan: { [old.type]: 1 },
          sources: buildSources(selection.chunks),
          avoid: quiz.questions.map((q) => q.questionText),
        })
      ).questions;
    } catch (err) {
      if (err instanceof AiError) throw new HttpError(502, err.userMessage);
      throw err;
    }
  } else if (doc.isDemo) {
    supplied = chunks.filter((c) => inScope(c, config.scope));
    const usedKeys = new Set(
      DEMO_BANK.filter((b) => quiz.questions.some((q) => q.questionText === b.questionText)).map((b) => b.key),
    );
    raw = generateFromBank(config, quizId, chunks, usedKeys).questions;
  } else {
    const selection = selectContext({ chunks, scope: config.scope, objective: "" });
    supplied = selection.chunks;
    const usedQuotes = new Set(quiz.questions.map((q) => q.sourceRefs[0]?.quote).filter(Boolean) as string[]);
    raw = generateRuleBased(config, quizId, selection.chunks, usedQuotes).questions;
  }
  const checked = await checkQuestions(raw, supplied, ai.llm);
  const others = quiz.questions.filter((q) => q.id !== questionId);
  const fresh = checked.questions.find((q) => dedupeQuestions([...others, q]).dropped === 0);
  if (!fresh)
    throw new HttpError(
      422,
      ai.llm
        ? "Couldn't write a different grounded question of this type. Try again, or edit the question instead."
        : "There are no more grounded demo questions of this type for this scope. Edit the question, or delete it.",
    );
  quiz.questions[index] = fresh;
  return saveQuiz(quiz);
}
