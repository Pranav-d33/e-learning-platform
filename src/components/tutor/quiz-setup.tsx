"use client";

import {
  ArrowSquareOut,
  BookOpenText,
  CheckCircle,
  Flask,
  Lightning,
  ListChecks,
  Minus,
  PencilLine,
  Plus,
  Sparkle,
  Textbox,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton, Spinner } from "@/components/ui/spinner";
import { ApiError, api, postStream, type StreamEvent } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { planTypeCounts } from "@/lib/tutor/plan";
import { QUESTION_TYPES, TYPE_LABEL, type Difficulty, type QuestionType, type SourceDocument } from "@/lib/tutor/types";
import { PageHeader, Steps } from "./chrome";

const TYPE_META: Record<QuestionType, { icon: React.ReactNode; blurb: string }> = {
  mcq: { icon: <ListChecks weight="duotone" className="size-5" />, blurb: "One correct option, scored exactly" },
  fill_blank: { icon: <Textbox weight="duotone" className="size-5" />, blurb: "A sentence with one missing word" },
  short_answer: { icon: <PencilLine weight="duotone" className="size-5" />, blurb: "One-sentence answer, rubric-graded" },
  comprehension: { icon: <BookOpenText weight="duotone" className="size-5" />, blurb: "Read a passage, then answer" },
};

const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: "A fact stated directly in the text",
  medium: "Understanding or connecting two details",
  challenging: "A simple inference — still answerable from the text",
};

const OBJECTIVES = ["vocabulary", "literal recall", "inference", "sequence of events", "grammar"];

type Scope = "all" | "chapter" | "pages";

interface Status {
  ai: { mode: "live" | "demo"; provider: string | null; model: string | null; retrieval: "bm25" | "hybrid" };
}

const STAGES = [
  { key: "retrieving", label: "Retrieving passages" },
  { key: "generating", label: "Writing questions" },
  { key: "validating", label: "Checking answer keys & citations" },
  { key: "done", label: "Ready for review" },
];

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.4rem] border border-line bg-surface p-5 shadow-soft sm:p-6">
      <h2 className="flex items-center gap-3 font-display text-lg font-semibold">
        <span className="grid size-7 place-items-center rounded-full bg-ink font-sans text-xs font-bold text-paper">{n}</span>
        {title}
      </h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

