"use client";

import {
  ArrowArcLeft,
  ArrowFatLeft,
  ArrowFatRight,
  ArrowsCounterClockwise,
  Check,
  Eraser,
  Eye,
  EyeSlash,
  MagicWand,
  SpeakerHigh,
  Star,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { traceFeedback, type FeedbackTone } from "@/lib/early/feedback";
import { regionGroups, scoreTrace, skeletonPoints, strokeGroups, zhangSuen, type GuideGroup, type TraceScore } from "@/lib/early/geometry";
import { progressKey, recordAttempt, useProgress } from "@/lib/early/progress";
import { chime, speaker } from "@/lib/early/speaker";
import type { EarlyLesson } from "@/lib/early/types";
import { cn } from "@/lib/cn";
import { AudioUnavailable, KidButton, Stars } from "./kid-ui";
import type { LessonNav } from "./lesson-view";
import { TraceBoard, type TraceBoardHandle } from "./trace-board";

/** Rasterises the exact SVG outline the child sees and thins it to centre-line samples. */
function outlineGroups(outline: string): GuideGroup[] {
  const N = 200;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.fill(new Path2D(outline));
  const data = ctx.getImageData(0, 0, N, N).data;
  const mask = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) mask[i] = data[i * 4 + 3] > 127 ? 1 : 0;
  return regionGroups(skeletonPoints(zhangSuen(mask, N, N), N, N, 3));
}

const TONE_STYLE: Record<FeedbackTone, string> = {
  idle: "bg-surface ring-line text-ink-2",
  great: "bg-leaf-soft ring-leaf/40 text-leaf-deep",
  partial: "bg-sun-soft ring-sun/60 text-[oklch(0.45_0.1_80)]",
  retry: "bg-tang-soft ring-tang/30 text-tang-deep",
};

