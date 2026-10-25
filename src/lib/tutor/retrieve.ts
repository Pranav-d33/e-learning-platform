import type { ChapterScope, Chunk } from "./types";
import { tokenize } from "./text";

export function encodeVector(v: number[] | Float32Array): string {
  const f = v instanceof Float32Array ? v : Float32Array.from(v);
  return Buffer.from(f.buffer, f.byteOffset, f.byteLength).toString("base64");
}

export function decodeVector(b64: string): Float32Array {
  const buf = Buffer.from(b64, "base64");
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Okapi BM25 over the given chunks (computed on the fly — corpora here are small). */
export function bm25Scores(query: string, chunks: Chunk[], k1 = 1.5, b = 0.75): number[] {
  const q = [...new Set(tokenize(query))];
  if (q.length === 0 || chunks.length === 0) return chunks.map(() => 0);
  const docs = chunks.map((c) => tokenize(c.text));
  const avg = docs.reduce((s, d) => s + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  return docs.map((d) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avg));
    }
    return score;
  });
}

export function inScope(chunk: Chunk, scope: ChapterScope): boolean {
  if (scope.chapter && chunk.chapter !== scope.chapter) return false;
  if (scope.pageFrom != null && chunk.pageNumber < scope.pageFrom) return false;
  if (scope.pageTo != null && chunk.pageNumber > scope.pageTo) return false;
  return true;
}

function rankOf(scores: number[]): number[] {
  const order = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]);
  const rank = new Array<number>(scores.length);
  order.forEach(([, i], r) => (rank[i] = r));
  return rank;
}

export interface ContextSelection {
  chunks: Chunk[];
  retrieval: "bm25" | "hybrid";
  strategy: "whole_scope" | "objective_ranked" | "coverage_sampled";
}

/**
 * Picks the chunks a generation call will see. Small scopes are passed whole; larger
 * ones are ranked against the learning objective (BM25, fused with embeddings via
 * reciprocal-rank fusion when vectors exist) or sampled evenly across pages.
 */
export function selectContext(args: {
  chunks: Chunk[];
  scope: ChapterScope;
  objective: string;
  queryVector?: Float32Array | null;
  maxTokens?: number;
}): ContextSelection {
  const maxTokens = args.maxTokens ?? 5000;
  const scoped = args.chunks.filter((c) => inScope(c, args.scope));
  const vectors = !!args.queryVector && scoped.some((c) => c.embedding);
  const retrieval = vectors ? "hybrid" : "bm25";
  const total = scoped.reduce((s, c) => s + c.tokenEstimate, 0);
  if (total <= maxTokens) return { chunks: scoped, retrieval, strategy: "whole_scope" };

  const pick = (ordered: Chunk[]) => {
    const chosen: Chunk[] = [];
    const perPage = new Map<number, number>();
    let used = 0;
    for (const c of ordered) {
      if (used + c.tokenEstimate > maxTokens) continue;
      if ((perPage.get(c.pageNumber) ?? 0) >= 2) continue; // keep evidence spread across pages
      chosen.push(c);
      used += c.tokenEstimate;
      perPage.set(c.pageNumber, (perPage.get(c.pageNumber) ?? 0) + 1);
    }
    return chosen.sort((a, b) => a.chunkIndex - b.chunkIndex);
  };

  if (args.objective.trim()) {
    const lexical = rankOf(bm25Scores(args.objective, scoped));
    let fused = lexical.map((r) => 1 / (60 + r));
    if (vectors && args.queryVector) {
      const dense = rankOf(scoped.map((c) => (c.embedding ? cosine(args.queryVector!, decodeVectorCached(c)) : -1)));
      fused = fused.map((s, i) => s + 1 / (60 + dense[i]));
    }
    const ordered = scoped.map((c, i) => [fused[i], c] as const).sort((a, b) => b[0] - a[0]).map(([, c]) => c);
    return { chunks: pick(ordered), retrieval, strategy: "objective_ranked" };
  }

  // No objective: stratified sample across the scope, preferring content-rich chunks.
  const stride = Math.max(1, Math.round(scoped.length / Math.max(1, Math.floor(maxTokens / 450))));
  const ordered: Chunk[] = [];
  for (let offset = 0; offset < stride; offset++)
    for (let i = offset; i < scoped.length; i += stride) ordered.push(scoped[i]);
  return { chunks: pick(ordered), retrieval, strategy: "coverage_sampled" };
}

const vectorCache = new WeakMap<Chunk, Float32Array>();
function decodeVectorCached(c: Chunk): Float32Array {
  let v = vectorCache.get(c);
  if (!v) {
    v = decodeVector(c.embedding!);
    vectorCache.set(c, v);
  }
  return v;
}
