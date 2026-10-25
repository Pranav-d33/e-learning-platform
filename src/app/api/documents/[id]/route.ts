import type { NextRequest } from "next/server";
import { HttpError, handle } from "@/lib/server/http";
import { deleteDocument, getChunks, getDocument, getPages } from "@/lib/store/repo";

const PREVIEW_CHARS = 600;
const PAGE_CHARS = 4000;

/**
 * GET /api/documents/:id — status, counts and a limited text preview.
 * `?page=N` returns that page's extracted text (capped) for checking citations.
 */
export const GET = handle(async (req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) => {
  const { id } = await ctx.params;
  const doc = await getDocument(id);
  if (!doc) throw new HttpError(404, "Document not found. It may have been deleted, or temporary storage was cleared.");
  if (doc.status !== "ready") return Response.json({ document: doc, pages: [], chunks: { count: 0, sample: [] } });

  const [pages, chunks] = await Promise.all([getPages(doc), getChunks(doc)]);
  const pageParam = Number(req.nextUrl.searchParams.get("page"));
  if (pageParam) {
    const page = pages.find((p) => p.page === pageParam);
    if (!page) throw new HttpError(404, `Page ${pageParam} is not in this document.`);
    return Response.json({
      page: { page: page.page, chapter: page.chapter, text: page.text.slice(0, PAGE_CHARS), truncated: page.text.length > PAGE_CHARS },
      chunks: chunks.filter((c) => c.pageNumber === page.page).map((c) => ({ id: c.id, chunkIndex: c.chunkIndex, tokenEstimate: c.tokenEstimate })),
    });
  }
  return Response.json({
    document: doc,
    pages: pages.map((p) => ({
      page: p.page,
      chapter: p.chapter,
      chars: p.text.length,
      lowText: doc.lowTextPages.includes(p.page),
      preview: p.text.slice(0, PREVIEW_CHARS),
      chunkCount: chunks.filter((c) => c.pageNumber === p.page).length,
    })),
    chunks: {
      count: chunks.length,
      embedded: chunks.filter((c) => c.embedding).length,
      averageTokens: chunks.length ? Math.round(chunks.reduce((s, c) => s + c.tokenEstimate, 0) / chunks.length) : 0,
    },
  });
});

/** DELETE /api/documents/:id — removes the document, its pages and its chunks. */
export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) => {
  const { id } = await ctx.params;
  const doc = await getDocument(id);
  if (!doc) throw new HttpError(404, "Document not found.");
  if (doc.isDemo) throw new HttpError(400, "The demo reader is built in and can't be deleted.");
  await deleteDocument(doc);
  return Response.json({ deleted: id });
});
