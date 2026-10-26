"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  BookOpenText,
  Cards,
  CheckCircle,
  Compass,
  Lightbulb,
  MagnifyingGlass,
  Quotes,
  Sparkle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { ApiError, api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import type { SourceDocument } from "@/lib/tutor/types";
import { PageHeader } from "./chrome";
import { SourceDrawer, type DrawerTarget } from "./source-drawer";

interface PageRow {
  page: number;
  chapter: string | null;
  chars: number;
  lowText: boolean;
  preview: string;
  chunkCount: number;
}

interface PreviewResponse {
  document: SourceDocument;
  pages: PageRow[];
}

interface Flashcard {
  id: string;
  category: "Vocabulary" | "Story Fact" | "Concept";
  chapter: string;
  front: string;
  back: string;
  quote: string;
  page: number;
}

const DEMO_CARDS: Flashcard[] = [
  {
    id: "fc-1",
    category: "Story Fact",
    chapter: "Unit 1 — Our Garden",
    front: "What three things did Grandmother say seeds need to grow?",
    back: "Seeds need water, sunlight, and time (patience) to grow into tall yellow flowers.",
    quote: "Seeds need water, sunlight and time.",
    page: 2,
  },
  {
    id: "fc-2",
    category: "Story Fact",
    chapter: "Unit 1 — Our Garden",
    front: "How many sunflower seeds did Riya plant near the wall?",
    back: "Riya dug five little holes in the soft soil and planted five sunflower seeds.",
    quote: "Riya dug five little holes in the soft soil near the wall.",
    page: 2,
  },
  {
    id: "fc-3",
    category: "Concept",
    chapter: "Unit 1 — Our Garden",
    front: "In the poem 'Little Seed', what woke the seed up from under the soil?",
    back: "The pitter-pat rain falling down woke the little seed up, and it stretched up to see the sun.",
    quote: "Down came the rain, pitter-pat, The seed woke up and stretched like that!",
    page: 3,
  },
  {
    id: "fc-4",
    category: "Story Fact",
    chapter: "Unit 2 — Things That Fly",
    front: "Why couldn't Arun's bright red kite fly high at first?",
    back: "The wind was too soft that morning, so Arun and his grandfather waited patiently until the wind grew strong.",
    quote: "The wind was soft that day, so his kite would not fly high.",
    page: 4,
  },
  {
    id: "fc-5",
    category: "Story Fact",
    chapter: "Unit 3 — My Day",
    front: "What items are packed inside Meena's school bag?",
    back: "Her books, two pencils, and an eraser.",
    quote: "Her school bag already holds her books, two pencils and an eraser.",
    page: 5,
  },
  {
    id: "fc-6",
    category: "Story Fact",
    chapter: "Unit 4 — Animal Friends",
    front: "How did the little green frog hide from the friendly wet dog?",
    back: "It jumped into the pond and stayed as still and quiet as a stone until the dog trotted away.",
    quote: "The frog stayed still, as quiet as a stone, until the friendly dog trotted away.",
    page: 6,
  },
  {
    id: "fc-7",
    category: "Vocabulary",
    chapter: "Unit 4 — Animal Friends",
    front: "What does the word 'patient' mean?",
    back: "Able to wait calmly without getting upset.",
    quote: "patient — able to wait calmly.",
    page: 7,
  },
  {
    id: "fc-8",
    category: "Vocabulary",
    chapter: "Unit 4 — Animal Friends",
    front: "What is a 'uniform'?",
    back: "The special clothes children wear to school.",
    quote: "uniform — the special clothes children wear to school.",
    page: 7,
  },
];

function buildCardsFromPages(pages: PageRow[]): Flashcard[] {
  const out: Flashcard[] = [];
  for (const p of pages) {
    if (p.lowText || !p.preview) continue;
    const sentences = p.preview
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 30 && s.length < 180);
    if (sentences.length > 0) {
      const s = sentences[0];
      const words = s.split(/\s+/);
      const keyWord = words.find((w) => w.length >= 5 && /^[A-Za-z]+$/.test(w)) ?? words[0];
      out.push({
        id: `auto-${p.page}`,
        category: "Concept",
        chapter: p.chapter ?? `Page ${p.page}`,
        front: `Complete the key idea from p. ${p.page}: “${s.replace(new RegExp(`\\b${keyWord}\\b`), "_____")}”`,
        back: `${keyWord} — “${s}”`,
        quote: s,
        page: p.page,
      });
    }
  }
  return out;
}

