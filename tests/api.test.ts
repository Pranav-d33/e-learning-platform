import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryKV, setKV } from "@/lib/store/kv";
import { getAiConfig, publicAiStatus } from "@/lib/ai/config";
import * as documents from "@/app/api/documents/route";
import * as documentById from "@/app/api/documents/[id]/route";
import * as generate from "@/app/api/quizzes/generate/route";
import * as quizById from "@/app/api/quizzes/[id]/route";
import * as questionById from "@/app/api/quizzes/[id]/questions/[qid]/route";
import * as regenerate from "@/app/api/quizzes/[id]/questions/[qid]/regenerate/route";
import * as attempts from "@/app/api/quizzes/[id]/attempts/route";
import * as submit from "@/app/api/attempts/[id]/submit/route";
import * as results from "@/app/api/attempts/[id]/results/route";
import * as lessons from "@/app/api/early/lessons/route";
import * as lesson from "@/app/api/early/lessons/[language]/[character]/route";
import type { Quiz } from "@/lib/tutor/types";

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const json = (url: string, body: unknown, method = "POST") =>
  new NextRequest(`http://test${url}`, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function readStream(res: Response) {
  const text = await res.text();
  return text.trim().split("\n").map((l) => JSON.parse(l));
}

function upload(file: Blob, name: string) {
  const form = new FormData();
  form.append("file", new File([file], name, { type: name.endsWith(".pdf") ? "application/pdf" : "text/plain" }));
  form.append("grade", "1");
  form.append("subject", "English");
  return new Request("http://test/api/documents", { method: "POST", body: form });
}

const baseConfig = {
  documentId: "demo-reader",
  grade: 1,
  subject: "English",
  scope: { chapter: null, pageFrom: null, pageTo: null },
  questionCount: 5,
  difficulty: "easy",
  questionTypes: ["mcq", "fill_blank", "short_answer", "comprehension"],
  learningObjective: "",
};

async function makeQuiz(over: Record<string, unknown> = {}): Promise<Quiz> {
  const events = await readStream(await generate.POST(json("/api/quizzes/generate", { ...baseConfig, ...over })));
  const done = events.at(-1);
  expect(done.stage, JSON.stringify(done)).toBe("done");
  const res = await quizById.GET(new NextRequest("http://test/x"), params({ id: done.quizId }));
  return (await res.json()).quiz;
}

beforeEach(() => setKV(new MemoryKV()));

describe("mode detection", () => {
  it("runs in labelled demo mode with no API key", () => {
    const s = publicAiStatus();
    expect(s.mode).toBe("demo");
    expect(s.demoReason).toMatch(/No model API key/);
    expect(s.retrieval).toBe("bm25");
  });
  it("detects the provider from the key prefix", () => {
    vi.stubEnv("LLM_API_KEY", "gsk_test");
    expect(getAiConfig().llm?.provider).toBe("groq");
    vi.stubEnv("LLM_API_KEY", "AIzaTest");
    const c = getAiConfig();
    expect(c.llm?.provider).toBe("gemini");
    expect(c.embeddings?.model).toBe("gemini-embedding-001");
    vi.stubEnv("LLM_API_KEY", "sk-or-v1-test");
    expect(getAiConfig().llm?.provider).toBe("openrouter");
    expect(getAiConfig().embeddings).toBeNull();
  });
  it("DEMO_MODE forces demo even with a key", () => {
    vi.stubEnv("GEMINI_API_KEY", "AIzaTest");
    vi.stubEnv("DEMO_MODE", "true");
    expect(getAiConfig().mode).toBe("demo");
  });
});

describe("document upload", () => {
  it("rejects non-PDF and oversized files before processing", async () => {
    const wrong = await documents.POST(upload(new Blob(["hello"]), "notes.txt"));
    expect(wrong.status).toBe(415);
    vi.stubEnv("MAX_UPLOAD_MB", "0.001");
    const big = await documents.POST(upload(new Blob([new Uint8Array(5000)]), "big.pdf"));
    expect(big.status).toBe(413);
    expect((await big.json()).error.message).toMatch(/limit is 0.001 MB/);
  });

  it("extracts, chunks and indexes a searchable PDF, preserving pages", async () => {
    const pdf = readFileSync(path.join(process.cwd(), "public/samples/sunny-steps-demo-reader.pdf"));
    const events = await readStream(await documents.POST(upload(new Blob([pdf]), "reader.pdf")));
    expect(events.map((e) => e.stage)).toEqual(["uploaded", "extracting", "indexing", "done"]);
    const doc = events.at(-1).document;
    expect(doc).toMatchObject({ status: "ready", pageCount: 7, isDemo: false });
    expect(doc.chapters.length).toBe(4);

    const preview = await (await documentById.GET(new NextRequest(`http://test/api/documents/${doc.id}`), params({ id: doc.id }))).json();
    expect(preview.pages).toHaveLength(7);
    expect(preview.pages[3].preview).toContain("Arun had a bright red kite");
    const page = await (await documentById.GET(new NextRequest(`http://test/api/documents/${doc.id}?page=4`), params({ id: doc.id }))).json();
    expect(page.page.page).toBe(4);

    const list = await (await documents.GET()).json();
    expect(list.documents.map((d: { id: string }) => d.id)).toEqual(["demo-reader", doc.id]);

    expect((await documentById.DELETE(new NextRequest("http://test/x"), params({ id: doc.id }))).status).toBe(200);
    expect((await documentById.GET(new NextRequest("http://test/x"), params({ id: doc.id }))).status).toBe(404);
  });

  it("reports scanned PDFs with a useful error and a failed record", async () => {
    const pdf = readFileSync(path.join(process.cwd(), "public/samples/scanned-sample.pdf"));
    const events = await readStream(await documents.POST(upload(new Blob([pdf]), "scan.pdf")));
    expect(events.at(-1)).toMatchObject({ stage: "error", code: "scanned" });
    expect(events.at(-1).message).toMatch(/looks scanned/);
    const list = await (await documents.GET()).json();
    expect(list.documents[1]).toMatchObject({ status: "failed" });
  });

  it("refuses to delete the built-in demo reader", async () => {
    expect((await documentById.DELETE(new NextRequest("http://test/x"), params({ id: "demo-reader" }))).status).toBe(400);
  });
});

describe("quiz generation (demo mode)", () => {
  it("validates the configuration", async () => {
    const res = await generate.POST(json("/api/quizzes/generate", { ...baseConfig, questionTypes: [], questionCount: 50 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/at most 20|question type/);
  });

  it("generates a grounded, mixed quiz with source pages", async () => {
    const quiz = await makeQuiz();
    expect(quiz.questions).toHaveLength(5);
    expect(new Set(quiz.questions.map((q) => q.type)).size).toBe(4);
    expect(quiz.generator.mode).toBe("demo");
    for (const q of quiz.questions) {
      expect(q.sourceRefs.length).toBeGreaterThan(0);
      expect(q.sourceRefs[0].page).toBeGreaterThan(0);
      expect(q.groundingStatus).toBe("verified");
    }
  });

  it("errors clearly when the scope has no content", async () => {
    const res = await generate.POST(json("/api/quizzes/generate", { ...baseConfig, scope: { chapter: null, pageFrom: 40, pageTo: 50 } }));
    const events = await readStream(res);
    expect(events.at(-1).stage).toBe("error");
    expect(events.at(-1).message).toMatch(/No readable text/);
  });

  it("edits mark questions teacher-edited; delete and regenerate work", async () => {
    const quiz = await makeQuiz({ questionTypes: ["mcq"], questionCount: 2 });
    const [q1, q2] = quiz.questions;
    const edited = await (await questionById.PATCH(json("/x", { questionText: "Which colour was the kite?", correctOptionId: q1.options![1].id }, "PATCH"), params({ id: quiz.id, qid: q1.id }))).json();
    const e = edited.quiz.questions[0];
    expect(e).toMatchObject({ teacherEdited: true, groundingStatus: "teacher_edited", questionText: "Which colour was the kite?" });
    expect(e.groundingIssues.join(" ")).toMatch(/edited by teacher/);

    const bad = await questionById.PATCH(json("/x", { correctOptionId: "Z" }, "PATCH"), params({ id: quiz.id, qid: q1.id }));
    expect(bad.status).toBe(422);

    const regen = await (await regenerate.POST(new NextRequest("http://test/x", { method: "POST" }), params({ id: quiz.id, qid: q2.id }))).json();
    expect(regen.quiz.questions[1].id).not.toBe(q2.id);
    expect(regen.quiz.questions[1].type).toBe("mcq");

    const del = await (await questionById.DELETE(new NextRequest("http://test/x"), params({ id: quiz.id, qid: q1.id }))).json();
    expect(del.quiz.questions).toHaveLength(1);
  });
});

describe("attempts and scoring", () => {
  it("never sends answer keys to the student before submission", async () => {
    const quiz = await makeQuiz({ questionCount: 8 });
    const res = await attempts.POST(new NextRequest("http://test/x", { method: "POST" }), params({ id: quiz.id }));
    expect(res.status).toBe(201);
    const body = await res.json();
    const raw = JSON.stringify(body);
    for (const leak of ["correctOptionId", "expectedAnswer", "acceptedAnswers", "criteria", "sourceRefs", "quote", "groundingStatus"])
      expect(raw).not.toContain(leak);
    for (const q of quiz.questions.filter((x) => x.type !== "mcq")) expect(raw).not.toContain(`"${q.expectedAnswer}"`);
    expect(body.questions).toHaveLength(8);
  });

  it("scores MCQ deterministically and returns cited results", async () => {
    const quiz = await makeQuiz({ questionTypes: ["mcq", "fill_blank"], questionCount: 4 });
    const start = await (await attempts.POST(new NextRequest("http://test/x", { method: "POST" }), params({ id: quiz.id }))).json();
    const answers: Record<string, { optionId?: string; text?: string }> = {};
    quiz.questions.forEach((q, i) => {
      if (q.type === "mcq") answers[q.id] = { optionId: i === 0 ? q.correctOptionId! : q.options!.find((o) => o.id !== q.correctOptionId)!.id };
      else answers[q.id] = { text: q.acceptedAnswers[0].toUpperCase() + "." };
    });
    const out = await (await submit.POST(json("/x", { answers }), params({ id: start.attempt.id }))).json();
    const mcqs = out.items.filter((it: { question: { type: string } }) => it.question.type === "mcq");
    expect(mcqs[0].evaluation.score).toBe(1);
    expect(mcqs[1].evaluation.score).toBe(0);
    expect(out.items.filter((it: { question: { type: string } }) => it.question.type === "fill_blank").every((it: { evaluation: { score: number } }) => it.evaluation.score === 1)).toBe(true);
    expect(out.attempt.totalScore).toBe(out.attempt.maxScore - 1);
    expect(out.items[0].question.sourceRefs[0].page).toBeGreaterThan(0);

    // resubmitting is idempotent; results are retrievable
    const again = await (await submit.POST(json("/x", { answers: {} }), params({ id: start.attempt.id }))).json();
    expect(again.attempt.totalScore).toBe(out.attempt.totalScore);
    const fetched = await (await results.GET(new NextRequest("http://test/x"), params({ id: start.attempt.id }))).json();
    expect(fetched.attempt.id).toBe(start.attempt.id);
  });

  it("blocks starting a quiz that has a question without an answer key", async () => {
    const quiz = await makeQuiz({ questionTypes: ["mcq"], questionCount: 1 });
    const { getKV } = await import("@/lib/store/kv");
    await getKV().set(`quiz:${quiz.id}`, { ...quiz, questions: [{ ...quiz.questions[0], correctOptionId: null }] });
    const res = await attempts.POST(new NextRequest("http://test/x", { method: "POST" }), params({ id: quiz.id }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.problems[0]).toMatch(/no valid answer key/);
  });
});

describe("live mode with a mocked provider", () => {
  const reply = (content: string, status = 200) =>
    new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }), { status });

  it("retries once on invalid model JSON, then fails with a demo option", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    const fetchMock = vi.fn(async () => reply("not json at all"));
    vi.stubGlobal("fetch", fetchMock);
    const events = await readStream(await generate.POST(json("/api/quizzes/generate", baseConfig)));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events.at(-1)).toMatchObject({ stage: "error", canUseDemo: true });
    expect(events.at(-1).message).toMatch(/couldn't validate/);
  });

  it("maps provider outages and bad keys to safe messages", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret upstream detail", { status: 401 })));
    const events = await readStream(await generate.POST(json("/api/quizzes/generate", baseConfig)));
    expect(events.at(-1).message).toMatch(/rejected the API key/);
    expect(JSON.stringify(events)).not.toContain("secret upstream detail");
  });

  it("validates model questions, rejects unsupported sources, and scores open answers by rubric", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubEnv("GROUNDING_JUDGE", "false");
    const generated = {
      questions: [
        { type: "mcq", question_text: "What colour was Arun's kite?", options: [{ id: "A", text: "Red" }, { id: "B", text: "Blue" }, { id: "C", text: "Green" }], correct_option_id: "A", expected_answer: "Red", source_refs: [{ source_id: "S4", quote: "Arun had a bright red kite." }] },
        { type: "mcq", question_text: "What is the capital of France?", options: [{ id: "A", text: "Paris" }, { id: "B", text: "Delhi" }], correct_option_id: "A", expected_answer: "Paris", source_refs: [{ source_id: "S99", quote: "Paris is the capital" }] },
        { type: "short_answer", question_text: "Why would the kite not fly high at first?", expected_answer: "The wind was soft.", rubric: { max_score: 2, criteria: [{ criterion: "Mentions the wind", points: 1 }, { criterion: "Says it was soft or weak", points: 1 }] }, source_refs: [{ source_id: "S4", quote: "The wind was soft that day, so his kite would not fly high." }] },
      ],
      warnings: [],
    };
    const evaluation = { criteria: [{ id: "c1", met: true }, { id: "c2", met: true }, { id: "c9", met: true }], feedback: "Great job!", confidence: 0.95, review_flag: false };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return reply(JSON.stringify(body.messages[0].content.startsWith("You grade") ? evaluation : generated));
    });
    vi.stubGlobal("fetch", fetchMock);

    const quiz = await makeQuiz({ questionTypes: ["mcq", "short_answer"], questionCount: 3 });
    expect(quiz.generator).toMatchObject({ mode: "live", model: "openai/gpt-oss-120b" });
    const paris = quiz.questions.find((q) => q.questionText.includes("France"))!;
    expect(paris.groundingStatus).toBe("needs_review");
    expect(paris.sourceRefs).toEqual([]);
    expect(quiz.questions.find((q) => q.questionText.includes("colour"))!.sourceRefs[0].page).toBe(4);

    const short = quiz.questions.find((q) => q.type === "short_answer")!;
    const start = await (await attempts.POST(new NextRequest("http://test/x", { method: "POST" }), params({ id: quiz.id }))).json();
    const out = await (await submit.POST(json("/x", { answers: { [short.id]: { text: "because the wind was too gentle" } } }), params({ id: start.attempt.id }))).json();
    const ev = out.items.find((it: { question: { id: string } }) => it.question.id === short.id).evaluation;
    expect(ev).toMatchObject({ evaluator: "llm_rubric", score: 2, maxScore: 2, matchedCriteria: ["c1", "c2"] });
    expect(ev.reviewFlag).toBe(true); // model judged an unknown criterion (c9) → flagged for review
  });
});

describe("early learning API", () => {
  it("lists and returns curated lessons", async () => {
    const list = await (await lessons.GET(new NextRequest("http://test/api/early/lessons?language=hi"))).json();
    expect(list.lessons).toHaveLength(18);
    const byGlyph = await lesson.GET(new NextRequest("http://test/x"), params({ language: "hi", character: encodeURIComponent("ख") }));
    expect((await byGlyph.json()).lesson.slug).toBe("kha");
    const bad = await lessons.GET(new NextRequest("http://test/api/early/lessons?language=fr"));
    expect(bad.status).toBe(400);
  });
});
