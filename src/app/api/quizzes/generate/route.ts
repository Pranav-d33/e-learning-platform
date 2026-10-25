import { z } from "zod";
import { HttpError, handle, ndjson, rateLimit, readJson, zodMessage } from "@/lib/server/http";
import { generateQuiz } from "@/lib/server/generate";
import { QuizConfigSchema } from "@/lib/tutor/schemas";

const Body = QuizConfigSchema.extend({ forceDemo: z.boolean().optional() });

export const maxDuration = 120;

/**
 * POST /api/quizzes/generate — validates config, retrieves context, generates and
 * checks questions. Streams NDJSON: retrieving → generating → validating → done.
 */
export const POST = handle(async (req: Request) => {
  rateLimit(req, "generate", 12);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, zodMessage(parsed.error));
  return ndjson(async (emit) => {
    const { forceDemo, ...config } = parsed.data;
    const quiz = await generateQuiz(config, emit, { forceDemo });
    return { quizId: quiz.id, questionCount: quiz.questions.length, warnings: quiz.warnings };
  });
});
