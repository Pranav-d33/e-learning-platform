import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { startAttempt } from "@/lib/server/attempts";

/** POST /api/quizzes/:id/attempts — creates an attempt; returns student questions WITHOUT answer keys. */
export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/quizzes/[id]/attempts">) => {
  const { id } = await ctx.params;
  return Response.json(await startAttempt(id), { status: 201 });
});
