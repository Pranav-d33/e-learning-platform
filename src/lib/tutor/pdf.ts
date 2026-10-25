import { extractText, getDocumentProxy } from "unpdf";
import { cleanText } from "./text";

export class PdfError extends Error {
  constructor(
    public code: "not_pdf" | "too_large" | "too_many_pages" | "encrypted" | "unreadable" | "scanned",
    message: string,
  ) {
    super(message);
  }
}

/** pdf.js proxies expose destroy() at runtime; unpdf's bundled types omit it. */
function release(pdf: unknown): Promise<void> {
  const d = (pdf as { destroy?: () => Promise<void> }).destroy;
  return d ? d.call(pdf).catch(() => {}) : Promise.resolve();
}

export interface ExtractedPdf {
  pageCount: number;
  pages: { page: number; text: string }[];
  lowTextPages: number[];
}

/** Pages with fewer meaningful characters than this are treated as image-only. */
export const LOW_TEXT_CHARS = 25;

export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

/**
 * Extracts per-page text from a digital PDF's text layer. Throws a PdfError with a
 * user-safe message for non-PDFs, encrypted files, page-limit breaches and scans.
 */
export async function extractPdf(bytes: Uint8Array, limits: { maxPages: number }): Promise<ExtractedPdf> {
  if (!looksLikePdf(bytes)) throw new PdfError("not_pdf", "This file is not a PDF. Upload a .pdf file.");
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "PasswordException")
      throw new PdfError("encrypted", "This PDF is password-protected. Remove the password and upload it again.");
    throw new PdfError("unreadable", "We couldn't read this PDF. It may be damaged — try re-exporting it and uploading again.");
  }
  if (pdf.numPages > limits.maxPages) {
    await release(pdf);
    throw new PdfError(
      "too_many_pages",
      `This PDF has ${pdf.numPages} pages; the limit is ${limits.maxPages}. Upload a single chapter or a shorter excerpt.`,
    );
  }
  let text: string[];
  try {
    ({ text } = await extractText(pdf, { mergePages: false }));
  } catch {
    throw new PdfError("unreadable", "Text extraction failed for this PDF. Try re-exporting it as a searchable PDF.");
  } finally {
    await release(pdf);
  }
  const pages = text.map((t, i) => ({ page: i + 1, text: cleanText(t) }));
  const lowTextPages = pages.filter((p) => p.text.replace(/\s/g, "").length < LOW_TEXT_CHARS).map((p) => p.page);
  if (lowTextPages.length === pages.length) {
    throw new PdfError(
      "scanned",
      "Text extraction found almost no text — this PDF looks scanned (pages are images). OCR is not enabled in this prototype, so please upload a searchable, text-based PDF.",
    );
  }
  return { pageCount: pages.length, pages, lowTextPages };
}
