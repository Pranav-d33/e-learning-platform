import { handle } from "@/lib/server/http";
import { listAttempts, listQuizzes } from "@/lib/store/repo";

/** GET /api/quizzes — summaries for the teacher dashboard. */
export const GET = handle(async () => {
  const [quizzes, attempts] = await Promise.all([listQuizzes(), listAttempts()]);
  return Response.json({
    quizzes: quizzes.map((q) => {
      const done = attempts.filter((a) => a.quizId === q.id && a.submittedAt);
      const last = done[0];
      return {
        id: q.id,
        title: q.title,
        createdAt: q.createdAt,
        status: q.status,
        grade: q.grade,
        subject: q.subject,
        difficulty: q.difficulty,
        questionCount: q.questions.length,
        needsReview: q.questions.filter((x) => x.groundingStatus !== "verified").length,
        generator: q.generator,
        attempts: done.length,
        lastAttempt: last ? { id: last.id, totalScore: last.totalScore, maxScore: last.maxScore, submittedAt: last.submittedAt } : null,
      };
    }),
  });
});