export function QuizSetup() {
  const router = useRouter();
  const search = useSearchParams();
  const [docs, setDocs] = useState<SourceDocument[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [documentId, setDocumentId] = useState(search.get("doc") ?? "demo-reader");
  const [grade, setGrade] = useState(1);
  const [subject, setSubject] = useState("English");
  const [scope, setScope] = useState<Scope>("all");
  const [chapter, setChapter] = useState("");
  const [pageFrom, setPageFrom] = useState("");
  const [pageTo, setPageTo] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [types, setTypes] = useState<QuestionType[]>([...QUESTION_TYPES]);
  const [objective, setObjective] = useState("");

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; canUseDemo?: boolean; warnings?: string[] } | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    Promise.all([api<{ documents: SourceDocument[] }>("/api/documents"), api<Status>("/api/status")])
      .then(([d, s]) => {
        const ready = d.documents.filter((x) => x.status === "ready");
        setDocs(ready);
        setStatus(s);
        const chosen = ready.find((x) => x.id === documentId) ?? ready[0];
        if (chosen) {
          setDocumentId(chosen.id);
          setGrade(chosen.grade);
          setSubject(chosen.subject);
        }
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load your sources."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once; documentId is only the initial pick
  }, []);

  const doc = docs?.find((d) => d.id === documentId) ?? null;
  const plan = useMemo(() => planTypeCounts(types, count), [types, count]);

  const problems = useMemo(() => {
    const p: Record<string, string> = {};
    if (types.length === 0) p.types = "Choose at least one question type.";
    if (count < 1 || count > 20) p.count = "Ask for 1–20 questions.";
    if (scope === "chapter" && !chapter) p.scope = "Choose a chapter.";
    if (scope === "pages") {
      const a = Number(pageFrom), b = Number(pageTo);
      const max = doc?.pageCount ?? 1;
      if (!a || !b) p.scope = "Enter both page numbers.";
      else if (a < 1 || b > max || a > b) p.scope = `Use a range within pages 1–${max}, first page before last.`;
    }
    if (!subject.trim()) p.subject = "Enter a subject.";
    return p;
  }, [types, count, scope, chapter, pageFrom, pageTo, doc, subject]);

  const demoUnsupported =
    status?.ai.mode === "demo" && doc && !doc.isDemo ? types.filter((t) => t === "short_answer" || t === "comprehension") : [];

  async function generate(forceDemo = false) {
    setTouched(true);
    if (Object.keys(problems).length || !doc) return;
    setRunning(true);
    setError(null);
    setStage("retrieving");
    setDetail(null);
    try {
      const last = await postStream(
        "/api/quizzes/generate",
        {
          documentId,
          grade,
          subject: subject.trim(),
          scope: {
            chapter: scope === "chapter" ? chapter : null,
            pageFrom: scope === "pages" ? Number(pageFrom) : null,
            pageTo: scope === "pages" ? Number(pageTo) : null,
          },
          questionCount: count,
          difficulty,
          questionTypes: types,
          learningObjective: objective,
          forceDemo,
        },
        (e: StreamEvent) => {
          if (e.stage === "generating") {
            setStage("generating");
            const pages = (e.pages as number[]) ?? [];
            setDetail(
              `${e.sources} passage${e.sources === 1 ? "" : "s"} from ${pages.length > 1 ? `pages ${pages[0]}–${pages.at(-1)}` : `page ${pages[0]}`} · ${e.retrieval === "hybrid" ? "hybrid retrieval" : "BM25"} · ${e.mode === "live" ? "live model" : "demo generator"}`,
            );
          }
          if (e.stage === "validating") setStage("validating");
          if (e.stage === "judging") setDetail(`AI evidence check on ${e.count} questions`);
        },
      );
      if (last.stage === "done") {
        setStage("done");
        router.push(`/tutor/review/${last.quizId}`);
        return;
      }
      setError({ message: last.message ?? "Generation failed.", canUseDemo: !!last.canUseDemo, warnings: last.warnings as string[] | undefined });
    } catch (err) {
      setError({ message: err instanceof ApiError ? err.message : "Generation failed." });
    }
    setRunning(false);
    setStage(null);
  }

  if (loadError) return <Notice tone="bad" title="Couldn't load quiz setup">{loadError}</Notice>;
  if (!docs || !status)
    return (
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-40" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-80 lg:col-span-5" />
      </div>
    );

  const stageIndex = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<Steps current="Set up" />}
        title="Build a quiz"
        description="Questions are written only from the selected source. Each one keeps an answer key and the page it came from."
      />
      <form
        className="grid items-start gap-6 lg:grid-cols-12"
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
        noValidate
      >
        <div className="space-y-5 lg:col-span-7">
          <Section n={1} title="Source">
            <Field label="Document" htmlFor="doc" hint={doc ? `${doc.pageCount} pages · ${doc.chunkCount} chunks${doc.chapters.length ? ` · ${doc.chapters.length} chapters` : ""}` : undefined}>
              <Select
                id="doc"
                value={documentId}
                onChange={(e) => {
                  const d = docs.find((x) => x.id === e.target.value);
                  setDocumentId(e.target.value);
                  setScope("all");
                  setChapter("");
                  if (d) {
                    setGrade(d.grade);
                    setSubject(d.subject);
                  }
                }}
              >
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </Select>
            </Field>
            {doc && (
              <Link href={`/tutor/document/${doc.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-ink hover:underline">
                Preview extracted text <ArrowSquareOut className="size-4" />
              </Link>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Class" htmlFor="grade" hint="Difficulty is judged relative to this class.">
                <Select id="grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Class {i + 1}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Subject" htmlFor="subject" error={touched ? problems.subject : null}>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={40} aria-invalid={touched && !!problems.subject} />
              </Field>
            </div>
          </Section>

          <Section n={2} title="Scope">
            <Segmented<Scope>
              label="Scope"
              value={scope}
              onChange={setScope}
              className="flex w-full sm:w-auto"
              options={[
                { value: "all", label: "Whole document" },
                { value: "chapter", label: "A chapter" },
                { value: "pages", label: "Page range" },
              ]}
            />
            {scope === "chapter" &&
              (doc?.chapters.length ? (
                <Field label="Chapter" htmlFor="chapter" error={touched ? problems.scope : null}>
                  <Select id="chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} aria-invalid={touched && !!problems.scope}>
                    <option value="">Choose a chapter…</option>
                    {doc.chapters.map((c) => (
                      <option key={c.title} value={c.title}>
                        {c.title} (p. {c.pageStart}
                        {c.pageEnd > c.pageStart ? `–${c.pageEnd}` : ""})
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Notice tone="info">No chapter headings were detected in this document. Use a page range instead.</Notice>
              ))}
            {scope === "pages" && (
              <div className="grid max-w-sm grid-cols-2 gap-3">
                <Field label="From page" htmlFor="pfrom">
                  <Input id="pfrom" type="number" inputMode="numeric" min={1} max={doc?.pageCount} value={pageFrom} onChange={(e) => setPageFrom(e.target.value)} aria-invalid={touched && !!problems.scope} />
                </Field>
                <Field label="To page" htmlFor="pto">
                  <Input id="pto" type="number" inputMode="numeric" min={1} max={doc?.pageCount} value={pageTo} onChange={(e) => setPageTo(e.target.value)} aria-invalid={touched && !!problems.scope} />
                </Field>
                {touched && problems.scope && <p className="col-span-2 text-xs font-medium text-bad" role="alert">{problems.scope}</p>}
              </div>
            )}
            {scope === "all" && <p className="text-sm text-ink-2">All indexed text in this document can be used as evidence.</p>}
          </Section>

          <Section n={3} title="Questions">
            <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
              <Field label="How many" htmlFor="count" error={touched ? problems.count : null}>
                <div className="flex items-center gap-1 rounded-xl border border-line-2 bg-surface p-1">
                  <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} className="press grid size-9 place-items-center rounded-lg hover:bg-paper-2" aria-label="Fewer questions">
                    <Minus weight="bold" className="size-4" />
                  </button>
                  <input
                    id="count"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(e) => setCount(Math.round(Number(e.target.value)) || 0)}
                    className="w-12 bg-transparent text-center text-lg font-semibold tabular focus-visible:outline-none"
                  />
                  <button type="button" onClick={() => setCount((c) => Math.min(20, c + 1))} className="press grid size-9 place-items-center rounded-lg hover:bg-paper-2" aria-label="More questions">
                    <Plus weight="bold" className="size-4" />
                  </button>
                </div>
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Difficulty</span>
                <Segmented<Difficulty>
                  label="Difficulty"
                  value={difficulty}
                  onChange={setDifficulty}
                  className="flex"
                  options={[
                    { value: "easy", label: "Easy" },
                    { value: "medium", label: "Medium" },
                    { value: "challenging", label: "Challenging" },
                  ]}
                />
                <p className="text-xs text-ink-2">{DIFFICULTY_HINT[difficulty]} (for Class {grade}).</p>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold">Question types</legend>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                {QUESTION_TYPES.map((t) => {
                  const on = types.includes(t);
                  return (
                    <label
                      key={t}
                      className={cn(
                        "press flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-accent/30",
                        on ? "border-accent bg-accent-soft/60" : "border-line-2 bg-surface hover:border-ink-3",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => setTypes((cur) => (on ? cur.filter((x) => x !== t) : QUESTION_TYPES.filter((x) => cur.includes(x) || x === t)))}
                      />
                      <span className={cn("mt-0.5", on ? "text-accent" : "text-ink-3")}>{TYPE_META[t].icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{TYPE_LABEL[t]}</span>
                        <span className="block text-xs text-ink-2">{TYPE_META[t].blurb}</span>
                      </span>
                      <CheckCircle weight="fill" className={cn("size-5 shrink-0 transition-opacity", on ? "text-accent opacity-100" : "opacity-0")} />
                    </label>
                  );
                })}
              </div>
              {touched && problems.types && <p className="mt-2 text-xs font-medium text-bad" role="alert">{problems.types}</p>}
            </fieldset>

            <Field label="Learning objective (optional)" htmlFor="objective" hint="Used to pick the most relevant passages.">
              <Input id="objective" value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={200} placeholder="e.g. vocabulary from the kite story" />
            </Field>
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {OBJECTIVES.map((o) => (
                <button key={o} type="button" onClick={() => setObjective(o)} className="press rounded-lg border border-line bg-paper/70 px-2.5 py-1 text-xs font-semibold text-ink-2 hover:border-ink-3 hover:text-ink">
                  {o}
                </button>
              ))}
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:col-span-5">
          <div className="rounded-[1.4rem] border border-line bg-surface p-5 shadow-lift sm:p-6">
            <p className="text-sm font-semibold text-ink-3">This quiz</p>
            <p className="mt-1 font-display text-4xl font-semibold tabular">
              {count} <span className="text-xl text-ink-2">question{count === 1 ? "" : "s"}</span>
            </p>
            <ul className="mt-4 space-y-2">
              {QUESTION_TYPES.filter((t) => plan[t] > 0).map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 text-ink-2">{TYPE_LABEL[t]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-2">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(plan[t] / Math.max(1, count)) * 100}%` }} />
                  </span>
                  <span className="w-5 text-right font-semibold tabular">{plan[t]}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-ink-3">Source</dt>
                <dd className="font-medium">{doc?.title ?? "—"}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-ink-3">Scope</dt>
                <dd className="font-medium">
                  {scope === "all" ? "Whole document" : scope === "chapter" ? chapter || "Choose a chapter" : pageFrom && pageTo ? `Pages ${pageFrom}–${pageTo}` : "Choose pages"}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-ink-3">Level</dt>
                <dd className="font-medium capitalize">
                  Class {grade} · {difficulty}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl bg-paper-2/70 p-3.5 text-sm">
              {status.ai.mode === "live" ? (
                <p className="flex gap-2">
                  <Lightning weight="duotone" className="mt-0.5 size-4 shrink-0 text-ok" />
                  <span>
                    <strong>Live:</strong> {status.ai.provider} <span className="font-mono text-xs">{status.ai.model}</span> writes the
                    questions; every answer key is then checked against its cited text.
                  </span>
                </p>
              ) : (
                <p className="flex gap-2">
                  <Flask weight="duotone" className="mt-0.5 size-4 shrink-0 text-warn" />
                  <span>
                    <strong>Demo:</strong>{" "}
                    {doc?.isDemo
                      ? "questions come from the reader's reviewed, source-tied question set."
                      : "fill-in-the-blank and word-choice questions are built from real sentences in your PDF."}
                  </span>
                </p>
              )}
              {demoUnsupported.length > 0 && (
                <p className="mt-2 text-xs text-warn">
                  {demoUnsupported.map((t) => TYPE_LABEL[t]).join(" and ")} need live AI mode for uploaded PDFs — they&apos;ll be skipped.
                </p>
              )}
            </div>

            {!running && (
              <Button type="submit" size="lg" className="mt-5 w-full" icon={<Sparkle weight="fill" className="size-5" />}>
                Generate {count} question{count === 1 ? "" : "s"}
              </Button>
            )}
            {touched && Object.keys(problems).length > 0 && !running && (
              <p className="mt-2 text-center text-xs font-medium text-bad">Fix the highlighted fields first.</p>
            )}

            {running && (
              <ol className="mt-5 space-y-3" aria-live="polite">
                {STAGES.map((s, i) => {
                  const state = i < stageIndex ? "done" : i === stageIndex ? "active" : "todo";
                  return (
                    <li key={s.key} className="flex gap-3">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
                        {state === "done" ? <CheckCircle weight="fill" className="size-5 text-ok" /> : state === "active" ? <Spinner className="size-4.5 text-accent" /> : <span className="size-3.5 rounded-full border-2 border-line-2" />}
                      </span>
                      <div>
                        <p className={cn("text-sm font-semibold", state === "todo" && "text-ink-3")}>{s.label}</p>
                        {state === "active" && detail && <p className="text-xs text-ink-2">{detail}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {error && (
              <Notice
                tone="bad"
                title="No quiz this time"
                className="mt-4"
                action={
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="secondary" onClick={() => generate()}>
                      Try again
                    </Button>
                    {error.canUseDemo && (
                      <Button size="sm" variant="ghost" onClick={() => generate(true)}>
                        Use demo generator
                      </Button>
                    )}
                  </div>
                }
              >
                <p>{error.message}</p>
                {error.warnings?.map((w) => (
                  <p key={w} className="mt-1 text-xs">
                    {w}
                  </p>
                ))}
              </Notice>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}
