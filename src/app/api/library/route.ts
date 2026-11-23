import { z } from "zod";
import { HttpError, handle, rateLimit } from "@/lib/server/http";
import { importChapter, listBooks } from "@/lib/server/library";

/** GET /api/library?board=&class=&medium= — textbook catalogue (books → chapters), no text. */
export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const cls = Number(q.get("class")) || undefined;
  return Response.json({ books: listBooks({ board: q.get("board") ?? undefined, cls, medium: q.get("medium") ?? undefined }) });
});

const Body = z.object({ chapterId: z.string().min(3).max(80) });

/** POST /api/library — { chapterId } → adds that textbook chapter as a ready source document. */
export const POST = handle(async (req: Request) => {
  rateLimit(req, "library-import", 30);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) throw new HttpError(400, "Send { chapterId }.");
  return Response.json({ document: await importChapter(body.data.chapterId) });
});
