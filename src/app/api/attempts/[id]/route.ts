import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { getStudentAttempt } from "@/lib/server/attempts";

/** GET /api/attempts/:id — student view of an attempt (no answer keys). */
export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/attempts/[id]">) => {
  const { id } = await ctx.params;
  return Response.json(await getStudentAttempt(id));
});
