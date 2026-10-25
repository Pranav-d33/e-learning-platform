import { ArrowRight, CheckCircle, Circle, Play, Quotes, SealCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand";
import { ModeBadge } from "@/components/mode-badge";
import { SiteFooter } from "@/components/site-footer";
import { Skeleton } from "@/components/ui/spinner";
import { publicAiStatus } from "@/lib/ai/config";
import { getLessons } from "@/lib/early/lessons";
import { EN_STROKES } from "@/lib/early/strokes-en";
import { strokeStart } from "@/lib/early/geometry";
import { uploadLimits } from "@/lib/server/http";
import { storageStatus } from "@/lib/store/kv";

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg">
          <BrandMark />
          <span className="font-display text-lg font-semibold tracking-tight">AI Learning Platform</span>
        </Link>
        <nav aria-label="Modules" className="ml-6 hidden items-center gap-1 text-sm font-semibold text-ink-2 md:flex">
          <Link href="/tutor" className="rounded-lg px-3 py-2 hover:bg-paper-2 hover:text-ink">Textbook Tutor</Link>
          <Link href="/early" className="rounded-lg px-3 py-2 hover:bg-paper-2 hover:text-ink">Early Learning</Link>
        </nav>
        <div className="ml-auto">
          <ModeBadge />
        </div>
      </div>
    </header>
  );
}

function QuestionPreview() {
  return (
    <div className="relative mt-8 sm:ml-6" aria-hidden="true">
      <div className="absolute inset-x-6 -bottom-3 h-full rotate-[-2.5deg] rounded-2xl border border-line bg-paper-2" />
      <div className="relative rounded-2xl border border-line bg-surface p-5 shadow-lift">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-ink-3">Q2 · Multiple choice · easy</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">
            <SealCheck weight="fill" className="size-3.5" /> Grounded
          </span>
        </div>
        <p className="mt-2 font-semibold">What colour was Arun&apos;s kite?</p>
        <ul className="mt-3 grid gap-1.5 text-sm">
          {["Blue", "Green", "Red"].map((o, i) => (
            <li
              key={o}
              className={
                i === 2
                  ? "flex items-center gap-2 rounded-lg border border-ok/30 bg-ok-soft px-3 py-1.5 font-semibold text-ok"
                  : "flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-ink-2"
              }
            >
              {i === 2 ? <CheckCircle weight="fill" className="size-4" /> : <Circle className="size-4 text-ink-3" />}
              {o}
            </li>
          ))}
        </ul>
        <p className="mt-3 flex gap-2 border-t border-dashed border-line pt-3 text-xs text-ink-2">
          <Quotes weight="fill" className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span>
            <span className="font-mono font-semibold text-accent-ink">p. 4</span> — “Arun had a bright red kite.”
          </span>
        </p>
      </div>
    </div>
  );
}

