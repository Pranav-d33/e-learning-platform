import { z } from "zod";
import { DIFFICULTIES, QUESTION_TYPES } from "./types";

export const ScopeSchema = z
  .object({
    chapter: z.string().trim().max(120).nullable().default(null),
    pageFrom: z.number().int().min(1).nullable().default(null),
    pageTo: z.number().int().min(1).nullable().default(null),
  })
  .refine((s) => s.pageFrom == null || s.pageTo == null || s.pageFrom <= s.pageTo, {
    message: "The first page must come before the last page.",
  });

export const QuizConfigSchema = z.object({
  documentId: z.string().min(1, "Choose a source document."),
  grade: z.number().int().min(1).max(10),
  subject: z.string().trim().min(1).max(40),
  scope: ScopeSchema.default({ chapter: null, pageFrom: null, pageTo: null }),
  questionCount: z.number().int().min(1, "Ask for at least 1 question.").max(20, "Ask for at most 20 questions."),
  difficulty: z.enum(DIFFICULTIES),
  questionTypes: z
    .array(z.enum(QUESTION_TYPES))
    .min(1, "Choose at least one question type.")
    .transform((t) => [...new Set(t)]),
  learningObjective: z.string().trim().max(200).default(""),
});

export const QuestionPatchSchema = z
  .object({
    questionText: z.string().trim().min(3).max(600),
    options: z
      .array(z.object({ id: z.string().trim().min(1).max(2), text: z.string().trim().min(1).max(200) }))
      .min(2)
      .max(4),
    correctOptionId: z.string().trim().min(1).max(2),
    expectedAnswer: z.string().trim().min(1).max(600),
    acceptedAnswers: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
    rubric: z.object({
      criteria: z
        .array(
          z.object({
            id: z.string().trim().max(8).optional(),
            criterion: z.string().trim().min(2).max(200),
            points: z.number().int().min(1).max(5),
          }),
        )
        .min(1)
        .max(5),
    }),
    teacherNote: z.string().trim().max(400).nullable(),
  })
  .partial()
  .strict();

export const SubmitSchema = z.object({
  answers: z.record(
    z.string(),
    z.object({ optionId: z.string().max(4).optional(), text: z.string().max(2000).optional() }),
  ),
});
