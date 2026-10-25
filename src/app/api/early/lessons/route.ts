import type { NextRequest } from "next/server";
import { isLanguage, lessonSummaries } from "@/lib/early/lessons";
import { jsonError } from "@/lib/server/http";

/** GET /api/early/lessons?language=en|hi — curated lesson metadata. */
export async function GET(req: NextRequest) {
  const language = req.nextUrl.searchParams.get("language") ?? "en";
  if (!isLanguage(language)) return jsonError(400, 'language must be "en" or "hi".');
  return Response.json({ language, lessons: lessonSummaries(language) });
}
