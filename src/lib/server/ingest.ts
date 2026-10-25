import "server-only";
import { randomUUID } from "node:crypto";
import { getAiConfig } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/client";
import { embedTexts } from "@/lib/ai/tasks";
import { chunkPages, detectChapters } from "@/lib/tutor/chunk";
import { PdfError, extractPdf, type ExtractedPdf } from "@/lib/tutor/pdf";
import { encodeVector } from "@/lib/tutor/retrieve";
import type { SourceDocument } from "@/lib/tutor/types";
import { saveDocument, savePagesAndChunks } from "@/lib/store/repo";
import { HttpError, uploadLimits, type Emit } from "./http";

export interface UploadInput {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  title: string;
  grade: number;
  subject: string;
}

/** Rejects unsupported or oversized files before any processing (PRD §13). */
export function validateUpload(name: string, type: string, size: number) {
  const { maxMb, maxPages } = uploadLimits();
  if (!/\.pdf$/i.test(name) && type !== "application/pdf")
    throw new HttpError(415, `Only PDF files are accepted (searchable PDFs up to ${maxMb} MB and ${maxPages} pages).`);
  if (size === 0) throw new HttpError(400, "That file is empty.");
  if (size > maxMb * 1024 * 1024)
    throw new HttpError(
      413,
      `That file is ${(size / 1024 / 1024).toFixed(1)} MB; the limit is ${maxMb} MB. Upload a single chapter or compress the PDF, then try again.`,
    );
}

/**
 * Upload → extract → chunk → (embed) → ready. Extraction failures are saved as a
 * "failed" document with a useful message, so the teacher sees what went wrong.
 */
export async function ingestPdf(input: UploadInput, emit: Emit): Promise<SourceDocument> {
  const { maxPages } = uploadLimits();
  const now = new Date().toISOString();
  const doc: SourceDocument = {
    id: randomUUID(),
    title: input.title.trim() || input.filename.replace(/\.pdf$/i, ""),
    originalFilename: input.filename,
    mimeType: "application/pdf",
    sizeBytes: input.bytes.byteLength,
    status: "extracting",
    createdAt: now,
    updatedAt: now,
    grade: input.grade,
    subject: input.subject,
    pageCount: 0,
    extractionMethod: "pdf-text-layer",
    errorMessage: null,
    chunkCount: 0,
    chapters: [],
    lowTextPages: [],
    isDemo: false,
    embedding: null,
    parts: { pages: 0, chunks: 0 },
  };
  emit({ stage: "extracting", documentId: doc.id });

  let extracted: ExtractedPdf;
  try {
    extracted = await extractPdf(input.bytes, { maxPages });
  } catch (err) {
    if (err instanceof PdfError) {
      if (err.code === "not_pdf" || err.code === "too_many_pages") throw new HttpError(422, err.message);
      await saveDocument({ ...doc, status: "failed", errorMessage: err.message });
      throw new HttpError(422, err.message, { documentId: doc.id, code: err.code });
    }
    throw err;
  }

  const { pages, chapters } = detectChapters(extracted.pages);
  const textPages = pages.filter((p) => !extracted.lowTextPages.includes(p.page));
  const chunks = chunkPages(textPages, {
    documentId: doc.id,
    documentTitle: doc.title,
    grade: doc.grade,
    subject: doc.subject,
    extractionMethod: doc.extractionMethod,
  });
  emit({ stage: "indexing", pages: extracted.pageCount, chunks: chunks.length, lowTextPages: extracted.lowTextPages.length });

  const warnings: string[] = [];
  const emb = getAiConfig().embeddings;
  if (emb && chunks.length) {
    try {
      const vectors: number[][] = [];
      for (let i = 0; i < chunks.length; i += 64) {
        vectors.push(...(await embedTexts(emb, chunks.slice(i, i + 64).map((c) => c.text))));
        emit({ stage: "embedding", done: Math.min(i + 64, chunks.length), total: chunks.length });
      }
      chunks.forEach((c, i) => (c.embedding = encodeVector(vectors[i])));
      doc.embedding = { model: emb.model, dims: vectors[0]?.length ?? 0 };
    } catch (err) {
      console.warn("[ingest] embeddings failed; continuing with keyword retrieval", err);
      warnings.push(
        err instanceof AiError
          ? `Embeddings were skipped (${err.userMessage}) — keyword retrieval will be used for this document.`
          : "Embeddings were skipped — keyword retrieval will be used for this document.",
      );
    }
  }

  const parts = await savePagesAndChunks(doc, pages, chunks);
  const ready: SourceDocument = {
    ...doc,
    status: "ready",
    pageCount: extracted.pageCount,
    chapters,
    lowTextPages: extracted.lowTextPages,
    chunkCount: chunks.length,
    parts,
  };
  await saveDocument(ready);
  return Object.assign(ready, { warnings });
}
