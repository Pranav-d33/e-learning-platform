import type { NextRequest } from "next/server";
import { HttpError, handle } from "@/lib/server/http";
import { deleteQuiz, getDocument, getQuiz } from "@/lib/store/repo";
import { quizStartProblems } from "@/lib/tutor/validate";

/** GET /api/quizzes/:id — teacher view, including answer keys and evidence. */
export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/quizzes/[id]">) => {
  const { id } = await ctx.params;
  const quiz = await getQuiz(id);
  if (!quiz) throw new HttpError(404, "Quiz not found. It may have been deleted, or temporary storage was cleared.");
  const doc = await getDocument(quiz.documentIds[0]);
  return Response.json({
    quiz,
    source: doc ? { id: doc.id, title: doc.title, isDemo: doc.isDemo, pageCount: doc.pageCount } : null,
    startProblems: quizStartProblems(quiz.questions),
  });
});

export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/quizzes/[id]">) => {
  const { id } = await ctx.params;
  if (!(await getQuiz(id))) throw new HttpError(404, "Quiz not found.");
  await deleteQuiz(id);
  return Response.json({ deleted: id });
});
