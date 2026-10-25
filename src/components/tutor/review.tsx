"use client";

import {
  ArrowsClockwise,
  CaretDown,
  CheckCircle,
  Circle,
  PencilSimple,
  Play,
  Quotes,
  SealCheck,
  SlidersHorizontal,
  Trash,
  UserCircleCheck,
  Warning,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { ApiError, api } from "@/lib/client/api";
import { startQuiz } from "@/lib/client/quiz";
import { cn } from "@/lib/cn";
import { TYPE_LABEL, type Question, type Quiz } from "@/lib/tutor/types";
import { PageHeader, Steps } from "./chrome";
import { QuestionEditor, type QuestionPatch } from "./question-editor";
import { SourceDrawer, bareQuote, type DrawerTarget } from "./source-drawer";

interface QuizResponse {
  quiz: Quiz;
  source: { id: string; title: string; isDemo: boolean; pageCount: number } | null;
  startProblems: string[];
}

export function StatusBadge({ q }: { q: Question }) {
  if (q.groundingStatus === "verified")
    return (
      <Badge tone="ok" icon={<SealCheck weight="fill" className="size-3.5" />}>
        Verified against source
      </Badge>
    );
  if (q.groundingStatus === "teacher_edited")
    return (
      <Badge tone="accent" icon={<UserCircleCheck weight="fill" className="size-3.5" />}>
        Teacher edited
      </Badge>
    );
  return (
    <Badge tone="warn" icon={<Warning weight="fill" className="size-3.5" />}>
      Needs review
    </Badge>
  );
}

const ORIGIN: Record<Question["origin"], string> = {
  llm: "Generated from textbook (AI)",
  demo_bank: "From the reader's reviewed question set",
  demo_rule: "Generated from textbook (rule-based demo)",
};

export function Citations({ q, onOpen }: { q: Question; onOpen: (t: DrawerTarget) => void }) {
  if (q.sourceRefs.length === 0) return <p className="text-sm text-warn">No source reference — check this question before using it.</p>;
  return (
    <ul className="space-y-1.5">
      {q.sourceRefs.map((r, i) => (
        <li key={i} className="flex gap-2 text-sm text-ink-2">
          <Quotes weight="fill" className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            {r.page ? (
              <button
                type="button"
                onClick={() => onOpen({ documentId: r.documentId, page: r.page!, quote: r.quote })}
                className="mr-1 rounded font-semibold whitespace-nowrap text-accent-ink tabular underline decoration-accent-line underline-offset-3 hover:decoration-accent"
                aria-label={`Open page ${r.page} of the source`}
              >
                p. {r.page}
              </button>
            ) : (
              <span className="mr-1 font-semibold">page ?</span>
            )}
            — “{bareQuote(r.quote)}”
          </span>
        </li>
      ))}
    </ul>
  );
}

function AnswerKey({ q }: { q: Question }) {
  if (q.type === "mcq")
    return (
      <ul className="mt-3 grid gap-1.5" aria-label="Options">
        {q.options?.map((o) => {
          const ok = o.id === q.correctOptionId;
          return (
            <li
              key={o.id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                ok ? "border-ok/30 bg-ok-soft font-semibold text-ok" : "border-line text-ink-2",
              )}
            >
              {ok ? <CheckCircle weight="fill" className="size-4 shrink-0" /> : <Circle className="size-4 shrink-0 text-ink-3" />}
              <span className="font-mono text-xs">{o.id}</span>
              <span>{o.text}</span>
              {ok && <span className="ml-auto text-xs">Answer key</span>}
            </li>
          );
        })}
      </ul>
    );
  if (q.type === "fill_blank")
    return (
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
        <span className="font-semibold text-ink-2">Accepted:</span>
        {q.acceptedAnswers.map((a) => (
          <span key={a} className="rounded-md bg-ok-soft px-2 py-0.5 font-semibold text-ok">
            {a}
          </span>
        ))}
      </p>
    );
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-ok-soft/60 p-3 text-sm">
        <p className="text-xs font-semibold text-ok">Expected answer</p>
        <p className="mt-1">{q.expectedAnswer}</p>
      </div>
      <div className="rounded-xl bg-paper-2/70 p-3 text-sm">
        <p className="text-xs font-semibold text-ink-2">Rubric · max {q.rubric.maxScore}</p>
        <ul className="mt-1 space-y-1">
          {q.rubric.criteria.map((c) => (
            <li key={c.id} className="flex justify-between gap-3">
              <span>{c.criterion}</span>
              <span className="shrink-0 font-semibold tabular">{c.points} pt</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  n,
  quizId,
  onQuiz,
  onOpenSource,
}: {
  q: Question;
  n: number;
  quizId: string;
  onQuiz: (r: QuizResponse) => void;
  onOpenSource: (t: DrawerTarget) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"regen" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: "regen" | "delete") {
    setBusy(kind);
    setError(null);
    try {
      const r =
        kind === "regen"
          ? await api<QuizResponse>(`/api/quizzes/${quizId}/questions/${q.id}/regenerate`, { method: "POST" })
          : await api<QuizResponse>(`/api/quizzes/${quizId}/questions/${q.id}`, { method: "DELETE" });
      setConfirmDelete(false);
      onQuiz(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
      setBusy(null);
    }
  }

  async function save(patch: QuestionPatch) {
    try {
      const r = await api<QuizResponse>(`/api/quizzes/${quizId}/questions/${q.id}`, { method: "PATCH", json: patch });
      setEditing(false);
      onQuiz(r);
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : "Couldn't save the edit.");
    }
  }

  return (
    <article id={`q-${q.id}`} className={cn("animate-rise scroll-mt-24 rounded-2xl border bg-surface shadow-soft", q.groundingStatus === "needs_review" ? "border-warn/35" : "border-line")}>
      <header className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <span className="font-mono text-sm font-semibold text-ink-3">Q{n}</span>
        <Badge tone="neutral">{TYPE_LABEL[q.type]}</Badge>
        <span className="text-xs text-ink-3 first-letter:uppercase">
          {q.difficulty} · {q.learningObjective}
        </span>
        <span className="ml-auto">
          <StatusBadge q={q} />
        </span>
      </header>
      <div className="px-5 pt-3 pb-5">
        {editing ? (
          <QuestionEditor question={q} onSave={save} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <p className="text-[1.05rem] leading-snug font-semibold">{q.questionText}</p>
            {q.passage && (
              <details className="group mt-3 rounded-xl border border-line bg-paper/60">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-ink-2">
                  <CaretDown className="size-4 transition-transform group-open:rotate-180" />
                  Passage shown to the student{q.passage.page ? ` · p. ${q.passage.page}` : ""}
                </summary>
                <p className="px-3.5 pb-3.5 text-sm leading-relaxed whitespace-pre-line">{q.passage.text}</p>
              </details>
            )}
            <AnswerKey q={q} />
            {q.groundingIssues.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-[oklch(0.42_0.09_70)]">
                {q.groundingIssues.map((i) => (
                  <li key={i} className="flex gap-2">
                    <Warning weight="fill" className="mt-0.5 size-4 shrink-0" />
                    {i}
                  </li>
                ))}
              </ul>
            )}
            {q.teacherNote && <p className="mt-3 text-sm text-ink-2">Note: {q.teacherNote}</p>}
          </>
        )}
        <div className="mt-4 border-t border-dashed border-line pt-3">
          <p className="mb-1.5 text-xs font-semibold text-ink-3">Evidence · {ORIGIN[q.origin]}</p>
          <Citations q={q} onOpen={onOpenSource} />
        </div>
        {error && <Notice tone="bad" className="mt-3">{error}</Notice>}
      </div>
      {!editing && (
        <footer className="flex flex-wrap gap-1.5 rounded-b-2xl border-t border-line bg-paper/50 px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} icon={<PencilSimple className="size-4" />}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => act("regen")} loading={busy === "regen"} icon={<ArrowsClockwise className="size-4" />}>
            Replace with a new one
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto text-bad hover:bg-bad-soft hover:text-bad" onClick={() => setConfirmDelete(true)} icon={<Trash className="size-4" />}>
            Delete
          </Button>
        </footer>
      )}
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete question ${n}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep it</Button>
            <Button variant="danger" loading={busy === "delete"} onClick={() => act("delete")}>Delete question</Button>
          </>
        }
      >
        “{q.questionText}” will be removed from this quiz. You can generate a replacement later from the setup screen.
      </Dialog>
    </article>
  );
}

