"use client";

import { ArrowLeft, GameController, Star } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { progressKey, summary, useProgress } from "@/lib/early/progress";
import type { Language } from "@/lib/early/types";
import { cn } from "@/lib/cn";

type LetterCase = "upper" | "lower" | "both";

interface Tile {
  slug: string;
  character: string;
  group: "vowel" | "consonant";
}

const TINTS = [
  "bg-sky-soft text-sky-deep ring-sky/30 shadow-[0_5px_0_oklch(0.82_0.06_238)]",
  "bg-tang-soft text-tang-deep ring-tang/30 shadow-[0_5px_0_oklch(0.84_0.08_60)]",
  "bg-leaf-soft text-leaf-deep ring-leaf/30 shadow-[0_5px_0_oklch(0.84_0.08_150)]",
  "bg-berry-soft text-berry-deep ring-berry/30 shadow-[0_5px_0_oklch(0.85_0.06_360)]",
  "bg-sun-soft text-sun-deep ring-sun/50 shadow-[0_5px_0_oklch(0.86_0.09_90)]",
];

const COPY = {
  en: { title: "Choose a letter", vowels: "Vowels", consonants: "Consonants", back: "Languages" },
  hi: { title: "अक्षर चुनो", vowels: "स्वर · vowels", consonants: "व्यंजन · consonants", back: "Languages" },
};

function TileLink({ t, language, i, letterCase }: { t: Tile; language: Language; i: number; letterCase: LetterCase }) {
  const progress = useProgress();
  const k = progressKey(language, t.slug);
  const traced = progress.attempts[k]?.completed;
  const explored = !!progress.explored[k];
  const lower = t.character.toLowerCase();
  const display =
    language !== "en" || letterCase === "upper"
      ? t.character
      : letterCase === "lower"
        ? lower
        : `${t.character}${lower}`;
  const href = language === "en" && letterCase === "lower" ? `/early/${language}/${t.slug}?case=lower` : `/early/${language}/${t.slug}`;
  return (
    <Link
      href={href}
      lang={language}
      aria-label={`${language === "en" ? "Letter" : "अक्षर"} ${t.character}${traced ? ", traced" : explored ? ", explored" : ""}`}
      className={cn(
        "animate-pop relative grid aspect-square place-items-center rounded-[1.6rem] font-kid font-bold ring-2 transition-transform hover:-translate-y-1 active:translate-y-1",
        letterCase === "both" && language === "en" ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl",
        language === "hi" && "pt-2",
        TINTS[i % TINTS.length],
      )}
      style={{ animationDelay: `${Math.min(i, 20) * 22}ms` }}
    >
      {display}
      {traced ? (
        <Star weight="fill" className="absolute top-2 right-2 size-6 text-sun drop-shadow-[0_1px_0_var(--color-sun-deep)]" aria-hidden="true" />
      ) : explored ? (
        <span className="absolute top-3 right-3 size-2.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      ) : null}
      {language === "en" && t.group === "vowel" && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-2 font-sans text-[0.65rem] font-bold tracking-wide text-ink-2">vowel</span>
      )}
    </Link>
  );
}

export function LetterGrid({ language, tiles }: { language: Language; tiles: Tile[] }) {
  const progress = useProgress();
  const [letterCase, setLetterCase] = useState<LetterCase>("upper");
  const s = summary(progress, language, tiles.map((t) => t.slug));
  const copy = COPY[language];
  const sections =
    language === "hi"
      ? [
          { title: copy.vowels, items: tiles.filter((t) => t.group === "vowel") },
          { title: copy.consonants, items: tiles.filter((t) => t.group === "consonant") },
        ]
      : [{ title: null, items: tiles }];
  let n = 0;
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/early"
          aria-label="Back to languages"
          className="press grid size-14 place-items-center rounded-full bg-surface ring-2 ring-line shadow-[0_5px_0_var(--color-line-2)]"
        >
          <ArrowLeft weight="bold" className="size-7" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-kid text-3xl font-bold sm:text-4xl" lang={language}>
            {copy.title}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="h-3 w-full max-w-64 overflow-hidden rounded-full bg-white ring-1 ring-line">
              <span className="block h-full rounded-full bg-leaf transition-[width] duration-700" style={{ width: `${(s.explored / s.total) * 100}%` }} />
            </span>
            <span className="shrink-0 text-sm font-bold text-ink-2 tabular">
              {s.explored} of {s.total} explored · {s.traced} traced
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {language === "en" && (
            <div role="group" aria-label="Letter case" className="inline-flex rounded-full bg-surface p-1 ring-2 ring-line shadow-[0_4px_0_var(--color-line-2)]">
              {(
                [
                  { id: "upper", label: "A B C", title: "Uppercase letters" },
                  { id: "lower", label: "a b c", title: "Lowercase letters" },
                  { id: "both", label: "Aa Bb", title: "Both cases" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLetterCase(opt.id)}
                  aria-pressed={letterCase === opt.id}
                  title={opt.title}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 font-kid text-base font-bold transition-colors",
                    letterCase === opt.id ? "bg-sky text-white shadow-xs" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <Link
            href={`/early/games?lang=${language}`}
            className="press inline-flex items-center gap-2 rounded-full bg-berry px-4 py-2.5 font-kid text-lg font-bold text-white shadow-[0_5px_0_var(--color-berry-deep)]"
          >
            <GameController weight="fill" className="size-6" />
            <span>{language === "en" ? "Play Games" : "खेल खेलो"}</span>
          </Link>
        </div>
      </div>
      {sections.map((sec) => (
        <section key={sec.title ?? "all"} aria-label={sec.title ?? "Letters"}>
          {sec.title && <h2 className="mb-3 font-kid text-xl font-bold text-ink-2">{sec.title}</h2>}
          <div className="grid grid-cols-3 gap-3.5 min-[480px]:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 sm:gap-4">
            {sec.items.map((t) => (
              <TileLink key={t.slug} t={t} language={language} i={n++} letterCase={letterCase} />
            ))}
          </div>
        </section>
      ))}
      {language === "hi" && (
        <p className="text-center text-sm text-ink-2">Prototype set: 10 vowels and 8 consonants. More letters will be added after review.</p>
      )}
    </div>
  );
}
