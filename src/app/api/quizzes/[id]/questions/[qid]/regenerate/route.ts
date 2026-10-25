import type { NextRequest } from "next/server";
import { handle, rateLimit } from "@/lib/server/http";
import { regenerateQuestion } from "@/lib/server/generate";
import { quizStartProblems } from "@/lib/tutor/validate";

export const maxDuration = 90;

/** POST — replaces one question with a freshly generated, re-validated one of the same type. */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/quizzes/[id]/questions/[qid]/regenerate">) => {
  rateLimit(req, "regenerate", 20);
  const { id, qid } = await ctx.params;
  const quiz = await regenerateQuestion(id, qid);
  return Response.json({ quiz, startProblems: quizStartProblems(quiz.questions) });
});
