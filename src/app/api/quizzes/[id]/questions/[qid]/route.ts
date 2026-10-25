import type { NextRequest } from "next/server";
import { HttpError, handle, readJson, zodMessage } from "@/lib/server/http";
import { deleteQuestion, updateQuestion } from "@/lib/server/review";
import { QuestionPatchSchema } from "@/lib/tutor/schemas";
import { quizStartProblems } from "@/lib/tutor/validate";

type Ctx = RouteContext<"/api/quizzes/[id]/questions/[qid]">;

/** PATCH — edit text/options/answer/rubric; marks the question teacher-edited. */
export const PATCH = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id, qid } = await ctx.params;
  const parsed = QuestionPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, zodMessage(parsed.error));
  const quiz = await updateQuestion(id, qid, parsed.data);
  return Response.json({ quiz, startProblems: quizStartProblems(quiz.questions) });
});

export const DELETE = handle(async (_req: NextRequest, ctx: Ctx) => {
  const { id, qid } = await ctx.params;
  const quiz = await deleteQuestion(id, qid);
  return Response.json({ quiz, startProblems: quizStartProblems(quiz.questions) });
});
