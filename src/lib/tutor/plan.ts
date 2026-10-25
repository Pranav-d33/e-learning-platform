import type { QuestionType } from "./types";

/** Spreads `count` questions over the requested types, in the order given. */
export function planTypeCounts(types: QuestionType[], count: number): Record<QuestionType, number> {
  const plan = { mcq: 0, fill_blank: 0, short_answer: 0, comprehension: 0 } as Record<QuestionType, number>;
  if (types.length === 0) return plan;
  for (let i = 0; i < count; i++) plan[types[i % types.length]]++;
  return plan;
}

/** Small deterministic string hash (FNV-1a) for stable shuffles. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
