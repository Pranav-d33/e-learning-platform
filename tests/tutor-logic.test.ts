import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { chunkPages, detectChapters } from "@/lib/tutor/chunk";
import { DEMO_BANK, DEMO_DOC_ID, DEMO_PAGES } from "@/lib/tutor/demo-textbook";
import { generateFromBank, generateRuleBased, planTypeCounts } from "@/lib/tutor/demo-generate";
import { extractPdf, PdfError } from "@/lib/tutor/pdf";
import { bm25Scores, decodeVector, encodeVector, inScope, selectContext } from "@/lib/tutor/retrieve";
import { demoEvaluate, scoreFillBlank, scoreMcq } from "@/lib/tutor/score";
import { cleanText, containsPhrase, normalizeAnswer, quoteFoundIn, tokenSupport } from "@/lib/tutor/text";
import type { Chunk, Question, QuizConfig } from "@/lib/tutor/types";
import { dedupeQuestions, quizStartProblems, validateQuestion } from "@/lib/tutor/validate";

const sample = (f: string) => new Uint8Array(readFileSync(path.join(process.cwd(), "public", "samples", f)));
const meta = { documentId: "doc1", documentTitle: "Reader", grade: 1, subject: "English", extractionMethod: "pdf-text-layer" as const };

function demoChunks(): Chunk[] {
  const { pages } = detectChapters(DEMO_PAGES.map((p) => ({ page: p.page, text: cleanText(p.text) })));
  return chunkPages(pages, { ...meta, documentId: DEMO_DOC_ID, extractionMethod: "seeded-demo" });
}

const config = (over: Partial<QuizConfig> = {}): QuizConfig => ({
  documentId: DEMO_DOC_ID,
  grade: 1,
  subject: "English",
  scope: { chapter: null, pageFrom: null, pageTo: null },
  questionCount: 5,
  difficulty: "easy",
  questionTypes: ["mcq", "fill_blank", "short_answer", "comprehension"],
  learningObjective: "",
  ...over,
});

describe("PDF extraction wrapper", () => {
  it("extracts per-page text from a searchable PDF", async () => {
    const out = await extractPdf(sample("sunny-steps-demo-reader.pdf"), { maxPages: 250 });
    expect(out.pageCount).toBe(7);
    expect(out.lowTextPages).toEqual([]);
    expect(out.pages[3].text).toContain("Arun had a bright red kite.");
  });
  it("reports scanned PDFs instead of returning empty text", async () => {
    await expect(extractPdf(sample("scanned-sample.pdf"), { maxPages: 250 })).rejects.toMatchObject({ code: "scanned" });
  });
  it("rejects non-PDF bytes and page-limit breaches", async () => {
    await expect(extractPdf(new TextEncoder().encode("hello"), { maxPages: 5 })).rejects.toBeInstanceOf(PdfError);
    await expect(extractPdf(sample("sunny-steps-demo-reader.pdf"), { maxPages: 3 })).rejects.toMatchObject({ code: "too_many_pages" });
  });
});

describe("chunking", () => {
  it("detects unit headings and assigns chapters to following pages", () => {
    const { pages, chapters } = detectChapters(DEMO_PAGES);
    expect(chapters.map((c) => c.title)).toEqual([
      "Unit 1 — Our Garden",
      "Unit 2 — Things That Fly",
      "Unit 3 — My Day",
      "Unit 4 — Animal Friends",
    ]);
    expect(pages.find((p) => p.page === 3)?.chapter).toBe("Unit 1 — Our Garden");
    expect(chapters[0]).toMatchObject({ pageStart: 2, pageEnd: 3 });
  });

  it("keeps page numbers and metadata on every chunk", () => {
    const chunks = demoChunks();
    expect(chunks.length).toBeGreaterThanOrEqual(7);
    for (const c of chunks) {
      expect(c.documentId).toBe(DEMO_DOC_ID);
      expect(DEMO_PAGES.find((p) => p.page === c.pageNumber)!.text.replace(/\s+/g, " ")).toContain(c.text.slice(0, 30).replace(/\s+/g, " "));
      expect(c.id).toBe(`${DEMO_DOC_ID}:c${c.chunkIndex}`);
    }
  });

  it("splits long pages with overlap and never crosses pages", () => {
    const sentence = "The quick brown fox jumps over the lazy dog near the river bank today. ";
    const pages = [
      { page: 1, text: sentence.repeat(120), chapter: null },
      { page: 2, text: "Short page.", chapter: null },
    ];
    const chunks = chunkPages(pages, meta, { targetTokens: 200, overlapTokens: 40 });
    const p1 = chunks.filter((c) => c.pageNumber === 1);
    expect(p1.length).toBeGreaterThan(3);
    expect(p1.every((c) => c.tokenEstimate <= 260)).toBe(true);
    const tail = p1[0].text.slice(-60);
    expect(p1[1].text).toContain(tail.slice(-40)); // overlap carried forward
    expect(chunks.at(-1)).toMatchObject({ pageNumber: 2, text: "Short page." });
  });
});