function TracePreview() {
  const strokes = EN_STROKES.B;
  return (
    <svg viewBox="0 0 200 200" className="size-44 drop-shadow-sm sm:size-52" aria-hidden="true">
      <rect x="4" y="4" width="192" height="192" rx="34" fill="white" />
      {strokes.map((s) => (
        <path key={s.id} d={s.d} fill="none" stroke="var(--color-guide)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <path d={strokes[0].d} fill="none" stroke="var(--color-trace-ink)" strokeWidth="11" strokeLinecap="round" />
      <path d="M62 30 L106 30 C150 30 150 98 106 98" fill="none" stroke="var(--color-trace-ink)" strokeWidth="11" strokeLinecap="round" />
      {strokes.map((s) => {
        const { start } = strokeStart(s.d);
        return (
          <g key={`n${s.id}`}>
            <circle cx={start.x + (s.id === 2 ? 14 : 0)} cy={start.y} r="9" fill="var(--color-leaf)" />
            <text x={start.x + (s.id === 2 ? 14 : 0)} y={start.y + 3.5} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
              {s.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

async function SystemStatus() {
  await connection();
  const ai = publicAiStatus();
  const storage = storageStatus();
  const limits = uploadLimits();
  const rows: [string, string, boolean][] = [
    ["Question generation", ai.mode === "live" ? `${ai.provider} · ${ai.model}` : "Demo — reviewed seed set & rule-based cloze", ai.mode === "live"],
    ["Open-answer grading", ai.mode === "live" ? "Rubric-based AI grading, criterion by criterion" : "Demo keyword checker (labelled)", ai.mode === "live"],
    ["Retrieval", ai.retrieval === "hybrid" ? `BM25 + ${ai.embeddingModel} embeddings` : "BM25 keyword ranking", true],
    ["Storage", storage.label, storage.durable],
    ["PDF uploads", `Searchable PDFs · up to ${limits.maxMb} MB, ${limits.maxPages} pages`, true],
  ];
  return (
    <dl className="divide-y divide-line rounded-2xl border border-line bg-surface/80 shadow-soft">
      {rows.map(([k, v, good]) => (
        <div key={k} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
          <dt className="text-sm font-semibold text-ink">{k}</dt>
          <dd className="flex items-start gap-2 text-sm text-ink-2">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${good ? "bg-ok" : "bg-warn"}`} aria-hidden="true" />
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function HomePage() {
  const hiCount = getLessons("hi").length;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20">
        <section className="pt-14 pb-10 sm:pt-20">
          <p className="animate-rise text-sm font-semibold text-accent">Working prototype · two learning modules</p>
          <h1 className="animate-rise mt-4 max-w-4xl font-display text-[2.6rem] leading-[1.04] font-semibold tracking-[-0.025em] [animation-delay:60ms] sm:text-6xl lg:text-[4.4rem]">
            Quizzes that cite the page.
            <span className="block text-ink-2 italic [font-variation-settings:'SOFT'_100]">Letters a child can hear, then trace.</span>
          </h1>
          <p className="animate-rise mt-6 max-w-2xl text-lg leading-relaxed text-ink-2 [animation-delay:120ms]">
            Teachers turn a textbook into a quiz where every question shows its source page and can be checked before a
            student sees it. Young children listen to a letter, hear words that start with it, and trace it with a finger.
          </p>
        </section>

        <section aria-label="Choose a module" className="grid gap-5 lg:grid-cols-12">
          <Link
            href="/tutor"
            className="group animate-rise relative flex flex-col overflow-hidden rounded-[1.75rem] border border-line bg-surface p-7 shadow-soft transition-shadow [animation-delay:160ms] hover:shadow-lift sm:p-9 lg:col-span-7"
          >
            <p className="text-sm font-semibold text-accent">For teachers &amp; tutors · Classes 1–10</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Textbook AI Tutor</h2>
            <p className="mt-3 max-w-md text-ink-2">
              Upload a textbook PDF or use the demo reader, choose question types and difficulty, review every question
              with its evidence, then run the quiz and see transparent scoring.
            </p>
            <QuestionPreview />
            <span className="mt-9 inline-flex items-center gap-2 self-start rounded-xl bg-accent px-5 py-3 font-semibold text-white transition-colors group-hover:bg-accent-ink">
              Open the tutor
              <ArrowRight weight="bold" className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href="/early"
            className="group animate-rise dotted-paper relative flex flex-col overflow-hidden rounded-[1.75rem] border border-tang/25 bg-tang-soft p-7 shadow-soft transition-shadow [animation-delay:220ms] hover:shadow-lift sm:p-9 lg:col-span-5"
          >
            <p className="font-kid text-base font-semibold text-tang-deep">For little learners · LKG–UKG</p>
            <h2 className="mt-1 font-kid text-[2.1rem] leading-tight font-bold tracking-tight sm:text-4xl">Early Learning Studio</h2>
            <p className="mt-3 max-w-sm text-ink-2">
              Big buttons, spoken instructions, picture words and gentle feedback. Trace with a finger, mouse or stylus.
            </p>
            <div className="mt-7 flex items-end gap-4" aria-hidden="true">
              <div className="grid gap-3">
                <span className="grid size-24 rotate-[-5deg] place-items-center rounded-3xl bg-sky text-6xl font-bold text-white shadow-[0_5px_0_var(--color-sky-deep)] font-kid">A</span>
                <span className="grid size-20 translate-x-6 rotate-[4deg] place-items-center rounded-3xl bg-berry pt-1 text-5xl font-bold text-white shadow-[0_5px_0_var(--color-berry-deep)] font-kid">अ</span>
              </div>
              <TracePreview />
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-tang px-6 py-3 font-kid text-lg font-bold text-white shadow-[0_4px_0_var(--color-tang-deep)] transition-transform group-hover:-translate-y-0.5">
                <Play weight="fill" className="size-5" /> Start learning
              </span>
              <span className="text-sm font-semibold text-ink-2">English A–Z · हिंदी {hiCount} letters</span>
            </div>
          </Link>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-12" aria-labelledby="real-heading">
          <div className="lg:col-span-4">
            <h2 id="real-heading" className="font-display text-3xl font-semibold tracking-tight">What&apos;s real in this build</h2>
            <p className="mt-3 text-ink-2">
              Everything here runs end to end. Without an API key the platform stays fully usable in a clearly
              labelled demo mode; with one, generation and grading switch to a live model.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-ink-2">
              {[
                "Real PDF text extraction with page provenance",
                "Rule checks on every answer key and citation",
                "Deterministic MCQ and fill-in-the-blank scoring",
                "Tracing scored against the letter's actual strokes",
                "Bundled audio for every letter, word and hint",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-ok" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-8">
            <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
              <SystemStatus />
            </Suspense>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
