import type { Chunk, Question } from "./types";
import { containsPhrase, excerpt, jaccard, normalizeAnswer, quoteFoundIn, tokenSupport, tokenize } from "./text";

export interface ValidationResult {
  question: Question;
  /** Problems that make the question unusable (cannot be scored) — it is rejected. */
  fatal: string[];
  /** Problems a teacher should look at — the question is kept but flagged. */
  issues: string[];
}

const BLANK = /_{2,}|\.{3,}|…|\[blank\]/i;

/**
 * Rule-based grounding and structure checks (PRD §12.2). Source pages always come
 * from chunk metadata, never from the model. Returns a corrected copy of the question.
 */
export function validateQuestion(input: Question, supplied: Map<string, Chunk>): ValidationResult {
  const q: Question = structuredClone(input);
  const fatal: string[] = [];
  const issues: string[] = [];

  // --- evidence
  const refs = [];
  for (const ref of q.sourceRefs) {
    const chunk = supplied.get(ref.chunkId);
    if (!chunk) {
      issues.push("A source reference pointed to text that was not part of the retrieved evidence, so it was removed.");
      continue;
    }
    const found = ref.quote.trim().length > 0 && quoteFoundIn(ref.quote, chunk.text);
    if (!found) issues.push(`The evidence quote could not be found on page ${chunk.pageNumber}.`);
    refs.push({
      ...ref,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      page: chunk.pageNumber,
      quote: found ? ref.quote.trim() : excerpt(chunk.text, null, 160),
    });
  }
  q.sourceRefs = refs;
  if (refs.length === 0) issues.push("No source reference supports this question.");
  const evidence = refs.map((r) => supplied.get(r.chunkId)!.text).join("\n");

  // --- answer key + type rules
  if (!q.questionText.trim()) fatal.push("Question text is empty.");

  if (q.type === "mcq") {
    const opts = q.options ?? [];
    if (opts.length < 2 || opts.length > 4) fatal.push("Multiple-choice questions need 2–4 options.");
    if (new Set(opts.map((o) => o.id)).size !== opts.length) fatal.push("Option ids are duplicated.");
    if (opts.some((o) => !o.text.trim())) fatal.push("An option is empty.");
    const texts = opts.map((o) => normalizeAnswer(o.text));
    if (new Set(texts).size !== texts.length) fatal.push("Two options have the same text.");
    const correct = opts.find((o) => o.id === q.correctOptionId);
    if (!correct) fatal.push("The answer key does not match any option.");
    else {
      q.expectedAnswer = correct.text;
      if (evidence && tokenSupport(correct.text, evidence) < 0.5)
        issues.push("The correct option is not clearly stated in the cited text.");
    }
    q.rubric = { maxScore: q.rubric.maxScore > 0 ? q.rubric.maxScore : 1, criteria: q.rubric.criteria };
  } else if (q.type === "fill_blank") {
    q.acceptedAnswers = [...new Set(q.acceptedAnswers.map((a) => a.trim()).filter(Boolean))];
    if (!q.acceptedAnswers.length && q.expectedAnswer.trim()) q.acceptedAnswers = [q.expectedAnswer.trim()];
    if (!q.acceptedAnswers.length) fatal.push("Fill-in-the-blank question has no accepted answer.");
    if (!BLANK.test(q.questionText)) issues.push("The question has no visible blank (use ___).");
    if (!q.expectedAnswer.trim()) q.expectedAnswer = q.acceptedAnswers[0] ?? "";
    if (evidence && q.acceptedAnswers.length && !q.acceptedAnswers.some((a) => containsPhrase(evidence, a)))
      issues.push("None of the accepted answers appears in the cited text.");
    if (q.acceptedAnswers.length > 4) issues.push("Many accepted variants — check the blank has one clear answer.");
    q.rubric = { maxScore: q.rubric.maxScore > 0 ? q.rubric.maxScore : 1, criteria: q.rubric.criteria };
  } else {
    if (!q.expectedAnswer.trim()) fatal.push("No expected answer was provided.");
    const criteria = q.rubric.criteria.filter((c) => c.criterion.trim() && c.points > 0);
    if (criteria.length === 0) fatal.push("The rubric has no scoring criteria.");
    const sum = criteria.reduce((s, c) => s + c.points, 0);
    if (criteria.length && sum !== q.rubric.maxScore) {
      issues.push(`Rubric points (${sum}) did not add up to the maximum score (${q.rubric.maxScore}); maximum set to ${sum}.`);
    }
    q.rubric = { maxScore: sum || 1, criteria: criteria.map((c, i) => ({ ...c, id: c.id || `c${i + 1}` })) };
    if (evidence && q.expectedAnswer && tokenSupport(q.expectedAnswer, evidence) < 0.5)
      issues.push("The expected answer is not well supported by the cited text.");
    if (q.type === "comprehension") {
      const first = refs[0] ? supplied.get(refs[0].chunkId) : undefined;
      if (!first) fatal.push("Comprehension questions need a source passage.");
      else if (!q.passage || !quoteFoundIn(q.passage.text.slice(0, 120), first.text)) {
        q.passage = { text: excerpt(first.text, refs[0].quote, 650), page: first.pageNumber, title: null };
      } else q.passage = { ...q.passage, page: first.pageNumber };
    }
  }

  q.groundingIssues = issues;
  q.groundingStatus = q.teacherEdited ? "teacher_edited" : issues.length ? "needs_review" : "verified";
  return { question: q, fatal, issues };
}

/** Drops near-identical questions (same type and ≥0.8 token overlap, or same answer + evidence). */
export function dedupeQuestions(questions: Question[]): { kept: Question[]; dropped: number } {
  const kept: Question[] = [];
  for (const q of questions) {
    const tq = tokenize(q.questionText);
    const dup = kept.some((k) => {
      const sim = jaccard(tq, tokenize(k.questionText));
      if (sim >= 0.8) return true;
      const sameAnswer = normalizeAnswer(k.expectedAnswer) === normalizeAnswer(q.expectedAnswer);
      const sameEvidence = k.sourceRefs[0]?.quote && k.sourceRefs[0]?.quote === q.sourceRefs[0]?.quote;
      return k.type === q.type && sameAnswer && !!sameEvidence && sim >= 0.4;
    });
    if (!dup) kept.push(q);
  }
  return { kept, dropped: questions.length - kept.length };
}

/** Blocking problems that must be fixed before a quiz can start (PRD §13). */
export function quizStartProblems(questions: Question[]): string[] {
  const problems: string[] = [];
  if (questions.length === 0) problems.push("The quiz has no questions.");
  questions.forEach((q, i) => {
    const n = `Question ${i + 1}`;
    if (q.type === "mcq" && !q.options?.some((o) => o.id === q.correctOptionId)) problems.push(`${n} has no valid answer key.`);
    if (q.type === "fill_blank" && q.acceptedAnswers.length === 0) problems.push(`${n} has no accepted answer.`);
    if ((q.type === "short_answer" || q.type === "comprehension") && !q.expectedAnswer.trim())
      problems.push(`${n} has no expected answer.`);
    if ((q.type === "short_answer" || q.type === "comprehension") && q.rubric.criteria.length === 0)
      problems.push(`${n} has no rubric.`);
  });
  return problems;
}
