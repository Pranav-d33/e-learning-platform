"use client";

import {
  ArrowLeft,
  ArrowsClockwise,
  CheckCircle,
  Ear,
  GameController,
  Images,
  PuzzlePiece,
  SpeakerHigh,
  Star,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getLessons, isLanguage } from "@/lib/early/lessons";
import { pictureUrl } from "@/lib/early/pictures";
import { chime, speaker } from "@/lib/early/speaker";
import type { EarlyLesson, Language } from "@/lib/early/types";
import { cn } from "@/lib/cn";
import { Stars } from "./kid-ui";

type GameMode = "listen" | "picture" | "twins";

const TINTS = [
  "bg-sky-soft text-sky-deep ring-sky/40 shadow-[0_6px_0_oklch(0.82_0.06_238)]",
  "bg-tang-soft text-tang-deep ring-tang/40 shadow-[0_6px_0_oklch(0.84_0.08_60)]",
  "bg-leaf-soft text-leaf-deep ring-leaf/40 shadow-[0_6px_0_oklch(0.84_0.08_150)]",
  "bg-berry-soft text-berry-deep ring-berry/40 shadow-[0_6px_0_oklch(0.85_0.06_360)]",
];

function pickRandom<T>(arr: T[], count: number, seed: number): T[] {
  const copy = [...arr];
  let s = seed + 1;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function GamesView() {
  const params = useSearchParams();
  const initialLang = params.get("lang");
  const [lang, setLang] = useState<Language>(initialLang && isLanguage(initialLang) ? initialLang : "en");
  const [mode, setMode] = useState<GameMode>("listen");
  const [round, setRound] = useState(1);
  const [starsEarned, setStarsEarned] = useState(0);
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  // Twin match state
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedSlugs, setMatchedSlugs] = useState<string[]>([]);

  const lessons = useMemo(() => getLessons(lang), [lang]);

  // Deterministic per-round selection so re-renders are stable
  const roundChoices = useMemo(() => {
    const pool = pickRandom(lessons, 4, round * 31 + (lang === "en" ? 7 : 19));
    const target = pool[0];
    const shuffled = pickRandom(pool, pool.length, round * 97 + 13);
    return { target, options: shuffled };
  }, [lessons, round, lang]);

  const twinBoard = useMemo(() => {
    const four = pickRandom(lessons, 4, round * 53 + (lang === "en" ? 3 : 11));
    const right = pickRandom(four, 4, round * 89 + 29);
    return { left: four, right };
  }, [lessons, round, lang]);

  const playPrompt = useCallback(
    (target: EarlyLesson, currentMode: GameMode) => {
      if (currentMode === "listen") {
        speaker.play(
          [
            { clip: target.audio.chant, text: target.chantText, lang },
            { clip: target.exampleWords[0].audio, text: target.exampleWords[0].word, lang },
          ],
          { key: "game-prompt", gapMs: 350 },
        );
      } else if (currentMode === "picture") {
        speaker.play([{ clip: target.audio.name, text: target.letterNameText, lang }], { key: "game-prompt" });
      }
    },
    [lang],
  );

  useEffect(() => {
    if (mode !== "twins") {
      playPrompt(roundChoices.target, mode);
    }
    return () => speaker.stop();
  }, [mode, roundChoices.target, playPrompt]);

  function nextRound() {
    setPickedSlug(null);
    setSolved(false);
    setSelectedLeft(null);
    setSelectedRight(null);
    setMatchedSlugs([]);
    setRound((r) => r + 1);
  }

  function switchMode(next: GameMode) {
    setMode(next);
    setPickedSlug(null);
    setSolved(false);
    setSelectedLeft(null);
    setSelectedRight(null);
    setMatchedSlugs([]);
  }

  function switchLang(next: Language) {
    setLang(next);
    setPickedSlug(null);
    setSolved(false);
    setSelectedLeft(null);
    setSelectedRight(null);
    setMatchedSlugs([]);
    setRound((r) => r + 1);
  }

  function handleOptionPick(item: EarlyLesson) {
    if (solved) return;
    setPickedSlug(item.slug);
    if (item.slug === roundChoices.target.slug) {
      setSolved(true);
      setStarsEarned((s) => s + 1);
      chime();
      speaker.play([{ clip: item.audio.chant, text: item.chantText, lang }], { key: "game-win" });
    } else {
      speaker.play([{ clip: item.audio.name, text: item.letterNameText, lang }], { key: "game-try" });
    }
  }

  function tryMatchTwins(leftSlug: string | null, rightSlug: string | null) {
    if (!leftSlug || !rightSlug) return;
    if (leftSlug === rightSlug) {
      const next = [...matchedSlugs, leftSlug];
      setMatchedSlugs(next);
      setSelectedLeft(null);
      setSelectedRight(null);
      chime();
      const found = lessons.find((l) => l.slug === leftSlug);
      if (found) speaker.play([{ clip: found.audio.chant, text: found.chantText, lang }], { key: "twin-ok" });
      if (next.length === twinBoard.left.length) {
        setSolved(true);
        setStarsEarned((s) => s + 2);
      }
    } else {
      setTimeout(() => {
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 450);
    }
  }

  const target = roundChoices.target;
  const targetWord = target.exampleWords[0];

  return (
    <div className="space-y-7">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/early/${lang}`}
          aria-label="Back to letters"
          className="press grid size-14 place-items-center rounded-full bg-surface ring-2 ring-line shadow-[0_5px_0_var(--color-line-2)]"
        >
          <ArrowLeft weight="bold" className="size-7" />
        </Link>
        <div>
          <h1 className="font-kid text-3xl font-bold sm:text-4xl">
            {lang === "en" ? "Play & Learn Games" : "खेल-खेल में सीखो"}
          </h1>
          <p className="text-sm font-semibold text-ink-2">
            {lang === "en" ? "Tap, listen, and match — every try helps you learn!" : "सुनो, पहचानो और जोड़ी मिलाओ!"}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          {/* Language toggle */}
          <div role="group" aria-label="Game language" className="inline-flex rounded-full bg-surface p-1 ring-2 ring-line shadow-[0_4px_0_var(--color-line-2)]">
            <button
              type="button"
              onClick={() => switchLang("en")}
              aria-pressed={lang === "en"}
              className={cn("rounded-full px-3.5 py-1.5 font-kid text-base font-bold", lang === "en" ? "bg-sky text-white" : "text-ink-2")}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => switchLang("hi")}
              aria-pressed={lang === "hi"}
              className={cn("rounded-full px-3.5 py-1.5 font-kid text-base font-bold", lang === "hi" ? "bg-tang text-white" : "text-ink-2")}
            >
              हिंदी
            </button>
          </div>

          {/* Star counter */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sun-soft px-4 py-2 font-kid text-xl font-bold text-sun-deep ring-2 ring-sun/60">
            <Star weight="fill" className="size-6 text-sun drop-shadow-[0_1px_0_var(--color-sun-deep)]" />
            <span className="tabular">{starsEarned}</span>
          </div>
        </div>
      </div>

      {/* Mode tabs */}
      <div role="tablist" aria-label="Choose a mini-game" className="grid gap-3 sm:grid-cols-3">
        {(
          [
            {
              id: "listen",
              title: lang === "en" ? "1. Sound Safari" : "1. आवाज़ पहचानो",
              sub: lang === "en" ? "Hear the word & tap its letter" : "शब्द सुनो और सही अक्षर चुनो",
              icon: Ear,
              activeCls: "bg-tang text-white ring-tang shadow-[0_6px_0_var(--color-tang-deep)]",
            },
            {
              id: "picture",
              title: lang === "en" ? "2. Picture Pop" : "2. चित्र पहचानो",
              sub: lang === "en" ? "Which picture starts with this letter?" : "इस अक्षर से कौन-सा चित्र शुरू होता है?",
              icon: Images,
              activeCls: "bg-leaf text-white ring-leaf shadow-[0_6px_0_var(--color-leaf-deep)]",
            },
            {
              id: "twins",
              title: lang === "en" ? "3. Big & Small Twins (Aa)" : "3. अक्षर और चित्र जोड़ी",
              sub: lang === "en" ? "Match uppercase A with lowercase a" : "अक्षर को उसके चित्र से मिलाओ",
              icon: PuzzlePiece,
              activeCls: "bg-berry text-white ring-berry shadow-[0_6px_0_var(--color-berry-deep)]",
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchMode(tab.id)}
              className={cn(
                "press flex items-center gap-3.5 rounded-[1.5rem] p-4 text-left ring-2 transition-transform",
                active ? tab.activeCls : "bg-surface text-ink ring-line shadow-[0_5px_0_var(--color-line-2)] hover:-translate-y-0.5",
              )}
            >
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", active ? "bg-white/20 text-white" : "bg-paper-2 text-ink-2")}>
                <Icon weight="fill" className="size-7" />
              </span>
              <span className="min-w-0">
                <span className="block font-kid text-xl font-bold">{tab.title}</span>
                <span className={cn("block text-xs font-semibold", active ? "text-white/90" : "text-ink-2")}>{tab.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Game 1: Sound Safari */}
      {mode === "listen" && (
        <section className="rounded-[2rem] bg-surface p-6 ring-2 ring-line shadow-[0_8px_0_var(--color-line-2)] sm:p-8">
          <div className="flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => playPrompt(target, "listen")}
              className="press group flex flex-col items-center gap-3 rounded-[2rem] bg-sun-soft/60 px-8 py-5 ring-2 ring-sun/50 shadow-[0_6px_0_var(--color-sun-deep)]"
            >
              <Image src={pictureUrl(targetWord.image)} alt={targetWord.word} width={96} height={96} className="size-24 transition-transform group-hover:scale-105" unoptimized />
              <span className="inline-flex items-center gap-2 font-kid text-2xl font-bold text-ink">
                <SpeakerHigh weight="fill" className="size-7 text-tang" />
                {lang === "en" ? `Which letter is for “${targetWord.word}”?` : `“${targetWord.word}” किस अक्षर से शुरू होता है?`}
              </span>
            </button>

            <div className="mt-7 grid w-full max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
              {roundChoices.options.map((opt, idx) => {
                const isRight = solved && opt.slug === target.slug;
                const isTried = pickedSlug === opt.slug && !solved;
                return (
                  <button
                    key={opt.slug}
                    type="button"
                    onClick={() => handleOptionPick(opt)}
                    aria-label={`Pick ${opt.character}`}
                    className={cn(
                      "press relative flex aspect-square flex-col items-center justify-center rounded-[1.75rem] font-kid ring-3 transition-transform hover:-translate-y-1",
                      isRight
                        ? "bg-leaf text-white ring-leaf-deep shadow-[0_7px_0_var(--color-leaf-deep)]"
                        : isTried
                          ? "bg-paper-2 text-ink-3 ring-line"
                          : TINTS[idx % TINTS.length],
                    )}
                  >
                    <span lang={lang} className="text-5xl font-bold sm:text-6xl">
                      {lang === "en" ? `${opt.character}${opt.character.toLowerCase()}` : opt.character}
                    </span>
                    {isRight && <CheckCircle weight="fill" className="absolute top-2.5 right-2.5 size-7 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Game 2: Picture Pop */}
      {mode === "picture" && (
        <section className="rounded-[2rem] bg-surface p-6 ring-2 ring-line shadow-[0_8px_0_var(--color-line-2)] sm:p-8">
          <div className="flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => playPrompt(target, "picture")}
              className="press flex items-center gap-4 rounded-[2rem] bg-sky-soft px-7 py-4 text-sky-deep ring-2 ring-sky/40 shadow-[0_6px_0_oklch(0.82_0.06_238)]"
            >
              <span lang={lang} className="font-kid text-6xl font-bold">
                {lang === "en" ? `${target.character} ${target.character.toLowerCase()}` : target.character}
              </span>
              <span className="text-left">
                <span className="block font-kid text-xl font-bold text-ink">
                  {lang === "en" ? `Find a picture for ${target.character}!` : `${target.character} का चित्र ढूँढो!`}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink-2">
                  <SpeakerHigh weight="fill" className="size-4 text-sky-deep" /> Tap to hear
                </span>
              </span>
            </button>

            <div className="mt-7 grid w-full max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
              {roundChoices.options.map((opt) => {
                const w = opt.exampleWords[0];
                const isRight = solved && opt.slug === target.slug;
                const isTried = pickedSlug === opt.slug && !solved;
                return (
                  <button
                    key={opt.slug}
                    type="button"
                    onClick={() => handleOptionPick(opt)}
                    className={cn(
                      "press relative flex flex-col items-center justify-center gap-2 rounded-[1.75rem] p-4 ring-3 transition-transform hover:-translate-y-1",
                      isRight
                        ? "bg-leaf-soft text-leaf-deep ring-leaf shadow-[0_7px_0_var(--color-leaf-deep)]"
                        : isTried
                          ? "bg-paper-2 opacity-60 ring-line"
                          : "bg-paper/80 ring-line shadow-[0_6px_0_var(--color-line-2)]",
                    )}
                  >
                    <Image src={pictureUrl(w.image)} alt={w.word} width={84} height={84} className="size-20" unoptimized />
                    <span lang={lang} className="font-kid text-xl font-bold text-ink">
                      {w.word}
                    </span>
                    {isRight && <CheckCircle weight="fill" className="absolute top-2.5 right-2.5 size-7 text-leaf" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Game 3: Big & Small Twins (or Letter-Picture Match in Hindi) */}
      {mode === "twins" && (
        <section className="rounded-[2rem] bg-surface p-6 ring-2 ring-line shadow-[0_8px_0_var(--color-line-2)] sm:p-8">
          <p className="mb-5 text-center font-kid text-2xl font-bold text-ink">
            {lang === "en"
              ? "Tap a Big Letter on the top row, then tap its Small Letter twin below!"
              : "ऊपर अक्षर चुनो, फिर नीचे उसका सही चित्र चुनो!"}
          </p>

          <div className="mx-auto max-w-2xl space-y-5">
            {/* Top row */}
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
              {twinBoard.left.map((item) => {
                const done = matchedSlugs.includes(item.slug);
                const active = selectedLeft === item.slug;
                return (
                  <button
                    key={`L-${item.slug}`}
                    type="button"
                    disabled={done}
                    onClick={() => {
                      setSelectedLeft(item.slug);
                      speaker.play([{ clip: item.audio.name, text: item.letterNameText, lang }], { key: "twin-l" });
                      tryMatchTwins(item.slug, selectedRight);
                    }}
                    className={cn(
                      "press grid aspect-square place-items-center rounded-[1.5rem] font-kid text-5xl font-bold ring-3 transition-all",
                      done
                        ? "bg-leaf-soft text-leaf-deep ring-leaf opacity-75"
                        : active
                          ? " -translate-y-1 bg-sky text-white ring-sky-deep shadow-[0_6px_0_var(--color-sky-deep)]"
                          : "bg-sky-soft text-sky-deep ring-sky/40 shadow-[0_5px_0_oklch(0.82_0.06_238)]",
                    )}
                  >
                    {item.character}
                  </button>
                );
              })}
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
              {twinBoard.right.map((item) => {
                const done = matchedSlugs.includes(item.slug);
                const active = selectedRight === item.slug;
                return (
                  <button
                    key={`R-${item.slug}`}
                    type="button"
                    disabled={done}
                    onClick={() => {
                      setSelectedRight(item.slug);
                      tryMatchTwins(selectedLeft, item.slug);
                    }}
                    className={cn(
                      "press flex aspect-square flex-col items-center justify-center gap-1 rounded-[1.5rem] p-2 font-kid text-5xl font-bold ring-3 transition-all",
                      done
                        ? "bg-leaf-soft text-leaf-deep ring-leaf opacity-75"
                        : active
                          ? "-translate-y-1 bg-berry text-white ring-berry-deep shadow-[0_6px_0_var(--color-berry-deep)]"
                          : "bg-berry-soft text-berry-deep ring-berry/40 shadow-[0_5px_0_oklch(0.85_0.06_360)]",
                    )}
                  >
                    {lang === "en" ? (
                      <span>{item.character.toLowerCase()}</span>
                    ) : (
                      <>
                        <Image src={pictureUrl(item.exampleWords[0].image)} alt={item.exampleWords[0].word} width={56} height={56} className="size-12 sm:size-14" unoptimized />
                        <span className="text-xs font-bold text-ink">{item.exampleWords[0].word}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Feedback & Next Round bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] bg-surface px-6 py-4 ring-2 ring-line">
        <div className="flex items-center gap-3">
          {solved ? (
            <>
              <Stars filled={3} className="animate-pop" />
              <p className="font-kid text-2xl font-bold text-leaf-deep">
                {lang === "en" ? `Awesome! ${target.chantText}!` : `शाबाश! ${target.chantText}!`}
              </p>
            </>
          ) : pickedSlug ? (
            <p className="font-kid text-xl font-bold text-tang-deep">
              {lang === "en" ? "Good try! Listen and tap another one." : "कोशिश जारी रखो! फिर से सुनो और चुनो।"}
            </p>
          ) : (
            <p className="font-kid text-xl font-bold text-ink-2">
              <GameController weight="duotone" className="mr-1.5 inline size-6 text-berry" />
              {lang === "en" ? `Round ${round} — take your time!` : `राउंड ${round} — आराम से खेलो!`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={nextRound}
          className={cn(
            "press inline-flex items-center gap-2 rounded-full px-6 py-3 font-kid text-xl font-bold transition-colors",
            solved
              ? "bg-leaf text-white shadow-[0_5px_0_var(--color-leaf-deep)]"
              : "bg-paper-2 text-ink hover:bg-line",
          )}
        >
          <ArrowsClockwise weight="bold" className="size-5" />
          {lang === "en" ? "Next Round" : "अगला खेल"}
        </button>
      </div>
    </div>
  );
}
