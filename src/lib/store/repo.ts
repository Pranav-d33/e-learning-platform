import "server-only";
import type { Attempt, Chunk, PageText, Quiz, SourceDocument } from "@/lib/tutor/types";
import { DEMO_DOC_ID, DEMO_PAGES, demoDocument } from "@/lib/tutor/demo-textbook";
import { chunkPages, detectChapters } from "@/lib/tutor/chunk";
import { cleanText } from "@/lib/tutor/text";
import { getKV } from "./kv";

/* -------------------------------------------------------------- demo reader */

let demoCache: { doc: SourceDocument; pages: PageText[]; chunks: Chunk[] } | null = null;

function demo() {
  if (demoCache) return demoCache;
  const base = demoDocument();
  const { pages, chapters } = detectChapters(DEMO_PAGES.map((p) => ({ page: p.page, text: cleanText(p.text) })));
  const chunks = chunkPages(pages, {
    documentId: base.id,
    documentTitle: base.title,
    grade: base.grade,
    subject: base.subject,
    extractionMethod: base.extractionMethod,
  });
  demoCache = { doc: { ...base, chapters, chunkCount: chunks.length }, pages, chunks };
  return demoCache;
}

/* ------------------------------------------------------------------ helpers */

const MAX_PART_BYTES = 700_000; // stays under hosted KV request limits

export function splitParts<T>(items: T[], maxBytes = MAX_PART_BYTES): T[][] {
  const parts: T[][] = [];
  let current: T[] = [];
  let size = 2;
  for (const item of items) {
    const n = JSON.stringify(item).length + 1;
    if (current.length && size + n > maxBytes) {
      parts.push(current);
      current = [];
      size = 2;
    }
    current.push(item);
    size += n;
  }
  if (current.length) parts.push(current);
  return parts;
}

async function writeParts(prefix: string, items: unknown[]): Promise<number> {
  const kv = getKV();
  const parts = splitParts(items);
  await Promise.all(parts.map((p, i) => kv.set(`${prefix}:${i}`, p)));
  return parts.length;
}

async function readParts<T>(prefix: string, count: number): Promise<T[]> {
  const kv = getKV();
  const parts = await Promise.all(Array.from({ length: count }, (_, i) => kv.get<T[]>(`${prefix}:${i}`)));
  return parts.flatMap((p) => p ?? []);
}

/* ---------------------------------------------------------------- documents */

export async function listDocuments(): Promise<SourceDocument[]> {
  const kv = getKV();
  const keys = await kv.keys("doc:");
  const docs = (await Promise.all(keys.map((k) => kv.get<SourceDocument>(k)))).filter(Boolean) as SourceDocument[];
  docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [demo().doc, ...docs];
}

export async function getDocument(id: string): Promise<SourceDocument | null> {
  if (id === DEMO_DOC_ID) return demo().doc;
  return getKV().get<SourceDocument>(`doc:${id}`);
}

export async function saveDocument(doc: SourceDocument): Promise<void> {
  if (doc.isDemo) throw new Error("The demo document is read-only");
  await getKV().set(`doc:${doc.id}`, { ...doc, updatedAt: new Date().toISOString() });
}

export async function savePagesAndChunks(doc: SourceDocument, pages: PageText[], chunks: Chunk[]) {
  const [pageParts, chunkParts] = await Promise.all([writeParts(`pages:${doc.id}`, pages), writeParts(`chunks:${doc.id}`, chunks)]);
  return { pages: pageParts, chunks: chunkParts };
}

export async function getPages(doc: SourceDocument): Promise<PageText[]> {
  if (doc.isDemo) return demo().pages;
  return readParts<PageText>(`pages:${doc.id}`, doc.parts.pages);
}

const chunkCache = new Map<string, { stamp: string; chunks: Chunk[] }>();

export async function getChunks(doc: SourceDocument): Promise<Chunk[]> {
  if (doc.isDemo) return demo().chunks;
  const hit = chunkCache.get(doc.id);
  if (hit && hit.stamp === doc.updatedAt) return hit.chunks;
  const chunks = await readParts<Chunk>(`chunks:${doc.id}`, doc.parts.chunks);
  chunkCache.set(doc.id, { stamp: doc.updatedAt, chunks });
  return chunks;
}

export async function deleteDocument(doc: SourceDocument): Promise<void> {
  if (doc.isDemo) throw new Error("The demo document is built in and cannot be deleted");
  const kv = getKV();
  const keys = [
    `doc:${doc.id}`,
    ...Array.from({ length: doc.parts.pages }, (_, i) => `pages:${doc.id}:${i}`),
    ...Array.from({ length: doc.parts.chunks }, (_, i) => `chunks:${doc.id}:${i}`),
  ];
  await kv.del(keys);
  chunkCache.delete(doc.id);
}

/* ------------------------------------------------------------------ quizzes */

export async function saveQuiz(quiz: Quiz): Promise<Quiz> {
  const next = { ...quiz, updatedAt: new Date().toISOString() };
  await getKV().set(`quiz:${quiz.id}`, next);
  return next;
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  return getKV().get<Quiz>(`quiz:${id}`);
}

export async function listQuizzes(): Promise<Quiz[]> {
  const kv = getKV();
  const keys = await kv.keys("quiz:");
  const quizzes = (await Promise.all(keys.map((k) => kv.get<Quiz>(k)))).filter(Boolean) as Quiz[];
  return quizzes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteQuiz(id: string): Promise<void> {
  await getKV().del([`quiz:${id}`]);
}

/* ----------------------------------------------------------------- attempts */

export async function saveAttempt(attempt: Attempt): Promise<void> {
  await getKV().set(`attempt:${attempt.id}`, attempt);
}

export async function getAttempt(id: string): Promise<Attempt | null> {
  return getKV().get<Attempt>(`attempt:${id}`);
}

export async function listAttempts(): Promise<Attempt[]> {
  const kv = getKV();
  const keys = await kv.keys("attempt:");
  const attempts = (await Promise.all(keys.map((k) => kv.get<Attempt>(k)))).filter(Boolean) as Attempt[];
  return attempts.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