export function QuizReview({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<QuizResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "review">("all");
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [starting, setStarting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAllWarnings, setShowAllWarnings] = useState(false);

  useEffect(() => {
    api<QuizResponse>(`/api/quizzes/${id}`).then(setData, (err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't load this quiz."),
    );
  }, [id]);

  async function start() {
    setStarting(true);
    setActionError(null);
    try {
      router.push(`/tutor/quiz/${await startQuiz(id)}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? [err.message, ...((err.details.problems as string[]) ?? [])].join(" ") : "Couldn't start the quiz.");
      setStarting(false);
      setConfirmStart(false);
    }
  }

  async function discard() {
    setDiscarding(true);
    try {
      await api(`/api/quizzes/${id}`, { method: "DELETE" });
      router.push("/tutor");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't discard the quiz.");
      setDiscarding(false);
      setConfirmDiscard(false);
    }
  }

  if (error && !data)
    return (
      <Notice tone="bad" title="Quiz unavailable" action={<LinkButton variant="secondary" size="sm" href="/tutor">Workspace</LinkButton>}>
        {error}
      </Notice>
    );
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );

  const { quiz, startProblems } = data;
  const flagged = quiz.questions.filter((q) => q.groundingStatus === "needs_review");
  const shown = filter === "review" ? flagged : quiz.questions;
  const warnings = showAllWarnings ? quiz.warnings : quiz.warnings.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Steps current="Review" />}
        title="Review before a student sees it"
        description={
          <>
            <span className="font-semibold text-ink">{quiz.title}</span> · Class {quiz.grade} {quiz.subject} · {quiz.difficulty} ·{" "}
            {quiz.generator.mode === "live" ? `written by ${quiz.generator.model}` : "demo generator"} ·{" "}
            {quiz.generator.retrieval === "hybrid" ? "hybrid retrieval" : "BM25 retrieval"}
          </>
        }
        actions={
          <Button variant="ghost" onClick={() => setConfirmDiscard(true)} icon={<Trash className="size-4" />}>
            Discard quiz
          </Button>
        }
      />

      {quiz.warnings.length > 0 && (
        <Notice tone="warn" title="Notes from generation">
          <ul className="list-disc space-y-1 pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {quiz.warnings.length > 3 && (
            <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => setShowAllWarnings((v) => !v)}>
              {showAllWarnings ? "Show fewer" : `Show all ${quiz.warnings.length}`}
            </button>
          )}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "review"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              "press rounded-lg px-3 py-1.5 text-sm font-semibold",
              filter === f ? "bg-ink text-paper" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink",
            )}
          >
            {f === "all" ? `All questions (${quiz.questions.length})` : `Needs review (${flagged.length})`}
          </button>
        ))}
        <p className="ml-auto text-sm text-ink-3">Citations open the exact page the evidence came from.</p>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-2 bg-surface/60 p-8 text-center">
          <p className="font-semibold">{filter === "review" ? "Nothing needs review." : "This quiz has no questions left."}</p>
          <p className="mt-1 text-sm text-ink-2">
            {filter === "review" ? "Every remaining question passed the source checks or was edited by you." : "Adjust the setup to generate a new set."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              n={quiz.questions.indexOf(q) + 1}
              quizId={quiz.id}
              onQuiz={(r) => setData(r)}
              onOpenSource={setDrawer}
            />
          ))}
        </div>
      )}

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lift backdrop-blur sm:flex-row sm:items-center sm:pl-5">
        <div className="text-sm">
          {startProblems.length ? (
            <p className="font-semibold text-bad">{startProblems[0]}</p>
          ) : flagged.length ? (
            <p>
              <span className="font-semibold text-warn">{flagged.length} to check</span>
              <span className="text-ink-2"> · {quiz.questions.length} questions</span>
            </p>
          ) : (
            <p>
              <span className="font-semibold text-ok">All {quiz.questions.length} questions checked</span>
              <span className="text-ink-2"> · ready for a student</span>
            </p>
          )}
          {actionError && <p className="text-bad">{actionError}</p>}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <LinkButton variant="secondary" href={`/tutor/generate?doc=${quiz.documentIds[0]}`} icon={<SlidersHorizontal className="size-4" />}>
            Adjust setup
          </LinkButton>
          <Button
            onClick={() => (flagged.length ? setConfirmStart(true) : start())}
            loading={starting}
            disabled={startProblems.length > 0 || quiz.questions.length === 0}
            icon={<Play weight="fill" className="size-4" />}
          >
            Start quiz
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmStart}
        onClose={() => setConfirmStart(false)}
        title={`${flagged.length} question${flagged.length === 1 ? " is" : "s are"} still flagged`}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setConfirmStart(false); setFilter("review"); }}>
              Check them first
            </Button>
            <Button onClick={start} loading={starting}>Start anyway</Button>
          </>
        }
      >
        Flagged questions may have an answer key that isn&apos;t clearly supported by the source. You can edit, replace or
        delete them — or start now and review the results afterwards.
      </Dialog>
      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard this quiz?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>Keep it</Button>
            <Button variant="danger" loading={discarding} onClick={discard}>Discard quiz</Button>
          </>
        }
      >
        The questions will be deleted. The source document stays in your workspace.
      </Dialog>
      <SourceDrawer target={drawer} onClose={() => setDrawer(null)} />
      <p className="text-center text-sm text-ink-3">
        Back to <Link className="font-semibold underline" href="/tutor">workspace</Link>
      </p>
    </div>
  );
}
