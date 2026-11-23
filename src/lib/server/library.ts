import "server-only";
import catalogueJson from "@/lib/library/catalogue.json";
import { getDocument, saveDocument, savePagesAndChunks } from "@/lib/store/repo";
import type { Chunk, PageText, SourceDocument } from "@/lib/tutor/types";
import { HttpError } from "./http";

/** [chapterId, chapterNo, title, chunkCount, pageStart, pageEnd] */
type ChapterRow = [string, number, string, number, number, number];
export interface LibraryBook {
  id: string;
  board: "maharashtra" | "cbse";
  class: number;
  medium: "english" | "marathi";
  subject: string;
  title: string;
  chapters: ChapterRow[];
}
const catalogue = catalogueJson as LibraryBook[];

export function listBooks(filter: { board?: string; cls?: number; medium?: string }): LibraryBook[] {
  return catalogue.filter(
    (b) =>
      (!filter.board || b.board === filter.board) &&
      (!filter.cls || b.class === filter.cls) &&
      (!filter.medium || b.medium === filter.medium),
  );
}

function findChapter(chapterId: string) {
  for (const book of catalogue) {
    const row = book.chapters.find((c) => c[0] === chapterId);
    if (row) return { book, row };
  }
  return null;
}

interface PineconeVector {
  metadata?: { text?: string; chunk_idx?: number };
}

/** Fetches vectors by id from the Pinecone data plane (no embedding needed: chapter scope = a known id range). */
async function fetchVectors(ids: string[]): Promise<Record<string, PineconeVector>> {
  const host = process.env.PINECONE_INDEX_HOST;
  const key = process.env.PINECONE_API_KEY;
  if (!host || !key) throw new HttpError(503, "The textbook library isn't configured on this server (PINECONE_API_KEY / PINECONE_INDEX_HOST).");
  const out: Record<string, PineconeVector> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const qs = ids.slice(i, i + 50).map((id) => `ids=${encodeURIComponent(id)}`).join("&");
    const res = await fetch(`${host.replace(/\/$/, "")}/vectors/fetch?${qs}`, {
      headers: { "Api-Key": key, "X-Pinecone-API-Version": "2025-04" },
      cache: "no-store",
    });
    if (!res.ok) throw new HttpError(502, "The textbook library is temporarily unavailable. Please try again.");
    Object.assign(out, ((await res.json()) as { vectors?: Record<string, PineconeVector> }).vectors ?? {});
  }
  return out;
}

/** Creates (or returns the existing) ready document for one textbook chapter. Idempotent: id is derived from the chapter id. */
export async function importChapter(chapterId: string): Promise<SourceDocument> {
  const hit = findChapter(chapterId);
  if (!hit) throw new HttpError(404, "That chapter isn't in the library.");
  const { book, row } = hit;
  const [, no, title, count, pageStart, pageEnd] = row;
  const docId = `lib-${chapterId}`;
  const existing = await getDocument(docId);
  if (existing?.status === "ready") return existing;

  const ids = Array.from({ length: count }, (_, i) => `${chapterId}-${String(i).padStart(3, "0")}`);
  const vectors = await fetchVectors(ids);
  const docTitle = `${book.title} — ${title}`;
  const chunks: Chunk[] = [];
  ids.forEach((id, i) => {
    const text = vectors[id]?.metadata?.text;
    if (!text) return;
    chunks.push({
      id: `${docId}-${i}`,
      documentId: docId,
      documentTitle: docTitle,
      pageNumber: pageStart,
      chunkIndex: chunks.length,
      text,
      tokenEstimate: Math.ceil(text.length / 4),
      chapter: title,
      grade: book.class,
      subject: book.subject,
      extractionMethod: "pdf-text-layer",
    });
  });
  if (chunks.length === 0) throw new HttpError(502, "That chapter's text couldn't be loaded. Please try again.");

  const pages: PageText[] = [{ page: pageStart, text: chunks.map((c) => c.text).join("\n\n"), chapter: title }];
  const now = new Date().toISOString();
  const doc: SourceDocument = {
    id: docId,
    title: docTitle,
    originalFilename: `${book.id}-ch${no}.txt`,
    mimeType: "text/plain",
    sizeBytes: pages[0].text.length,
    status: "ready",
    createdAt: now,
    updatedAt: now,
    grade: book.class,
    subject: book.subject,
    pageCount: Math.max(1, pageEnd - pageStart + 1),
    extractionMethod: "pdf-text-layer",
    errorMessage: null,
    chunkCount: chunks.length,
    chapters: [{ title, pageStart, pageEnd }],
    lowTextPages: [],
    isDemo: false,
    embedding: null,
    parts: { pages: 0, chunks: 0 },
  };
  doc.parts = await savePagesAndChunks(doc, pages, chunks);
  await saveDocument(doc);
  return doc;
}
