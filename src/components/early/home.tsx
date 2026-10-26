"use client";

import { ArrowCounterClockwise, CaretDown, GameController, Play, SpeakerHigh } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LANGUAGES } from "@/lib/early/lessons";
import { resetProgress, summary, useProgress } from "@/lib/early/progress";
import { speaker } from "@/lib/early/speaker";
import type { Language } from "@/lib/early/types";
import { cn } from "@/lib/cn";
import { AudioUnavailable } from "./kid-ui";

const CARD: Record<Language, { glyphs: string; bg: string; face: string; sub: string }> = {
  en: { glyphs: "A B C", bg: "bg-sky", face: "shadow-[0_8px_0_var(--color-sky-deep)]", sub: "26 letters · A to Z" },
  hi: { glyphs: "अ आ क", bg: "bg-tang", face: "shadow-[0_8px_0_var(--color-tang-deep)]", sub: "स्वर और व्यंजन · first set" },
};

export function EarlyHome({ slugs }: { slugs: Record<Language, string[]> }) {
  const progress = useProgress();
  const [confirm, setConfirm] = useState(false);
  const last = progress.last;

  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="animate-rise font-kid text-4xl font-bold tracking-tight sm:text-5xl">Who is learning today?</h1>
        <p className="animate-rise mt-2 text-lg text-ink-2 [animation-delay:60ms]">Pick a language. Sound does the teaching — a grown-up can help.</p>
      </section>

      <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
        {(Object.keys(LANGUAGES) as Language[]).map((lang, i) => {
          const s = summary(progress, lang, slugs[lang]);
          const meta = LANGUAGES[lang];
          return (
            <Link
              key={lang}
              href={`/early/${lang}`}
              lang={lang}
              className={cn(
                "group animate-pop flex flex-col items-center rounded-[2rem] px-6 pt-8 pb-6 text-center text-white transition-transform hover:-translate-y-1 active:translate-y-1",
                CARD[lang].bg,
                CARD[lang].face,
              )}
              style={{ animationDelay: `${100 + i * 80}ms` }}
            >
              <span className="font-kid text-6xl leading-none font-bold tracking-wide drop-shadow-[0_3px_0_rgb(0_0_0/0.15)] sm:text-7xl">{CARD[lang].glyphs}</span>
              <span className="mt-4 font-kid text-3xl font-bold">{meta.nativeLabel}</span>
              <span className="text-sm font-semibold opacity-90">{CARD[lang].sub}</span>
              <span className="mt-5 w-full max-w-56">
                <span className="block h-2.5 overflow-hidden rounded-full bg-white/30">
                  <span className="block h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${(s.traced / s.total) * 100}%` }} />
                </span>
                <span className="mt-1.5 block text-xs font-bold opacity-95 tabular">
                  {s.explored} of {s.total} explored · {s.traced} traced
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        {last && (
          <Link
            href={`/early/${last.language}/${last.slug}`}
            className="press inline-flex items-center gap-3 rounded-full bg-surface py-2.5 pr-6 pl-2.5 font-kid text-lg font-bold ring-2 ring-sun/60 shadow-[0_5px_0_var(--color-sun-deep)]"
          >
            <span className="grid size-11 place-items-center rounded-full bg-sun text-ink">
              <Play weight="fill" className="size-5" />
            </span>
            Continue with <span className="text-2xl text-tang-deep" lang={last.language}>{last.character}</span>
          </Link>
        )}
        <Link
          href="/early/games"
          className="press inline-flex items-center gap-3 rounded-full bg-berry py-2.5 pr-6 pl-3 font-kid text-lg font-bold text-white shadow-[0_5px_0_var(--color-berry-deep)]"
        >
          <span className="grid size-11 place-items-center rounded-full bg-white/20 text-white">
            <GameController weight="fill" className="size-6" />
          </span>
          Play Mini-Games! · खेल खेलो
        </Link>
      </div>

      <AudioUnavailable readAloud="“Who is learning today? Pick English or Hindi.”" />

      <details className="group mx-auto max-w-3xl rounded-2xl bg-surface/80 ring-1 ring-line">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold text-ink-2">
          <CaretDown className="size-4 transition-transform group-open:rotate-180" />
          For grown-ups
        </summary>
        <div className="space-y-4 px-5 pb-5 text-sm text-ink-2">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Each letter has a spoken name, an “A for apple” cue and picture words. Children don&apos;t need to read anything.</li>
            <li>English letters show numbered start dots and arrows; tracing is checked against those strokes. Hindi letters are traced over the letter shape — stroke-order guides need review by a Hindi teacher first.</li>
            <li>Feedback is gentle and never blocks moving on. It is a practice aid, not an assessment.</li>
            <li>Progress stays in this browser only. Nothing is recorded or uploaded.</li>
            <li>Voice clips are machine-generated placeholders for this prototype; replace them with teacher recordings before real use.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<SpeakerHigh weight="duotone" className="size-4" />}
              onClick={() => speaker.play([{ clip: LANGUAGES.en.instruction.audio, text: LANGUAGES.en.instruction.text, lang: "en" }])}
            >
              Test the sound
            </Button>
            <Button variant="danger" size="sm" icon={<ArrowCounterClockwise className="size-4" />} onClick={() => setConfirm(true)}>
              Reset progress
            </Button>
          </div>
        </div>
      </details>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset all progress?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Keep progress</Button>
            <Button
              variant="danger"
              onClick={() => {
                resetProgress();
                setConfirm(false);
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        Stars, explored letters and “Continue” will be cleared on this device.
      </Dialog>
    </div>
  );
}