describe("text normalisation", () => {
  it("normalises objective answers", () => {
    expect(normalizeAnswer("  The ERASER! ")).toBe("eraser");
    expect(normalizeAnswer("“Watering”.")).toBe("watering");
    expect(normalizeAnswer("ｅｒａｓｅｒ")).toBe("eraser"); // full-width Unicode
  });
  it("finds quotes despite punctuation, line breaks and ellipses", () => {
    const src = "Down came the rain, pitter-pat,\nThe seed woke up and stretched like that!";
    expect(quoteFoundIn("Down came the rain pitter-pat The seed woke up", src)).toBe(true);
    expect(quoteFoundIn("Down came the rain … stretched like that", src)).toBe(true);
    expect(quoteFoundIn("The seed flew away", src)).toBe(false);
  });
  it("matches whole phrases, including stopwords", () => {
    expect(containsPhrase("Then leaves came out, one by one.", "one")).toBe(true);
    expect(containsPhrase("a watering can", "watering can")).toBe(true);
    expect(containsPhrase("someone", "one")).toBe(false);
  });
  it("measures token support", () => {
    expect(tokenSupport("sunflower seeds", "These are sunflower seeds")).toBe(1);
    expect(tokenSupport("mango", "These are sunflower seeds")).toBe(0);
  });
});

describe("retrieval", () => {
  const chunks = demoChunks();
  it("ranks the chunk that contains the query terms first", () => {
    const scores = bm25Scores("kite wind string", chunks);
    const best = chunks[scores.indexOf(Math.max(...scores))];
    expect(best.pageNumber).toBe(4);
  });
  it("filters by chapter and page range", () => {
    expect(chunks.filter((c) => inScope(c, { chapter: "Unit 3 — My Day", pageFrom: null, pageTo: null })).map((c) => c.pageNumber)).toEqual([5]);
    expect(chunks.filter((c) => inScope(c, { chapter: null, pageFrom: 6, pageTo: 7 })).every((c) => c.pageNumber >= 6)).toBe(true);
  });
  it("passes small scopes whole and ranks large ones", () => {
    expect(selectContext({ chunks, scope: config().scope, objective: "" }).strategy).toBe("whole_scope");
    const ranked = selectContext({ chunks, scope: config().scope, objective: "frog pond", maxTokens: 150 });
    expect(ranked.strategy).toBe("objective_ranked");
    expect(ranked.chunks[0].pageNumber).toBe(6);
  });
  it("round-trips vectors", () => {
    expect(Array.from(decodeVector(encodeVector([0.5, -1, 2])))).toEqual([0.5, -1, 2]);
  });
});

describe("seeded demo bank", () => {
  const chunks = demoChunks();
  const supplied = new Map(chunks.map((c) => [c.id, c]));

  it("every seed item has a valid key and a quote found on its page", () => {
    const { questions } = generateFromBank(config({ questionCount: DEMO_BANK.length }), "quiz", chunks);
    expect(questions.length).toBe(DEMO_BANK.length);
    for (const q of questions) {
      const r = validateQuestion(q, supplied);
      expect(r.fatal, q.questionText).toEqual([]);
      expect(r.issues, q.questionText).toEqual([]);
      expect(r.question.groundingStatus).toBe("verified");
    }
  });

  it("respects type mix, count and chapter scope", () => {
    const { questions } = generateFromBank(config({ questionCount: 4, questionTypes: ["mcq", "fill_blank"], scope: { chapter: "Unit 2 — Things That Fly", pageFrom: null, pageTo: null } }), "q", chunks);
    // Unit 2 has 2 MCQs and 1 fill-in-the-blank in the seed set: return 3, not padding.
    expect(questions.length).toBe(3);
    expect(questions.every((q) => q.sourceRefs[0].page === 4)).toBe(true);
    expect(new Set(questions.map((q) => q.type))).toEqual(new Set(["mcq", "fill_blank"]));
  });

  it("returns fewer with a warning instead of padding", () => {
    const out = generateFromBank(config({ questionCount: 6, questionTypes: ["short_answer"], scope: { chapter: "Unit 3 — My Day", pageFrom: null, pageTo: null } }), "q", chunks);
    expect(out.questions.length).toBe(1);
    expect(out.warnings.join(" ")).toMatch(/Only 1 short answer/);
  });

  it("spreads counts across types", () => {
    expect(planTypeCounts(["mcq", "fill_blank"], 5)).toMatchObject({ mcq: 3, fill_blank: 2 });
  });

  it("rule-based demo generator produces grounded cloze questions", () => {
    const docChunks = chunkPages(detectChapters(DEMO_PAGES).pages, meta);
    const out = generateRuleBased(config({ documentId: "doc1", questionCount: 4 }), "q", docChunks);
    expect(out.warnings.join(" ")).toMatch(/need live AI mode/);
    const map = new Map(docChunks.map((c) => [c.id, c]));
    expect(out.questions.length).toBe(4);
    for (const q of out.questions) expect(validateQuestion(q, map).fatal).toEqual([]);
  });
});

