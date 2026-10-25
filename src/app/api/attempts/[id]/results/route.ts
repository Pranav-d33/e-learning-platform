import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { getResults } from "@/lib/server/attempts";

/** GET /api/attempts/:id/results — score, per-question feedback and source references. */
export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/attempts/[id]/results">) => {
  const { id } = await ctx.params;
  return Response.json(await getResults(id));
});
