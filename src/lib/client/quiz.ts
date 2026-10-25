"use client";

import { api } from "./api";

/** Creates a new attempt for a quiz and returns its id (the student-facing URL). */
export async function startQuiz(quizId: string): Promise<string> {
  const res = await api<{ attempt: { id: string } }>(`/api/quizzes/${quizId}/attempts`, { method: "POST" });
  return res.attempt.id;
}
