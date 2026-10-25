import { randomUUID } from "node:crypto";
import { DEMO_BANK, type BankItem } from "./demo-textbook";
import type { Chunk, Question, QuestionType, QuizConfig } from "./types";
import { TYPE_LABEL } from "./types";
import { STOPWORDS, quoteFoundIn, splitSentences, excerpt } from "./text";
import { inScope } from "./retrieve";
import { hash, planTypeCounts } from "./plan";

export { hash, planTypeCounts };

function baseQuestion(config: QuizConfig, quizId: string): Omit<Question, "type" | "questionText" | "expectedAnswer"> {
  return {
    id: randomUUID(),
    quizId,
    grade: config.grade,
    subject: config.subject,
    difficulty: config.difficulty,
    learningObjective: config.learningObjective || "recall",
    passage: null,
    options: null,
    correctOptionId: null,
    acceptedAnswers: [],
    rubric: { maxScore: 1, criteria: [] },
    sourceRefs: [],
    groundingStatus: "needs_review",
    groundingIssues: [],
    teacherEdited: false,
    teacherNote: null,
    origin: "demo_bank",
  };
}

function bankToQuestion(item: BankItem, chunk: Chunk, config: QuizConfig, quizId: string): Question {
  const q: Question = {
    ...baseQuestion(config, quizId),
    type: item.type,
    difficulty: item.difficulty,
    learningObjective: item.objective,
    questionText: item.questionText,
    expectedAnswer: item.expected,
    sourceRefs: [
      { documentId: chunk.documentId, documentTitle: chunk.documentTitle, page: chunk.pageNumber, chunkId: chunk.id, quote: item.quote },
    ],
  };
  if (item.type === "mcq") {
    q.options = item.options!.map(([id, text]) => ({ id, text }));
    q.correctOptionId = item.correct!;
  } else if (item.type === "fill_blank") {
    q.acceptedAnswers = item.accepted ?? [item.expected];
  } else {
    const criteria = item.criteria!.map((c, i) => ({ id: `c${i + 1}`, ...c }));
    q.rubric = { maxScore: criteria.reduce((s, c) => s + c.points, 0), criteria };
    if (item.type === "comprehension") q.passage = { text: excerpt(chunk.text, item.quote, 650), page: chunk.pageNumber, title: null };
  }
  return q;
}

/**
 * Demo-mode generation for the built-in reader: picks curated, source-tied items that
 * match the requested types, scope and difficulty. Returns fewer rather than padding.
 */
export function generateFromBank(config: QuizConfig, quizId: string, chunks: Chunk[], exclude: Set<string> = new Set()) {
  const scoped = chunks.filter((c) => inScope(c, config.scope));
  const objective = config.learningObjective.toLowerCase();
  const candidates = DEMO_BANK.flatMap((item) => {
    if (exclude.has(item.key)) return [];
    const chunk = scoped.find((c) => c.pageNumber === item.page && quoteFoundIn(item.quote, c.text));
    return chunk ? [{ item, chunk }] : [];
  });
  const rank = (x: { item: BankItem }) =>
    (x.item.difficulty === config.difficulty ? 0 : 2) +
    (objective && objective.includes(x.item.objective.split(" ")[0]) ? 0 : 1);
  const byType = new Map<QuestionType, typeof candidates>();
  for (const t of config.questionTypes)
    byType.set(t, candidates.filter((c) => c.item.type === t).sort((a, b) => rank(a) - rank(b)));

  const plan = planTypeCounts(config.questionTypes, config.questionCount);
  const chosen: typeof candidates = [];
  for (const t of config.questionTypes) chosen.push(...byType.get(t)!.splice(0, plan[t]));
  // Top up from other requested types if one type ran short.
  const leftovers = config.questionTypes.flatMap((t) => byType.get(t)!).sort((a, b) => rank(a) - rank(b));
  while (chosen.length < config.questionCount && leftovers.length) chosen.push(leftovers.shift()!);

  const warnings: string[] = [];
  for (const t of config.questionTypes) {
    const got = chosen.filter((c) => c.item.type === t).length;
    if (got < plan[t]) warnings.push(`Only ${got} ${TYPE_LABEL[t].toLowerCase()} question(s) are available for this scope in the demo set.`);
  }
  return {
    questions: chosen.map((c) => bankToQuestion(c.item, c.chunk, config, quizId)),
    keys: chosen.map((c) => c.item.key),
    warnings,
  };
}

