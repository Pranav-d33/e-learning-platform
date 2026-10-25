import type { NextRequest } from "next/server";
import { HttpError, handle, rateLimit, readJson, zodMessage } from "@/lib/server/http";
import { submitAttempt } from "@/lib/server/attempts";
import { SubmitSchema } from "@/lib/tutor/schemas";

export const maxDuration = 90;

/** POST /api/attempts/:id/submit — scores objective answers exactly, open answers by rubric. */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/attempts/[id]/submit">) => {
  rateLimit(req, "submit", 20);
  const { id } = await ctx.params;
  const parsed = SubmitSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, zodMessage(parsed.error));
  return Response.json(await submitAttempt(id, parsed.data.answers));
});
