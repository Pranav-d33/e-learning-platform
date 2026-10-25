import type { NextRequest } from "next/server";
import { getLessons, isLanguage } from "@/lib/early/lessons";
import { jsonError } from "@/lib/server/http";

/** GET /api/early/lessons/:language/:character — accepts the URL slug ("kha") or the glyph ("ख"). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/early/lessons/[language]/[character]">) {
  const { language, character } = await ctx.params;
  if (!isLanguage(language)) return jsonError(400, 'language must be "en" or "hi".');
  const key = decodeURIComponent(character);
  const lesson = getLessons(language).find(
    (l) => l.slug === key.toLowerCase() || l.character === key || l.character === key.toUpperCase(),
  );
  if (!lesson) return jsonError(404, "No lesson for that letter.");
  return Response.json({ lesson });
}
