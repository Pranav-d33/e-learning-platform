import type { AnswerEvaluation, AnswerInput, Question, RubricCriterion } from "./types";
import { normalizeAnswer, tokenize } from "./text";

type Eval = Omit<AnswerEvaluation, "id" | "attemptId">;

export function clampScore(score: number, max: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(max, Math.max(0, Math.round(score * 2) / 2));
}

/** Deterministic exact option-id match. Display order never affects the result. */
export function scoreMcq(q: Question, answer: AnswerInput | undefined): Eval {
  const max = q.rubric.maxScore || 1;
  const chosen = answer?.optionId ?? null;
  const correct = chosen !== null && chosen === q.correctOptionId;
  const correctText = q.options?.find((o) => o.id === q.correctOptionId)?.text ?? q.expectedAnswer;
  return {
    questionId: q.id,
    answerText: q.options?.find((o) => o.id === chosen)?.text ?? null,
    optionId: chosen,
    score: correct ? max : 0,
    maxScore: max,
    feedback: !chosen
      ? "No answer was chosen."
      : correct
        ? "Correct — well done."
        : `Not this one. The answer is “${correctText}”.`,
    matchedCriteria: [],
    missingCriteria: [],
    evaluator: "exact_option",
    reviewFlag: false,
    confidence: 1,
  };
}

/** Normalised comparison (Unicode, case, punctuation, articles) against accepted variants. */
export function scoreFillBlank(q: Question, answer: AnswerInput | undefined): Eval {
  const max = q.rubric.maxScore || 1;
  const given = answer?.text?.trim() ?? "";
  const g = normalizeAnswer(given);
  const hit = g.length > 0 && q.acceptedAnswers.some((a) => normalizeAnswer(a) === g);
  return {
    questionId: q.id,
    answerText: given || null,
    optionId: null,
    score: hit ? max : 0,
    maxScore: max,
    feedback: !given
      ? "No answer was written."
      : hit
        ? "Correct — that matches the text."
        : `Not quite. The missing word is “${q.acceptedAnswers[0] ?? q.expectedAnswer}”.`,
    matchedCriteria: [],
    missingCriteria: [],
    evaluator: "normalized_match",
    reviewFlag: false,
    confidence: 1,
  };
}

function criterionKeywords(c: RubricCriterion): string[] {
  if (c.keywords?.length) return c.keywords;
  return tokenize(c.criterion).filter((t) => t.length > 3);
}

function keywordHit(answerNorm: string, answerTokens: Set<string>, keyword: string): boolean {
  const k = normalizeAnswer(keyword);
  if (!k) return false;
  if (k.includes(" ")) return answerNorm.includes(k);
  const [stemmed] = tokenize(k, { keepStopwords: true });
  return answerTokens.has(stemmed ?? k) || answerNorm.split(" ").includes(k);
}

/**
 * Deterministic fallback for open answers when no model is configured. It checks
 * rubric keywords only, so it is labelled "demo" and flags partial answers for review.
 */
export function demoEvaluate(q: Question, answer: AnswerInput | undefined): Eval {
  const max = q.rubric.maxScore || 1;
  const given = answer?.text?.trim() ?? "";
  const base = {
    questionId: q.id,
    answerText: given || null,
    optionId: null,
    maxScore: max,
    evaluator: "demo_keyword" as const,
    confidence: null,
  };
  if (!given) {
    return {
      ...base,
      score: 0,
      feedback: "No answer was written.",
      matchedCriteria: [],
      missingCriteria: q.rubric.criteria.map((c) => c.id),
      reviewFlag: false,
    };
  }
  const norm = normalizeAnswer(given);
  const tokens = new Set(tokenize(given, { keepStopwords: true }));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const c of q.rubric.criteria) {
    (criterionKeywords(c).some((k) => keywordHit(norm, tokens, k)) ? matched : missing).push(c.id);
  }
  const score = clampScore(
    q.rubric.criteria.filter((c) => matched.includes(c.id)).reduce((s, c) => s + c.points, 0),
    max,
  );
  const missingText = q.rubric.criteria.filter((c) => missing.includes(c.id)).map((c) => c.criterion.toLowerCase());
  const feedback =
    score === max
      ? "Well done — your answer covers the key ideas."
      : score > 0
        ? `Good start. Also think about: ${missingText.join("; ")}.`
        : `Let's look at the text again. A good answer: “${q.expectedAnswer}”`;
  return { ...base, score, feedback, matchedCriteria: matched, missingCriteria: missing, reviewFlag: score > 0 && score < max };
}