function Sparkles() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const r = 120 + (i % 3) * 40;
        return (
          <Star
            key={i}
            weight="fill"
            className="sparkle absolute top-1/2 left-1/2 size-8 text-sun drop-shadow-[0_2px_0_var(--color-sun-deep)]"
            style={{ "--dx": `${Math.cos(a) * r}px`, "--dy": `${Math.sin(a) * r}px`, animationDelay: `${(i % 4) * 40}ms` } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

export function TraceView({
  lesson,
  nav,
  traceIntro,
}: {
  lesson: EarlyLesson;
  nav: LessonNav;
  traceIntro: { text: string; audio: string };
}) {
  const lang = lesson.language;
  const board = useRef<TraceBoardHandle>(null);
  const progress = useProgress();
  const record = progress.attempts[progressKey(lang, lesson.slug)];
  const [ink, setInk] = useState(0);
  const [guide, setGuide] = useState(true);
  const [demo, setDemo] = useState(0);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: TraceScore; tone: FeedbackTone; text: string } | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [lower, setLower] = useState(false);
  const outlineCache = useRef<GuideGroup[] | null>(null);

  const activeGlyph = lang === "en" && lower && lesson.lowerGlyph ? lesson.lowerGlyph : lesson.glyph;
  const shownChar = lang === "en" && lower ? lesson.character.toLowerCase() : lesson.character;
  const strokeBased = activeGlyph.kind === "strokes";
  const strokeGuide = useMemo(() => (activeGlyph.kind === "strokes" ? strokeGroups(activeGlyph.strokes) : null), [activeGlyph]);

  /** Outline skeletons need a canvas, so they are built on first check (client only). */
  function guideGroups(): GuideGroup[] {
    if (strokeGuide) return strokeGuide;
    if (activeGlyph.kind === "outline") outlineCache.current ??= outlineGroups(activeGlyph.outline);
    return outlineCache.current ?? [];
  }

  useEffect(() => {
    speaker.preload([traceIntro.audio, lesson.audio.name]);
    return () => speaker.stop();
  }, [lesson, traceIntro.audio]);

  function listen() {
    speaker.play(
      [
        { clip: lesson.audio.name, text: lesson.letterNameText, lang },
        { clip: traceIntro.audio, text: traceIntro.text, lang },
      ],
      { key: "intro", gapMs: 400 },
    );
  }

  function check() {
    const score = scoreTrace(guideGroups(), board.current?.getStrokes() ?? []);
    const fb = traceFeedback(lang, score);
    setResult({ score, tone: fb.tone, text: fb.spoken.text });
    speaker.play([{ clip: fb.spoken.audio, text: fb.spoken.text, lang }], { key: "feedback" });
    setHighlight(strokeBased && score.verdict === "partial" && score.weakest ? score.weakest.id : null);
    if (score.verdict === "empty") return;
    recordAttempt(lang, lesson.slug, lesson.character, Math.round(score.coverage * 100) / 100, score.verdict === "great");
    if (score.verdict === "great") {
      chime();
      setCelebrate((n) => n + 1);
    }
  }

  function clear() {
    board.current?.clear();
    setResult(null);
    setHighlight(null);
  }

  const stars = !result || result.score.verdict === "empty" ? 0 : result.score.verdict === "great" ? 3 : result.score.verdict === "partial" ? (result.score.coverage >= 0.55 ? 2 : 1) : 1;
  const done = result?.score.verdict === "great";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/early/${lang}/${lesson.slug}`}
          aria-label={`Back to letter ${lesson.character}`}
          className="press flex h-14 items-center gap-2 rounded-full bg-surface pr-5 pl-3 ring-2 ring-line shadow-[0_5px_0_var(--color-line-2)]"
        >
          <ArrowArcLeft weight="bold" className="size-6 text-ink-2" />
          <span lang={lang} className="font-kid text-3xl leading-none font-bold text-tang-deep">
            {lesson.character}
          </span>
        </Link>
        <h1 className="font-kid text-2xl font-bold sm:text-3xl">{lang === "en" ? `Trace ${shownChar}!` : "लिखो!"}</h1>
        {lang === "en" && lesson.lowerGlyph && (
          <div role="group" aria-label="Letter case" className="inline-flex rounded-full bg-surface p-1 ring-2 ring-line shadow-[0_4px_0_var(--color-line-2)]">
            <button
              type="button"
              onClick={() => {
                setLower(false);
                clear();
              }}
              aria-pressed={!lower}
              className={cn(
                "rounded-full px-3.5 py-1 font-kid text-lg font-bold transition-colors",
                !lower ? "bg-sky text-white" : "text-ink-2 hover:text-ink",
              )}
            >
              Big {lesson.character}
            </button>
            <button
              type="button"
              onClick={() => {
                setLower(true);
                clear();
              }}
              aria-pressed={lower}
              className={cn(
                "rounded-full px-3.5 py-1 font-kid text-lg font-bold transition-colors",
                lower ? "bg-sky text-white" : "text-ink-2 hover:text-ink",
              )}
            >
              Small {lesson.character.toLowerCase()}
            </button>
          </div>
        )}
        {record && (
          <span className="ml-auto text-sm font-bold text-ink-3 tabular">
            Tries: {record.attempts}
            {record.completed ? " · ★" : ""}
          </span>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,34rem)_1fr]">
        <div className="relative mx-auto w-full max-w-[min(34rem,calc(100dvh-14rem))]">
          <TraceBoard
            ref={board}
            glyph={activeGlyph}
            guideVisible={guide}
            highlight={highlight}
            demo={demo}
            onInkChange={(n) => {
              setInk(n);
              if (result) setResult(null);
            }}
            label={`Tracing area for ${shownChar}. Draw over the light letter with a finger, stylus or mouse.`}
          />
          {celebrate > 0 && <Sparkles key={celebrate} />}
        </div>

        <div className="space-y-5">
          <div
            aria-live="polite"
            className={cn("flex min-h-24 flex-col items-center justify-center gap-2 rounded-[1.75rem] px-5 py-4 text-center ring-2", TONE_STYLE[result?.tone ?? "idle"])}
          >
            {result && stars > 0 && <Stars filled={stars} className="animate-pop" />}
            <p lang={lang} className="font-kid text-2xl leading-snug font-bold">
              {result ? result.text : lang === "en" ? "Follow the light letter with your finger." : "हल्के अक्षर पर उँगली चलाओ।"}
            </p>
            {result && result.score.verdict !== "empty" && (
              <p className="text-xs font-semibold opacity-70">
                Practice check · {Math.round(result.score.coverage * 100)}% of the letter covered · {Math.round(result.score.onGuide * 100)}% of lines on the letter
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 justify-items-center gap-x-2 gap-y-4 sm:grid-cols-6 lg:grid-cols-3">
            <KidButton icon={<SpeakerHigh weight="fill" />} label="Listen" color="tang" size="md" onClick={listen} />
            <KidButton
              icon={<MagicWand weight="fill" />}
              label="Show me"
              color="sky"
              size="md"
              onClick={() => setDemo((d) => d + 1)}
              disabled={!strokeBased}
            />
            <KidButton
              icon={guide ? <Eye weight="fill" /> : <EyeSlash weight="fill" />}
              label={guide ? "Hide guide" : "Show guide"}
              color="white"
              size="md"
              onClick={() => setGuide((g) => !g)}
            />
            <KidButton icon={<ArrowsCounterClockwise weight="bold" />} label="Undo" color="white" size="md" onClick={() => board.current?.undo()} disabled={ink === 0} />
            <KidButton icon={<Eraser weight="fill" />} label="Clear" color="white" size="md" onClick={clear} disabled={ink === 0} />
            <KidButton icon={<Check weight="bold" />} label="Check" color="leaf" size="md" onClick={check} active={ink > 0 && !result} />
          </div>
          {!strokeBased && (
            <p className="text-center text-xs text-ink-3">“Show me” needs reviewed stroke-order data, which Hindi letters don&apos;t have yet.</p>
          )}

          <div className="flex flex-wrap justify-center gap-3 pt-1">
            {result && result.score.verdict !== "great" && (
              <button type="button" onClick={clear} className="press rounded-full bg-surface px-5 py-3 font-kid text-lg font-bold ring-2 ring-line shadow-[0_5px_0_var(--color-line-2)]">
                Try again
              </button>
            )}
            {nav.next ? (
              <Link
                href={`/early/${lang}/${nav.next.slug}/trace`}
                className={cn(
                  "press inline-flex items-center gap-2 rounded-full px-6 py-3 font-kid text-lg font-bold",
                  done ? "bg-leaf text-white shadow-[0_5px_0_var(--color-leaf-deep)]" : "bg-surface ring-2 ring-line shadow-[0_5px_0_var(--color-line-2)]",
                )}
              >
                Next letter <span lang={lang} className="text-2xl leading-none">{nav.next.character}</span>
                <ArrowFatRight weight="fill" className="size-5" />
              </Link>
            ) : (
              <Link href={`/early/${lang}`} className="press inline-flex items-center gap-2 rounded-full bg-leaf px-6 py-3 font-kid text-lg font-bold text-white shadow-[0_5px_0_var(--color-leaf-deep)]">
                All letters
              </Link>
            )}
          </div>
          {nav.prev && (
            <p className="text-center">
              <Link href={`/early/${lang}/${nav.prev.slug}/trace`} className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-2 hover:text-ink">
                <ArrowFatLeft weight="fill" className="size-4" /> Previous letter <span lang={lang}>{nav.prev.character}</span>
              </Link>
            </p>
          )}
          <AudioUnavailable readAloud={traceIntro.text} />
        </div>
      </div>
    </div>
  );
}
