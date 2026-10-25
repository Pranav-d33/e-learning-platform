import type { Chapter, Chunk, PageText, SourceDocument } from "./types";
import { estimateTokens, splitSentences } from "./text";

export const CHUNK_DEFAULTS = { targetTokens: 500, overlapTokens: 100, maxTokens: 800 };

const HEADING =
  /^\s*((?:chapter|unit|lesson|section|theme)\s+(?:\d+|[ivxlc]+)\b.{0,80}|(?:अध्याय|पाठ|इकाई)\s*[\d०-९]+.{0,80})$/iu;
/** Table-of-contents style lines: "(pages 2–3)", "p. 12", or dotted leaders ending in a number. */
const TOC_LINE = /\(?\bp(?:age)?s?\.?\s*\d|\.{3,}\s*\d+\s*$|\s\d{1,3}\s*$/i;

/**
 * Detects chapter/unit headings near the top of a page and assigns each page to the
 * most recent one. Contents pages (several heading-like lines) never start a chapter.
 */
export function detectChapters(pages: { page: number; text: string }[]): { pages: PageText[]; chapters: Chapter[] } {
  let current: string | null = null;
  const chapters: Chapter[] = [];
  const out = pages.map(({ page, text }) => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const headingLines = lines.filter((l) => HEADING.test(l));
    const isContents = headingLines.length >= 2;
    const match = isContents
      ? null
      : lines
          .slice(0, 4)
          .map((l) => l.match(HEADING))
          .find((m) => m && !TOC_LINE.test(m[1]));
    if (match) {
      current = match[1].replace(/\s+/g, " ").trim().slice(0, 90);
      chapters.push({ title: current, pageStart: page, pageEnd: page });
    } else if (chapters.length) {
      chapters[chapters.length - 1].pageEnd = page;
    }
    return { page, text, chapter: current };
  });
  return { pages: out, chapters };
}

interface ChunkMeta {
  documentId: string;
  documentTitle: string;
  grade: number;
  subject: string;
  extractionMethod: SourceDocument["extractionMethod"];
}

function units(pageText: string, targetTokens: number): string[] {
  const paragraphs = pageText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  return paragraphs.flatMap((p) => (estimateTokens(p) <= targetTokens ? [p] : splitSentences(p)));
}

/**
 * Page-bounded, paragraph-aware chunking with sentence overlap. Chunks never cross a
 * page boundary, so every chunk carries one exact page number for citations.
 */
export function chunkPages(pages: PageText[], meta: ChunkMeta, options: Partial<typeof CHUNK_DEFAULTS> = {}): Chunk[] {
  const { targetTokens, overlapTokens, maxTokens } = { ...CHUNK_DEFAULTS, ...options };
  const chunks: Chunk[] = [];
  for (const page of pages) {
    const parts = units(page.text, targetTokens);
    let buffer: string[] = [];
    let carried = 0; // number of units at the start of buffer that were overlap from the previous chunk
    const flush = () => {
      if (buffer.length === carried) return;
      const text = buffer.join(" ").trim();
      if (!text) return;
      const index = chunks.length;
      chunks.push({
        id: `${meta.documentId}:c${index}`,
        documentId: meta.documentId,
        documentTitle: meta.documentTitle,
        pageNumber: page.page,
        chunkIndex: index,
        text: estimateTokens(text) > maxTokens ? text.slice(0, maxTokens * 4) : text,
        tokenEstimate: Math.min(estimateTokens(text), maxTokens),
        chapter: page.chapter,
        grade: meta.grade,
        subject: meta.subject,
        extractionMethod: meta.extractionMethod,
      });
      const overlap: string[] = [];
      let tokens = 0;
      for (let i = buffer.length - 1; i >= 0; i--) {
        const t = estimateTokens(buffer[i]);
        if (tokens + t > overlapTokens) break;
        overlap.unshift(buffer[i]);
        tokens += t;
      }
      buffer = overlap;
      carried = overlap.length;
    };
    for (const unit of parts) {
      const size = estimateTokens(buffer.join(" ")) + estimateTokens(unit);
      if (buffer.length > carried && size > targetTokens) flush();
      buffer.push(unit);
    }
    flush();
  }
  return chunks;
}
