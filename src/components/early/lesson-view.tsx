"use client";

import { ArrowFatLeft, ArrowFatRight, CaretDown, Ear, HandPointing, Images, SpeakerHigh, SquaresFour, Stop } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { pictureUrl } from "@/lib/early/pictures";
import { markExplored, progressKey, useProgress } from "@/lib/early/progress";
import { speaker } from "@/lib/early/speaker";
import type { EarlyLesson, Language } from "@/lib/early/types";
import { cn } from "@/lib/cn";
import { AudioUnavailable, KidButton, SoundBars, useSpeakerState } from "./kid-ui";

export interface LessonNav {
  prev: { slug: string; character: string } | null;
  next: { slug: string; character: string } | null;
  index: number;
  total: number;
}

export interface LangMeta {
  instruction: { text: string; audio: string };
}

export function LessonView({ lesson, nav, meta }: { lesson: EarlyLesson; nav: LessonNav; meta: LangMeta }) {
  const lang: Language = lesson.language;
  const state = useSpeakerState();
  const progress = useProgress();
  const traced = progress.attempts[progressKey(lang, lesson.slug)]?.completed;
  const [lower, setLower] = useState(false);
  const shownChar = lang === "en" && lower ? lesson.character.toLowerCase() : lesson.character;

  useEffect(() => {
    markExplored(lang, lesson.slug, lesson.character);
    speaker.preload([lesson.audio.name, lesson.audio.chant]);
    return () => speaker.stop(); // stop speech when the letter changes or the child leaves
  }, [lang, lesson]);

  const letterItems = [
    { clip: lesson.audio.name, text: lesson.letterNameText, lang },
    { clip: lesson.audio.chant, text: lesson.chantText, lang },
  ];
  const playLetter = () => speaker.play(letterItems, { key: "letter", gapMs: 450 });
  const playWords = () =>
    speaker.play(
      lesson.exampleWords.map((w) => ({
        clip: w.audio,
        text: lang === "en" ? `${lesson.character} for ${w.word}` : `${lesson.character} से ${w.word}`,
        lang,
      })),
      { key: "words", gapMs: 650 },
    );

  const letterPlaying = state.playing && state.key === "letter";
  const wordPlaying = (i: number) => state.playing && (state.key === `word-${i}` || (state.key === "words" && state.index === i));

  let caption = lang === "en" ? "Tap the letter to hear it" : "अक्षर को छूकर सुनो";
  if (state.playing && state.key === "letter") caption = state.index === 0 ? lesson.letterNameText : lesson.chantText;
  if (state.playing && state.key === "instr") caption = meta.instruction.text;
  lesson.exampleWords.forEach((w, i) => {
    if (wordPlaying(i)) caption = w.word;
  });

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <Link
          href={`/early/${lang}`}
          aria-label="All letters"
          className="press grid size-14 place-items-center rounded-full bg-surface ring-2 ring-line shadow-[0_5px_0_var(--color-line-2)]"
        >
          <SquaresFour weight="fill" className="size-7 text-ink-2" />
        </Link>
        <span className="font-kid text-lg font-bold text-ink-2 tabular">
          {nav.index + 1} / {nav.total}
        </span>
        {lang === "en" && (
          <div role="group" aria-label="Letter case" className="inline-flex rounded-full bg-surface p-1 ring-2 ring-line shadow-[0_4px_0_var(--color-line-2)]">
            <button
              type="button"
              onClick={() => setLower(false)}
              aria-pressed={!lower}
              className={cn(
                "rounded-full px-3.5 py-1 font-kid text-lg font-bold transition-colors",
                !lower ? "bg-tang text-white" : "text-ink-2 hover:text-ink",
              )}
            >
              Big {lesson.character}
            </button>
            <button
              type="button"
              onClick={() => setLower(true)}
              aria-pressed={lower}
              className={cn(
                "rounded-full px-3.5 py-1 font-kid text-lg font-bold transition-colors",
                lower ? "bg-tang text-white" : "text-ink-2 hover:text-ink",
              )}
            >
              Small {lesson.character.toLowerCase()}
            </button>
          </div>
        )}
        <div className="ml-auto flex gap-2.5">
          {nav.prev && (
            <Link href={`/early/${lang}/${nav.prev.slug}`} aria-label={`Previous letter ${nav.prev.character}`} className="press flex h-14 items-center gap-1.5 rounded-full bg-surface px-4 font-kid text-2xl font-bold ring-2 ring-line shadow-[0_5px_0_var(--color-line-2)]">
              <ArrowFatLeft weight="fill" className="size-6 text-ink-3" />
              <span lang={lang}>{nav.prev.character}</span>
            </Link>
          )}
          {nav.next && (
            <Link href={`/early/${lang}/${nav.next.slug}`} aria-label={`Next letter ${nav.next.character}`} className="press flex h-14 items-center gap-1.5 rounded-full bg-surface px-4 font-kid text-2xl font-bold ring-2 ring-line shadow-[0_5px_0_var(--color-line-2)]">
              <span lang={lang}>{nav.next.character}</span>
              <ArrowFatRight weight="fill" className="size-6 text-ink-3" />
            </Link>
          )}
        </div>
      </div>

      <section className="flex flex-col items-center">
        <button
          type="button"
          onClick={playLetter}
          aria-label={`Hear the letter ${lesson.character}`}
          className={cn(
            "group animate-pop relative grid aspect-square w-[min(68vw,17rem)] place-items-center rounded-[2.5rem] bg-surface ring-4 transition-transform active:scale-[0.98]",
            letterPlaying ? "ring-tang shadow-[0_10px_0_var(--color-tang-deep)]" : "ring-tang/25 shadow-[0_10px_0_oklch(0.87_0.05_62)]",
          )}
        >
          <span lang={lang} className={cn("font-kid leading-none font-bold text-tang-deep", lang === "hi" ? "pt-6 text-[9.5rem] sm:text-[11rem]" : "text-[10rem] sm:text-[12rem]")}>
            {shownChar}
          </span>
          {letterPlaying && <SoundBars className="absolute right-6 bottom-6 text-tang" />}
          {traced && (
            <span className="absolute top-4 right-4 rounded-full bg-sun-soft px-2.5 py-0.5 text-xs font-bold text-sun-deep ring-1 ring-sun/60">traced ★</span>
          )}
        </button>
        <p aria-live="polite" lang={lang} className="mt-6 min-h-9 font-kid text-2xl font-bold text-ink">
          {caption}
        </p>
      </section>

      <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-4 sm:gap-x-9">
        <KidButton
          icon={letterPlaying ? <Stop weight="fill" /> : <SpeakerHigh weight="fill" />}
          label={letterPlaying ? "Stop" : "Listen"}
          color="tang"
          size="xl"
          active={letterPlaying}
          onClick={() => (letterPlaying ? speaker.stop() : playLetter())}
        />
        <KidButton
          icon={state.playing && state.key === "words" ? <Stop weight="fill" /> : <Images weight="fill" />}
          label={state.playing && state.key === "words" ? "Stop" : "Hear words"}
          color="leaf"
          size="xl"
          active={state.playing && state.key === "words"}
          onClick={() => (state.playing && state.key === "words" ? speaker.stop() : playWords())}
        />
        <KidButton icon={<HandPointing weight="fill" />} label="Trace" color="sky" size="xl" href={`/early/${lang}/${lesson.slug}/trace`} />
        <KidButton
          icon={<Ear weight="fill" />}
          label="Instructions"
          color="white"
          size="xl"
          active={state.playing && state.key === "instr"}
          onClick={() => speaker.play([{ clip: meta.instruction.audio, text: meta.instruction.text, lang }], { key: "instr" })}
        />
      </div>

      <AudioUnavailable readAloud={`${lesson.letterNameText} — ${lesson.chantText}`} />

      <section aria-label="Picture words" className="mx-auto flex max-w-2xl flex-wrap justify-center gap-4">
        {lesson.exampleWords.map((w, i) => {
          const on = wordPlaying(i);
          return (
            <button
              key={w.word}
              type="button"
              onClick={() => speaker.play([{ clip: w.audio, text: w.word, lang }], { key: `word-${i}` })}
              aria-label={`Hear ${w.word}`}
              className={cn(
                "group animate-pop relative flex w-[calc(50%-0.5rem)] flex-col items-center gap-2 rounded-[1.75rem] bg-surface px-3 pt-5 pb-4 ring-2 transition-transform hover:-translate-y-1 active:translate-y-0.5 sm:w-48",
                on ? "ring-leaf shadow-[0_6px_0_var(--color-leaf-deep)]" : "ring-line shadow-[0_6px_0_var(--color-line-2)]",
              )}
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <Image src={pictureUrl(w.image)} alt="" width={88} height={88} className={cn("size-20 transition-transform sm:size-22", on && "animate-wiggle")} unoptimized />
              <span lang={lang} className="font-kid text-xl leading-tight font-bold">
                {w.word}
              </span>
              {w.gloss && <span className="text-xs font-semibold text-ink-3">{w.gloss}</span>}
              {on && <SoundBars className="absolute top-3 right-4 text-leaf-deep" />}
            </button>
          );
        })}
      </section>

      <details className="group mx-auto max-w-2xl rounded-2xl bg-surface/80 ring-1 ring-line">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-semibold text-ink-2">
          <CaretDown className="size-4 transition-transform group-open:rotate-180" />
          For grown-ups
        </summary>
        <dl className="grid gap-x-6 gap-y-2 px-5 pb-5 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="font-semibold text-ink-2">Letter name</dt>
          <dd lang={lang}>{lesson.letterNameText}</dd>
          <dt className="font-semibold text-ink-2">Sound</dt>
          <dd>{lesson.soundHintText}</dd>
          <dt className="font-semibold text-ink-2">Spoken cue</dt>
          <dd lang={lang}>{lesson.chantText}</dd>
          <dt className="font-semibold text-ink-2">Tracing guide</dt>
          <dd>
            {lesson.glyph.kind === "strokes"
              ? `${lesson.glyph.strokes.length} numbered stroke${lesson.glyph.strokes.length === 1 ? "" : "s"} with start dots and arrows.`
              : "Letter outline (stroke order not shown until reviewed by a Hindi teacher)."}
          </dd>
          <dt className="font-semibold text-ink-2">Content status</dt>
          <dd>Prototype content — please review before classroom use.</dd>
        </dl>
      </details>
    </div>
  );
}
