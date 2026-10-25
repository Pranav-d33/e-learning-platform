"use client";

import { Quotes, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, api } from "@/lib/client/api";

const WORD = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}]+)?/gu;
const norm = (w: string) => w.toLowerCase().replace(/['’]/g, "");

/** Wraps the first occurrence of `quote` (word-by-word, punctuation-insensitive) in <mark>. */
export function highlightQuote(text: string, quote: string): ReactNode {
  const first = quote.split(/…|\.\.\./)[0];
  const q = (first.match(WORD) ?? []).map(norm);
  if (q.length === 0) return text;
  const words = [...text.matchAll(WORD)].map((m) => ({ w: norm(m[0]), start: m.index!, end: m.index! + m[0].length }));
  for (let i = 0; i + q.length <= words.length; i++) {
    if (q.every((w, j) => words[i + j].w === w)) {
      const s = words[i].start;
      const e = words[i + q.length - 1].end;
      return (
        <>
          {text.slice(0, s)}
          <mark className="rounded bg-sun-soft px-0.5 font-semibold text-ink ring-1 ring-sun/60">{text.slice(s, e)}</mark>
          {text.slice(e)}
        </>
      );
    }
  }
  return text;
}

/** Removes quote marks the evidence itself starts/ends with, so we can wrap it in our own. */
export function bareQuote(quote: string): string {
  return quote.trim().replace(/^["“”'‘]+|["“”'’]+$/g, "").trim();
}

export interface DrawerTarget {
  documentId: string;
  page: number;
  quote: string;
}

/** Slide-over showing the cited page's extracted text with the evidence highlighted. */
export function SourceDrawer({ target, onClose }: { target: DrawerTarget | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const key = target ? `${target.documentId}:${target.page}` : "";
  const [loaded, setLoaded] = useState<{ key: string; page?: { text: string; chapter: string | null }; error?: string } | null>(null);
  const page = loaded?.key === key ? (loaded.page ?? null) : null;
  const error = loaded?.key === key ? (loaded.error ?? null) : null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
    if (!target) return;
    const k = `${target.documentId}:${target.page}`;
    api<{ page: { text: string; chapter: string | null } }>(`/api/documents/${target.documentId}?page=${target.page}`)
      .then((r) => setLoaded({ key: k, page: r.page }))
      .catch((err) => setLoaded({ key: k, error: err instanceof ApiError ? err.message : "Couldn't load the page." }));
  }, [target]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="drawer-title"
      className="mr-0 ml-auto h-dvh max-h-dvh w-[min(34rem,100vw)] max-w-none border-l border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/30 open:animate-[rise_300ms_ease-out]"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start gap-3 border-b border-line px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-3">Source page</p>
            <h2 id="drawer-title" className="font-display text-xl font-semibold">
              Page {target?.page}
              {page?.chapter && <span className="ml-2 font-sans text-sm font-medium text-ink-2">· {page.chapter}</span>}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-paper-2" aria-label="Close source page">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {target && (
            <p className="mb-4 flex gap-2 rounded-xl bg-paper-2/70 p-3 text-sm text-ink-2">
              <Quotes weight="fill" className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>Cited evidence: “{bareQuote(target.quote)}”</span>
            </p>
          )}
          {error && <Notice tone="bad">{error}</Notice>}
          {!page && !error && <Spinner className="text-accent" label="Loading page" />}
          {page && target && <p className="whitespace-pre-line text-[0.95rem] leading-relaxed">{highlightQuote(page.text, target.quote)}</p>}
        </div>
      </div>
    </dialog>
  );
}