/* --------------------------------------------- rule-based (uploaded PDFs, no key) */

function candidateWords(sentence: string): string[] {
  const words = sentence.match(/[\p{L}][\p{L}'’-]*/gu) ?? [];
  return words.filter((w, i) => {
    const lower = w.toLowerCase();
    if (lower.length < 4 || STOPWORDS.has(lower)) return false;
    if (i > 0 && /^\p{Lu}/u.test(w)) return false; // skip names and other proper nouns
    return true;
  });
}

/**
 * Deterministic cloze generator used in demo mode for uploaded documents: blanks a
 * content word from a real sentence (fill-in-the-blank), or asks which word completes
 * it (MCQ with distractors drawn from the same document). No model involved.
 */
export function generateRuleBased(config: QuizConfig, quizId: string, context: Chunk[], excludeQuotes: Set<string> = new Set()) {
  const warnings: string[] = [];
  const supported = config.questionTypes.filter((t) => t === "mcq" || t === "fill_blank");
  const unsupported = config.questionTypes.filter((t) => t === "short_answer" || t === "comprehension");
  if (unsupported.length)
    warnings.push(
      `${unsupported.map((t) => TYPE_LABEL[t]).join(" and ")} questions need live AI mode (set LLM_API_KEY). Demo mode generated the other types only.`,
    );
  if (supported.length === 0) return { questions: [] as Question[], warnings };

  const sentences = context.flatMap((chunk) =>
    splitSentences(chunk.text)
      .filter((s) => {
        const n = s.split(/\s+/).length;
        const [min, max] = config.difficulty === "easy" ? [5, 14] : config.difficulty === "medium" ? [7, 20] : [10, 30];
        return n >= min && n <= max && !excludeQuotes.has(s);
      })
      .map((s) => ({ s, chunk })),
  );
  const vocabulary = [...new Set(sentences.flatMap(({ s }) => candidateWords(s).map((w) => w.toLowerCase())))];
  const plan = planTypeCounts(supported, config.questionCount);
  const ordered = [...sentences].sort((a, b) => hash(a.s) - hash(b.s));
  const questions: Question[] = [];
  const usedWords = new Set<string>();

  for (const type of supported) {
    let made = 0;
    for (const { s, chunk } of ordered) {
      if (made >= plan[type]) break;
      if (questions.some((q) => q.sourceRefs[0]?.quote === s)) continue;
      const words = candidateWords(s).filter((w) => !usedWords.has(w.toLowerCase()));
      if (!words.length) continue;
      const target = words.sort((a, b) => b.length - a.length || a.localeCompare(b))[0];
      const blanked = s.replace(new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), "___");
      if (blanked === s) continue;
      const q: Question = {
        ...baseQuestion(config, quizId),
        origin: "demo_rule",
        type,
        learningObjective: "vocabulary (cloze)",
        questionText: type === "fill_blank" ? `Fill in the blank: ${blanked}` : `Which word completes the sentence? “${blanked}”`,
        expectedAnswer: target,
        sourceRefs: [{ documentId: chunk.documentId, documentTitle: chunk.documentTitle, page: chunk.pageNumber, chunkId: chunk.id, quote: s }],
      };
      if (type === "fill_blank") q.acceptedAnswers = [target];
      else {
        const distractors = vocabulary
          .filter((w) => w !== target.toLowerCase() && Math.abs(w.length - target.length) <= 3 && !s.toLowerCase().includes(w))
          .sort((a, b) => hash(a + s) - hash(b + s))
          .slice(0, 2);
        if (distractors.length < 2) continue;
        const opts = [target.toLowerCase(), ...distractors].sort((a, b) => hash(a + target) - hash(b + target));
        q.options = opts.map((text, i) => ({ id: String.fromCharCode(65 + i), text }));
        q.correctOptionId = q.options.find((o) => o.text === target.toLowerCase())!.id;
      }
      usedWords.add(target.toLowerCase());
      questions.push(q);
      made++;
    }
  }
  return { questions, warnings };
}
