"use client";

import { useSyncExternalStore } from "react";
import type { Language, LessonAttempt } from "./types";

const KEY = "alp:early:v1";

export interface ProgressStore {
  explored: Record<string, number>;
  attempts: Record<string, LessonAttempt>;
  last: { language: Language; slug: string; character: string } | null;
}

const EMPTY: ProgressStore = { explored: {}, attempts: {}, last: null };
let cache: ProgressStore | null = null;
const listeners = new Set<() => void>();

export const progressKey = (language: Language, slug: string) => `${language}:${slug}`;

function read(): ProgressStore {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as ProgressStore) } : EMPTY;
  } catch {
    cache = EMPTY; // private mode / blocked storage: progress lives for this page only
  }
  return cache;
}

function write(next: ProgressStore) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore — in-memory progress still works this session */
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Session progress (persisted to localStorage; no personal details are stored). */
export function useProgress(): ProgressStore {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function markExplored(language: Language, slug: string, character: string) {
  const s = read();
  const k = progressKey(language, slug);
  write({ ...s, explored: { ...s.explored, [k]: s.explored[k] ?? Date.now() }, last: { language, slug, character } });
}

export function recordAttempt(language: Language, slug: string, character: string, coverage: number, completed: boolean) {
  const s = read();
  const k = progressKey(language, slug);
  const prev = s.attempts[k];
  const rec: LessonAttempt = {
    language,
    slug,
    character,
    attempts: (prev?.attempts ?? 0) + 1,
    bestCoverage: Math.max(prev?.bestCoverage ?? 0, coverage),
    lastCoverage: coverage,
    completed: (prev?.completed ?? false) || completed,
    timestamp: Date.now(),
  };
  write({ ...s, attempts: { ...s.attempts, [k]: rec } });
  return rec;
}

export function resetProgress() {
  write(EMPTY);
}

export function summary(store: ProgressStore, language: Language, slugs: string[]) {
  return {
    explored: slugs.filter((s) => store.explored[progressKey(language, s)]).length,
    traced: slugs.filter((s) => store.attempts[progressKey(language, s)]?.completed).length,
    total: slugs.length,
  };
}