describe("grounding validation", () => {
  const chunks = demoChunks();
  const supplied = new Map(chunks.map((c) => [c.id, c]));
  const page4 = chunks.find((c) => c.pageNumber === 4)!;
  const mcq = (): Question => ({
    id: "q1", quizId: "z", type: "mcq", grade: 1, subject: "English", difficulty: "easy", learningObjective: "recall",
    questionText: "What colour was Arun's kite?", passage: null,
    options: [{ id: "A", text: "Red" }, { id: "B", text: "Blue" }, { id: "C", text: "Green" }],
    correctOptionId: "A", expectedAnswer: "Red", acceptedAnswers: [], rubric: { maxScore: 1, criteria: [] },
    sourceRefs: [{ documentId: DEMO_DOC_ID, documentTitle: "", page: 99, chunkId: page4.id, quote: "Arun had a bright red kite." }],
    groundingStatus: "needs_review", groundingIssues: [], teacherEdited: false, teacherNote: null, origin: "llm",
  });

  it("verifies a well-formed, supported MCQ and takes the page from chunk metadata", () => {
    const r = validateQuestion(mcq(), supplied);
    expect(r.question.groundingStatus).toBe("verified");
    expect(r.question.sourceRefs[0].page).toBe(4); // model said 99 — ignored
  });
  it("rejects MCQs with no valid key or duplicate options", () => {
    expect(validateQuestion({ ...mcq(), correctOptionId: "D" }, supplied).fatal.length).toBeGreaterThan(0);
    expect(validateQuestion({ ...mcq(), options: [{ id: "A", text: "Red" }, { id: "B", text: "red" }] }, supplied).fatal.length).toBeGreaterThan(0);
  });
  it("flags references to chunks that were not supplied and unfound quotes", () => {
    const fake = validateQuestion({ ...mcq(), sourceRefs: [{ ...mcq().sourceRefs[0], chunkId: "made-up" }] }, supplied);
    expect(fake.question.sourceRefs).toEqual([]);
    expect(fake.question.groundingStatus).toBe("needs_review");
    const badQuote = validateQuestion({ ...mcq(), sourceRefs: [{ ...mcq().sourceRefs[0], quote: "The kite was purple." }] }, supplied);
    expect(badQuote.issues.join(" ")).toMatch(/could not be found/);
  });
  it("flags unsupported answers", () => {
    const r = validateQuestion({ ...mcq(), options: [{ id: "A", text: "Purple" }, { id: "B", text: "Blue" }] }, supplied);
    expect(r.question.groundingStatus).toBe("needs_review");
  });
  it("repairs rubric totals and reports it", () => {
    const q: Question = { ...mcq(), type: "short_answer", options: null, correctOptionId: null, expectedAnswer: "A red kite", rubric: { maxScore: 5, criteria: [{ id: "c1", criterion: "Says red", points: 1 }, { id: "c2", criterion: "Says kite", points: 1 }] } };
    const r = validateQuestion(q, supplied);
    expect(r.question.rubric.maxScore).toBe(2);
    expect(r.issues.join(" ")).toMatch(/did not add up/);
  });
  it("removes near-duplicate questions", () => {
    const a = mcq();
    const b = { ...mcq(), id: "q2", questionText: "What colour was Arun's kite in the story?" };
    expect(dedupeQuestions([a, b]).kept.length).toBe(1);
  });
  it("blocks quiz start when a question lacks an answer key", () => {
    expect(quizStartProblems([{ ...mcq(), correctOptionId: null }])).toHaveLength(1);
    expect(quizStartProblems([mcq()])).toEqual([]);
  });
});

describe("scoring", () => {
  const { questions } = generateFromBank(config({ questionCount: DEMO_BANK.length }), "quiz", demoChunks());
  const byKeyText = (t: string) => questions.find((q) => q.questionText.includes(t))!;

  it("scores MCQs by option id only", () => {
    const q = byKeyText("colour was Arun");
    expect(scoreMcq(q, { optionId: "C" }).score).toBe(1);
    expect(scoreMcq(q, { optionId: "A" }).score).toBe(0);
    expect(scoreMcq(q, undefined).feedback).toMatch(/No answer/);
  });
  it("scores fill-in-the-blank with normalisation and variants", () => {
    const q = byKeyText("two pencils");
    for (const a of ["eraser", " Eraser. ", "an eraser", "RUBBER"]) expect(scoreFillBlank(q, { text: a }).score, a).toBe(1);
    expect(scoreFillBlank(q, { text: "pencil" }).score).toBe(0);
  });
  it("demo evaluator gives rubric credit and flags partial answers", () => {
    const q = byKeyText("seeds need to grow");
    expect(demoEvaluate(q, { text: "They need water, sun and time" }).score).toBe(3);
    const partial = demoEvaluate(q, { text: "water" });
    expect(partial.score).toBe(1);
    expect(partial.reviewFlag).toBe(true);
    expect(partial.evaluator).toBe("demo_keyword");
    expect(demoEvaluate(q, { text: "" }).score).toBe(0);
  });
});
