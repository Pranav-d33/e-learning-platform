"use client";

import {
  ArrowLeft,
  CheckCircle,
  Eye,
  FileText,
  Key,
  Play,
  Printer,
  Quotes,
  Rows,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { ApiError, api } from "@/lib/client/api";
import { startQuiz } from "@/lib/client/quiz";
import { cn } from "@/lib/cn";
import type { Question, Quiz } from "@/lib/tutor/types";
import { SourceDrawer, bareQuote, type DrawerTarget } from "./source-drawer";

interface QuizResponse {
  quiz: Quiz;
  source: { id: string; title: string; isDemo: boolean; pageCount: number } | null;
}

type PaperMode = "student" | "key" | "both";

function AnswerKeyBlock({ q, onOpenSource }: { q: Question; onOpenSource: (t: DrawerTarget) => void }) {
  return (
    <div className="mt-3 rounded-xl border border-ok/30 bg-ok-soft/50 p-3.5 text-sm print:border-ink/30 print:bg-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ok print:text-ink">
          <CheckCircle weight="fill" className="size-4" />
          {q.type === "mcq"
            ? `Correct Option: (${q.correctOptionId}) ${q.options?.find((o) => o.id === q.correctOptionId)?.text ?? q.expectedAnswer}`
            : q.type === "fill_blank"
              ? `Accepted: ${q.acceptedAnswers.join(" / ")}`
              : `Model Answer: ${q.expectedAnswer}`}
        </span>
        <span className="font-mono text-xs font-semibold text-ink-2">
          [{q.rubric.maxScore} {q.rubric.maxScore === 1 ? "mark" : "marks"}]
        </span>
      </div>

      {(q.type === "short_answer" || q.type === "comprehension") && q.rubric.criteria.length > 0 && (
        <div className="mt-2 border-t border-ok/20 pt-2 text-xs text-ink-2">
          <p className="font-semibold text-ink">Marking scheme:</p>
          <ul className="mt-1 space-y-0.5">
            {q.rubric.criteria.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>• {c.criterion}</span>
                <span className="shrink-0 font-mono font-semibold">{c.points}m</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {q.sourceRefs.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-ok/20 pt-2 text-xs text-ink-2">
          <Quotes weight="fill" className="size-3.5 text-accent" />
          <span>Source evidence:</span>
          {q.sourceRefs.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => r.page && onOpenSource({ documentId: r.documentId, page: r.page, quote: r.quote })}
              className="font-semibold text-accent-ink underline hover:text-accent print:no-underline"
            >
              p. {r.page ?? "?"} (“{bareQuote(r.quote).slice(0, 80)}…”)
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PracticePaper({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<QuizResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PaperMode>("student");
  const [showLines, setShowLines] = useState(true);
  const [schoolName, setSchoolName] = useState("Sunny Steps Academy");
  const [durationMins, setDurationMins] = useState("45");
  const [starting, setStarting] = useState(false);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);

  useEffect(() => {
    api<QuizResponse>(`/api/quizzes/${id}`).then(
      (res) => setData(res),
      (err) => setError(err instanceof ApiError ? err.message : "Couldn't load this practice paper."),
    );
  }, [id]);

  async function runInteractive() {
    setStarting(true);
    try {
      router.push(`/tutor/quiz/${await startQuiz(id)}`);
    } catch {
      setStarting(false);
    }
  }

  if (error)
    return (
      <Notice tone="bad" title="Practice paper unavailable" action={<LinkButton href="/tutor" size="sm" variant="secondary">Workspace</LinkButton>}>
        {error}
      </Notice>
    );

  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-[42rem] rounded-2xl" />
      </div>
    );

  const { quiz, source } = data;
  const totalMarks = quiz.questions.reduce((acc, q) => acc + q.rubric.maxScore, 0);

  const sectionA = quiz.questions.filter((q) => q.type === "mcq" || q.type === "fill_blank");
  const sectionB = quiz.questions.filter((q) => q.type === "comprehension");
  const sectionC = quiz.questions.filter((q) => q.type === "short_answer");

  const sections = [
    {
      code: "Section A",
      title: "Objective Type Questions (MCQ & Fill in the Blank)",
      instruction: "Choose the single best option or write the missing word clearly in the blank.",
      items: sectionA,
    },
    {
      code: "Section B",
      title: "Reading Comprehension",
      instruction: "Read the textbook extract carefully and answer the questions that follow in your own words.",
      items: sectionB,
    },
    {
      code: "Section C",
      title: "Short Answer Questions",
      instruction: "Answer each question briefly in 1–3 complete sentences based on the chapter.",
      items: sectionC,
    },
  ].filter((s) => s.items.length > 0);

  let qCounter = 0;

  return (
    <div className="space-y-6">
      {/* Top Interactive Controls (hidden in print) */}
      <div className="space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/tutor/review/${quiz.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"
            >
              <ArrowLeft className="size-4" /> Back to review
            </Link>
            <span className="text-line-2">·</span>
            <Link href="/tutor" className="text-sm font-semibold text-ink-2 hover:text-ink">
              Workspace
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={runInteractive}
              loading={starting}
              icon={<Play weight="fill" className="size-4" />}
            >
              Take online instead
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              icon={<Printer weight="fill" className="size-4" />}
            >
              Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* Customization bar */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-soft">
          <div role="group" aria-label="Paper mode" className="inline-flex rounded-xl bg-paper-2 p-1">
            {(
              [
                { id: "student", label: "Question Paper", icon: FileText },
                { id: "key", label: "With Answer Key", icon: Key },
                { id: "both", label: "Paper + Detached Key", icon: Eye },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  aria-pressed={mode === m.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    mode === m.id ? "bg-surface text-ink shadow-xs" : "text-ink-2 hover:text-ink",
                  )}
                >
                  <Icon weight="duotone" className="size-4" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowLines((v) => !v)}
            aria-pressed={showLines}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
              showLines ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2",
            )}
          >
            <Rows className="size-4" />
            {showLines ? "Writing lines: On" : "Writing lines: Off"}
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor="school-input" className="font-semibold text-ink-2">
              Header:
            </label>
            <Input
              id="school-input"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="h-8 w-44 text-xs"
              placeholder="School / Header"
            />
            <label htmlFor="duration-input" className="font-semibold text-ink-2">
              Mins:
            </label>
            <Input
              id="duration-input"
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
              className="h-8 w-16 text-center text-xs"
            />
          </div>
        </div>
      </div>

      {/* Printable A4 Exam Sheet */}
      <article
        aria-label="Practice question paper"
        className="mx-auto max-w-4xl rounded-2xl border border-line bg-white p-6 text-ink shadow-lift sm:p-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        {/* Formal Exam Banner */}
        <header className="border-b-2 border-ink pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4 text-center sm:text-left">
            <div>
              <p className="font-mono text-xs font-bold tracking-widest text-ink-2 uppercase">
                {schoolName || "Practice Examination Paper"}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{quiz.title}</h1>
              <p className="mt-1 text-sm text-ink-2">
                Source: <span className="font-semibold text-ink">{source?.title ?? "Textbook"}</span>
                {quiz.chapterScope.chapter ? ` · ${quiz.chapterScope.chapter}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 font-mono text-xs">
              <Badge tone="neutral">
                Class {quiz.grade} · {quiz.subject}
              </Badge>
              <p className="mt-1 font-semibold">Time Allowed: {durationMins || "45"} mins</p>
              <p className="text-sm font-bold">Maximum Marks: {totalMarks}</p>
            </div>
          </div>

          {/* Student Fill-in Details Box */}
          {mode !== "key" && (
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-line bg-paper/40 p-3.5 text-xs sm:grid-cols-4 print:border-ink/40">
              <div>
                <span className="font-semibold text-ink-2">Student Name:</span>
                <div className="mt-3 border-b border-dashed border-ink-3" />
              </div>
              <div>
                <span className="font-semibold text-ink-2">Roll No. / Sec:</span>
                <div className="mt-3 border-b border-dashed border-ink-3" />
              </div>
              <div>
                <span className="font-semibold text-ink-2">Date:</span>
                <div className="mt-3 border-b border-dashed border-ink-3" />
              </div>
              <div>
                <span className="font-semibold text-ink-2">Marks Obtained:</span>
                <div className="mt-1 font-mono text-sm font-bold text-ink-2">______ / {totalMarks}</div>
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-ink-2 italic">
            General Instructions: All questions are compulsory. Marks for each question are indicated on the right. Read every
            question carefully before answering.
          </p>
        </header>

        {/* Exam Sections */}
        <div className="mt-8 space-y-9">
          {sections.map((sec) => {
            const secMarks = sec.items.reduce((s, q) => s + q.rubric.maxScore, 0);
            return (
              <section key={sec.code} className="space-y-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                  <div>
                    <h2 className="font-display text-lg font-bold">
                      {sec.code} — {sec.title}
                    </h2>
                    <p className="text-xs text-ink-2">{sec.instruction}</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-ink-2">[{secMarks} Marks]</span>
                </div>

                <ol className="space-y-6">
                  {sec.items.map((q) => {
                    qCounter += 1;
                    return (
                      <li key={q.id} className="break-inside-avoid space-y-2.5">
                        {/* Passage box for Reading Comprehension */}
                        {q.passage && (
                          <div className="rounded-xl border border-line bg-paper/50 p-4 text-sm leading-relaxed print:border-ink/40">
                            <p className="mb-1.5 font-mono text-xs font-semibold text-ink-2 uppercase">
                              Reading Extract {q.passage.title ? `· ${q.passage.title}` : ""}{" "}
                              {q.passage.page ? `(p. ${q.passage.page})` : ""}
                            </p>
                            <p className="whitespace-pre-line">{q.passage.text}</p>
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-4">
                          <p className="text-base leading-snug font-semibold">
                            <span className="mr-2 font-mono text-sm text-ink-2">Q{qCounter}.</span>
                            {q.questionText}
                          </p>
                          <span className="shrink-0 font-mono text-xs font-semibold text-ink-2 tabular">
                            [{q.rubric.maxScore}]
                          </span>
                        </div>

                        {/* MCQ Options Grid */}
                        {q.type === "mcq" && q.options && (
                          <ul className="grid gap-2 pt-1 pl-7 sm:grid-cols-2">
                            {q.options.map((opt) => {
                              const isCorrect = mode === "key" && opt.id === q.correctOptionId;
                              return (
                                <li
                                  key={opt.id}
                                  className={cn(
                                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm",
                                    isCorrect ? "bg-ok-soft font-semibold text-ok" : "text-ink",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "grid size-6 shrink-0 place-items-center rounded-full border font-mono text-xs font-bold",
                                      isCorrect ? "border-ok bg-ok text-white" : "border-ink-3 text-ink-2",
                                    )}
                                  >
                                    {opt.id}
                                  </span>
                                  <span>{opt.text}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {/* Fill in the blank writing box */}
                        {q.type === "fill_blank" && mode !== "key" && showLines && (
                          <div className="pt-1 pl-7">
                            <span className="text-xs font-semibold text-ink-2">Answer: </span>
                            <span className="inline-block w-64 border-b border-dashed border-ink-2" />
                          </div>
                        )}

                        {/* Ruled lines for Short Answer & Comprehension */}
                        {(q.type === "short_answer" || q.type === "comprehension") && mode !== "key" && showLines && (
                          <div className="space-y-5 pt-2 pl-7" aria-hidden="true">
                            {Array.from({ length: Math.max(2, q.rubric.maxScore + 1) }, (_, idx) => (
                              <div key={idx} className="border-b border-dashed border-line-2 print:border-ink/30" />
                            ))}
                          </div>
                        )}

                        {/* Inline Answer Key when in "key" mode */}
                        {mode === "key" && <AnswerKeyBlock q={q} onOpenSource={setDrawer} />}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>

        {/* Detached Answer Key Sheet at bottom when mode === "both" */}
        {mode === "both" && (
          <section className="mt-12 border-t-2 border-dashed border-line pt-10 break-before-page">
            <div className="mb-6 flex items-center justify-between border-b border-line pb-3">
              <div>
                <p className="font-mono text-xs font-bold tracking-widest text-accent uppercase">Teacher Marking Scheme</p>
                <h2 className="font-display text-2xl font-bold">Answer Key & Source Citations — {quiz.title}</h2>
              </div>
              <Badge tone="ok">Verified Grounded Key</Badge>
            </div>
            <ol className="space-y-4">
              {quiz.questions.map((q, idx) => (
                <li key={q.id} className="break-inside-avoid">
                  <p className="text-sm font-semibold">
                    <span className="mr-2 font-mono text-xs text-ink-2">Q{idx + 1}.</span>
                    {q.questionText}
                  </p>
                  <AnswerKeyBlock q={q} onOpenSource={setDrawer} />
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>

      <SourceDrawer target={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