const DEMO_QUESTIONS = [
  "What do seeds need to grow?",
  "Why would Arun's red kite not fly high at first?",
  "What does Meena eat and drink before leaving for school?",
  "What did the little green frog do when the dog came near?",
  "What does the word patient mean?",
];

export function StudyStudio({ id }: { id: string }) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [fullPages, setFullPages] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"flashcards" | "ask" | "map">("flashcards");

  // Flashcards state
  const [chapterFilter, setChapterFilter] = useState<string>("all");
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Record<string, boolean>>({});

  // Ask-the-textbook state
  const [query, setQuery] = useState(DEMO_QUESTIONS[0]);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);

  useEffect(() => {
    api<PreviewResponse>(`/api/documents/${id}`).then(
      async (res) => {
        setData(res);
        // Preload page texts for instant Ask-the-Textbook search
        const entries = await Promise.all(
          res.pages.slice(0, 15).map(async (p) => {
            try {
              const r = await api<{ page: { text: string } }>(`/api/documents/${id}?page=${p.page}`);
              return [p.page, r.page.text] as const;
            } catch {
              return [p.page, p.preview] as const;
            }
          }),
        );
        setFullPages(Object.fromEntries(entries));
      },
      (err) => setError(err instanceof ApiError ? err.message : "Couldn't load the Study Studio."),
    );
  }, [id]);

  const allCards = useMemo(() => {
    if (!data) return [];
    if (data.document.isDemo) return DEMO_CARDS;
    return buildCardsFromPages(data.pages);
  }, [data]);

  const filteredCards = useMemo(
    () => (chapterFilter === "all" ? allCards : allCards.filter((c) => c.chapter === chapterFilter)),
    [allCards, chapterFilter],
  );

  const activeCard = filteredCards[cardIdx % Math.max(1, filteredCards.length)] ?? null;
  const masteredCount = allCards.filter((c) => mastered[c.id]).length;

  // Instant grounded search across pages
  const searchResults = useMemo(() => {
    if (!data || !query.trim()) return [];
    const terms = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["what", "why", "how", "when", "where", "did", "does", "the", "and", "for", "with", "from"].includes(w));

    if (terms.length === 0) return [];

    const scored: { page: number; chapter: string | null; sentence: string; context: string; score: number }[] = [];

    for (const p of data.pages) {
      if (p.lowText) continue;
      const raw = fullPages[p.page] ?? p.preview;
      const sentences = raw
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 12);

      for (const s of sentences) {
        const lower = s.toLowerCase();
        let hits = 0;
        for (const t of terms) {
          if (lower.includes(t)) hits += 1;
        }
        if (hits > 0) {
          scored.push({
            page: p.page,
            chapter: p.chapter,
            sentence: s,
            context: raw,
            score: hits / terms.length + (hits >= 2 ? 0.5 : 0),
          });
        }
      }
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 4);
  }, [data, fullPages, query]);

  if (error)
    return (
      <Notice tone="bad" title="Study Studio unavailable" action={<LinkButton href="/tutor" size="sm" variant="secondary">Workspace</LinkButton>}>
        {error}
      </Notice>
    );

  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );

  const { document: doc, pages } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-2">
        <Link href="/tutor" className="inline-flex items-center gap-1.5 hover:text-ink">
          <ArrowLeft className="size-4" /> Workspace
        </Link>
        <span className="text-line-2">/</span>
        <Link href={`/tutor/document/${doc.id}`} className="hover:text-ink">
          {doc.title}
        </Link>
      </div>

      <PageHeader
        eyebrow="Interactive Study Studio"
        title={doc.title}
        description={`Class ${doc.grade} ${doc.subject} · ${doc.pageCount} pages · ${doc.chapters.length || 1} units. Flip grounded flashcards, explore the visual chapter map, or ask the textbook a question with instant page citations.`}
        actions={
          <LinkButton href={`/tutor/generate?doc=${doc.id}`} icon={<Sparkle weight="fill" className="size-4" />}>
            Build quiz from source
          </LinkButton>
        }
      />

      {/* Mode Switcher Tabs */}
      <div role="tablist" aria-label="Study studio modes" className="grid gap-3 sm:grid-cols-3">
        {(
          [
            {
              id: "flashcards",
              title: "3D Flip Flashcards",
              sub: `${allCards.length} source-grounded cards · ${masteredCount} mastered`,
              icon: Cards,
            },
            {
              id: "ask",
              title: "Ask the Textbook",
              sub: "Instant cited answers & passage highlighter",
              icon: MagnifyingGlass,
            },
            {
              id: "map",
              title: "Visual Chapter Map",
              sub: `${doc.chapters.length || pages.length} units mapped with page links`,
              icon: Compass,
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all",
                active
                  ? "border-accent bg-accent-soft/60 text-ink shadow-lift ring-2 ring-accent/20"
                  : "border-line bg-surface text-ink-2 shadow-soft hover:border-line-2 hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl",
                  active ? "bg-accent text-white" : "bg-paper-2 text-ink-2",
                )}
              >
                <Icon weight="duotone" className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-semibold text-ink">{item.title}</span>
                <span className="block truncate text-xs text-ink-2">{item.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 3D FLIP FLASHCARDS */}
      {tab === "flashcards" && (
        <section className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            {/* Chapter filter pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setChapterFilter("all");
                  setCardIdx(0);
                  setFlipped(false);
                }}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  chapterFilter === "all" ? "bg-ink text-paper" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink",
                )}
              >
                All chapters ({allCards.length})
              </button>
              {Array.from(new Set(allCards.map((c) => c.chapter))).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    setChapterFilter(ch);
                    setCardIdx(0);
                    setFlipped(false);
                  }}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    chapterFilter === ch ? "bg-ink text-paper" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink",
                  )}
                >
                  {ch}
                </button>
              ))}
            </div>

            {activeCard ? (
              <div className="space-y-4">
                {/* 3D Flip Card Surface */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={flipped ? "Flashcard answer — click to flip back" : "Flashcard question — click to flip for answer"}
                  onClick={() => setFlipped((f) => !f)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setFlipped((f) => !f);
                    }
                  }}
                  className={cn(
                    "group relative flex min-h-80 cursor-pointer flex-col justify-between rounded-[1.75rem] border-2 p-7 transition-all duration-300 select-none sm:p-9",
                    flipped
                      ? "border-ok/40 bg-ok-soft/40 shadow-lift"
                      : "border-accent/30 bg-surface shadow-lift hover:border-accent",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={flipped ? "ok" : "accent"}>{flipped ? "Verified Answer" : activeCard.category}</Badge>
                      <span className="text-xs font-semibold text-ink-2">{activeCard.chapter}</span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-ink-3 tabular">
                      Card {(cardIdx % filteredCards.length) + 1} of {filteredCards.length}
                    </span>
                  </div>

                  <div className="my-auto py-6">
                    {!flipped ? (
                      <p className="font-display text-2xl leading-snug font-semibold text-ink sm:text-3xl">
                        {activeCard.front}
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <p className="font-display text-xl leading-relaxed font-semibold text-ink sm:text-2xl">
                          {activeCard.back}
                        </p>
                        <div className="rounded-xl border border-ok/25 bg-surface/90 p-3.5 text-sm text-ink-2">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-accent-ink">
                            <Quotes weight="fill" className="size-4 text-accent" />
                            Textbook evidence (p. {activeCard.page}):
                          </span>{" "}
                          “{activeCard.quote}”
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-4 text-xs text-ink-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <ArrowsClockwise className="size-4 text-accent" />
                      {flipped ? "Click card to see question" : "Click card (or press Space) to reveal cited answer"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawer({ documentId: doc.id, page: activeCard.page, quote: activeCard.quote });
                      }}
                      className="font-semibold text-accent-ink underline hover:text-accent"
                    >
                      Inspect p. {activeCard.page} →
                    </button>
                  </div>
                </div>

                {/* Card Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setFlipped(false);
                        setCardIdx((i) => (i - 1 + filteredCards.length) % filteredCards.length);
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setFlipped(false);
                        setCardIdx((i) => (i + 1) % filteredCards.length);
                      }}
                      icon={<ArrowRight className="size-4" />}
                    >
                      Next card
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant={mastered[activeCard.id] ? "secondary" : "primary"}
                    onClick={() => {
                      setMastered((m) => ({ ...m, [activeCard.id]: !m[activeCard.id] }));
                      setFlipped(false);
                      setCardIdx((i) => (i + 1) % filteredCards.length);
                    }}
                    icon={<CheckCircle weight="fill" className="size-4" />}
                  >
                    {mastered[activeCard.id] ? "Marked as mastered ✓" : "I know this! Mark mastered"}
                  </Button>
                </div>
              </div>
            ) : (
              <Notice tone="info">No flashcards available for this filter.</Notice>
            )}
          </div>

          {/* Mastery sidebar */}
          <aside className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-soft lg:col-span-4">
            <h3 className="font-display text-lg font-semibold">Deck Progress</h3>
            <div className="flex items-center gap-4 rounded-xl bg-paper-2/70 p-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-full bg-ok-soft font-mono text-lg font-bold text-ok">
                {allCards.length ? Math.round((masteredCount / allCards.length) * 100) : 0}%
              </div>
              <div>
                <p className="font-semibold text-ink">
                  {masteredCount} of {allCards.length} cards mastered
                </p>
                <p className="text-xs text-ink-2">Every card is tied to an exact page in {doc.title}.</p>
              </div>
            </div>
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1 text-xs">
              {filteredCards.map((c, idx) => {
                const isDone = !!mastered[c.id];
                const isCurrent = activeCard?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCardIdx(idx);
                        setFlipped(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                        isCurrent ? "bg-accent-soft font-semibold text-accent-ink" : "hover:bg-paper-2",
                      )}
                    >
                      <span className="truncate">{c.front}</span>
                      <span className="shrink-0 font-mono text-[11px] text-ink-3">
                        {isDone ? "✓" : `p.${c.page}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </section>
      )}

      {/* TAB 2: ASK THE TEXTBOOK (CITED Q&A) */}
      {tab === "ask" && (
        <section className="space-y-6 rounded-2xl border border-line bg-surface p-6 shadow-soft sm:p-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="font-display text-xl font-semibold">Ask the Textbook (Source-Grounded Q&amp;A)</h2>
            <p className="text-sm text-ink-2">
              Ask any question about <span className="font-semibold text-ink">{doc.title}</span>. Answers are retrieved directly
              from the textbook pages with exact sentence citations — never invented from outside knowledge.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about a character, poem, or word…"
                aria-label="Ask the textbook a question"
              />
            </div>
          </div>

          {doc.isDemo && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-ink-3">Try asking:</span>
              {DEMO_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuery(q)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    query === q ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-paper/60 text-ink-2 hover:text-ink",
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {searchResults.length === 0 ? (
            <Notice tone="warn" title="No matching passage found in this textbook">
              Try asking with words that appear in the chapter text. Because answers are strictly grounded in the uploaded book,
              topics outside the book are not answered.
            </Notice>
          ) : (
            <div className="space-y-4">
              {/* Top synthesized cited answer */}
              <div className="rounded-2xl border-2 border-accent/30 bg-accent-soft/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-accent-ink uppercase">
                    <Lightbulb weight="fill" className="size-4 text-accent" />
                    Best Textbook Evidence · Page {searchResults[0].page}
                    {searchResults[0].chapter ? ` (${searchResults[0].chapter})` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDrawer({
                        documentId: doc.id,
                        page: searchResults[0].page,
                        quote: searchResults[0].sentence,
                      })
                    }
                    className="text-xs font-semibold text-accent-ink underline hover:text-accent"
                  >
                    Open Page {searchResults[0].page} with highlight →
                  </button>
                </div>
                <p className="mt-2 font-display text-lg leading-relaxed font-semibold text-ink">
                  “{searchResults[0].sentence}”
                </p>
              </div>

              {/* Additional supporting citations */}
              {searchResults.length > 1 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold tracking-wide text-ink-3 uppercase">
                    Supporting Passages Across the Book
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {searchResults.slice(1).map((item, idx) => (
                      <div key={idx} className="flex flex-col justify-between rounded-xl border border-line bg-paper/50 p-4 text-sm">
                        <p className="text-ink-2">“{item.sentence}”</p>
                        <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs">
                          <span className="font-mono font-semibold text-accent-ink">p. {item.page}</span>
                          <button
                            type="button"
                            onClick={() => setDrawer({ documentId: doc.id, page: item.page, quote: item.sentence })}
                            className="font-semibold text-ink-2 underline hover:text-ink"
                          >
                            View page
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: VISUAL CHAPTER MAP */}
      {tab === "map" && (
        <section className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            {(doc.chapters.length
              ? doc.chapters
              : [{ title: doc.title, pageStart: 1, pageEnd: doc.pageCount }]
            ).map((ch, idx) => {
              const chPages = pages.filter((p) => p.page >= ch.pageStart && p.page <= ch.pageEnd);
              const totalChars = chPages.reduce((sum, p) => sum + p.chars, 0);
              return (
                <div
                  key={ch.title}
                  className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-soft"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="accent">Unit {idx + 1}</Badge>
                      <span className="font-mono text-xs font-semibold text-ink-2">
                        Pages {ch.pageStart}–{ch.pageEnd} · {totalChars.toLocaleString()} chars
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-ink">{ch.title}</h3>
                    <div className="space-y-2 pt-1">
                      {chPages.map((p) => (
                        <button
                          key={p.page}
                          type="button"
                          onClick={() => setDrawer({ documentId: doc.id, page: p.page, quote: p.preview.slice(0, 80) })}
                          className="flex w-full items-start gap-2.5 rounded-xl border border-line/80 bg-paper/60 p-3 text-left text-xs transition-colors hover:border-accent"
                        >
                          <BookOpenText weight="duotone" className="mt-0.5 size-4 shrink-0 text-accent" />
                          <div className="min-w-0 flex-1">
                            <span className="font-mono font-bold text-accent-ink">Page {p.page}: </span>
                            <span className="line-clamp-2 text-ink-2">{p.preview}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setChapterFilter(ch.title);
                        setTab("flashcards");
                      }}
                      className="text-xs font-semibold text-accent-ink underline hover:text-accent"
                    >
                      Study flashcards for this unit →
                    </button>
                    <LinkButton
                      size="sm"
                      variant="secondary"
                      href={`/tutor/generate?doc=${doc.id}`}
                      icon={<Sparkle weight="fill" className="size-3.5" />}
                    >
                      Quiz this unit
                    </LinkButton>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SourceDrawer target={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
