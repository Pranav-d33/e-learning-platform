const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have he her his i if in into is it its " +
    "me my no not of on or our she so that the their them then there they this to too up us was we were what when " +
    "where which who why will with would you your also very just than then once one all any each some such only own " +
    "same both few more most other about above after again against before below between during off out over under " +
    "until while how here these those am being having doing until"
  ).split(/\s+/),
);

/** Unicode-normalises and collapses whitespace; repairs words hyphenated across PDF line breaks. */
export function cleanText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/­/g, "")
    .replace(/(\p{L})-\n(\p{L})/gu, "$1$2")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Rough token estimate (≈4 characters per token for English prose). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function stem(word: string): string {
  if (word.length <= 4) return word;
  return word.replace(/(ing|ed|es|s)$/u, "");
}

/** Lower-cased content tokens (letters/digits of any script), stopwords removed, light stemming. */
export function tokenize(text: string, { keepStopwords = false } = {}): string[] {
  const words = text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  return words.filter((w) => keepStopwords || !STOPWORDS.has(w)).map(stem);
}

/**
 * Normalisation for objective answers: Unicode NFKC, case-folded, punctuation and
 * leading articles removed, whitespace collapsed.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”"'‘’`]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an) /, "")
    .trim();
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Share of `needle` content tokens that also occur in `haystack`. */
export function tokenSupport(needle: string, haystack: string): number {
  const n = tokenize(needle);
  if (n.length === 0) return 0;
  const h = new Set(tokenize(haystack));
  return n.filter((t) => h.has(t)).length / n.length;
}

/** True when `phrase` occurs as a whole-word sequence in `text` (stopwords kept, e.g. "one"). */
export function containsPhrase(text: string, phrase: string): boolean {
  const p = tokenize(phrase, { keepStopwords: true });
  if (p.length === 0) return false;
  const t = tokenize(text, { keepStopwords: true });
  outer: for (let i = 0; i + p.length <= t.length; i++) {
    for (let j = 0; j < p.length; j++) if (t[i + j] !== p[j]) continue outer;
    return true;
  }
  return false;
}

function squash(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

/**
 * True when `quote` appears in `source` after punctuation/whitespace normalisation,
 * or (for long quotes) when nearly all its tokens appear in order-insensitive form.
 * Models often add or drop punctuation or an ellipsis; this tolerates that, nothing more.
 */
export function quoteFoundIn(quote: string, source: string): boolean {
  const pieces = quote
    .split(/…|\.\.\./)
    .map(squash)
    .filter((p) => p.length > 0);
  if (pieces.length === 0) return false;
  const s = squash(source);
  if (pieces.every((p) => s.includes(p))) return true;
  return pieces.join(" ").split(" ").length >= 8 && tokenSupport(quote, source) >= 0.9;
}

/** Short excerpt around a quote (or the start of the text) for evidence display. */
export function excerpt(text: string, around: string | null, maxChars = 280): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= maxChars) return flat;
  let start = 0;
  if (around) {
    const idx = flat.toLowerCase().indexOf(around.toLowerCase().slice(0, 40));
    if (idx > 0) start = Math.max(0, idx - Math.floor((maxChars - Math.min(around.length, maxChars)) / 2));
  }
  const slice = flat.slice(start, start + maxChars);
  return (start > 0 ? "…" : "") + slice.replace(/\s\S*$/, "") + "…";
}

export function splitSentences(text: string): string[] {
  return (
    text
      .replace(/\s+/g, " ")
      .match(/[^.!?।]+[.!?।]+["”’)]*|[^.!?।]+$/gu)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}

export { STOPWORDS };
