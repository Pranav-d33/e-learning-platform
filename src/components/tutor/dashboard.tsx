"use client";

import {
  ArrowRight,
  Books,
  ChartBar,
  Eye,
  FilePdf,
  Lightning,
  ListChecks,
  Play,
  Sparkle,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { ApiError, api } from "@/lib/client/api";
import { startQuiz } from "@/lib/client/quiz";
import { cn } from "@/lib/cn";
import type { Quiz, SourceDocument } from "@/lib/tutor/types";
import { PageHeader, timeAgo } from "./chrome";
import { UploadPanel } from "./upload-panel";

interface QuizSummary {
  id: string;
  title: string;
  createdAt: string;
  status: Quiz["status"];
  grade: number;
  subject: string;
  difficulty: string;
  questionCount: number;
  needsReview: number;
  generator: Quiz["generator"];
  attempts: number;
  lastAttempt: { id: string; totalScore: number; maxScore: number; submittedAt: string } | null;
}

interface Status {
  limits: { maxMb: number; maxPages: number };
}

const STATUS_TONE = { ready: "ok", failed: "bad", uploading: "accent", extracting: "accent", indexing: "accent" } as const;

function DocRow({ doc, highlight, onDelete }: { doc: SourceDocument; highlight: boolean; onDelete: () => void }) {
  const failed = doc.status === "failed";
  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-surface p-4 transition-shadow sm:flex-row sm:items-center sm:p-5",
        highlight ? "border-accent shadow-lift ring-3 ring-accent/15" : "border-line shadow-soft",
      )}
    >
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-xl",
          doc.isDemo ? "bg-sun-soft text-sun-deep" : failed ? "bg-bad-soft text-bad" : "bg-accent-soft text-accent",
        )}
      >
        {doc.isDemo ? <Books weight="duotone" className="size-6" /> : <FilePdf weight="duotone" className="size-6" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{doc.title}</h3>
          <Badge tone={STATUS_TONE[doc.status]}>{doc.status === "ready" ? "Ready" : doc.status === "failed" ? "Failed" : "Processing"}</Badge>
          {doc.isDemo && <Badge tone="neutral">Built-in demo</Badge>}
        </div>
        {failed ? (
          <p className="mt-1 text-sm text-bad">{doc.errorMessage}</p>
        ) : (
          <p className="mt-1 text-sm text-ink-2 tabular">
            Class {doc.grade} · {doc.subject} · {doc.pageCount} pages · {doc.chunkCount} chunks
            {doc.chapters.length ? ` · ${doc.chapters.length} chapters` : ""}
            {doc.embedding ? " · embedded" : ""}
          </p>
        )}
        {doc.lowTextPages.length > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-warn">
            <Warning weight="fill" className="size-3.5" /> {doc.lowTextPages.length} page(s) had little or no text and were skipped
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!failed && (
          <>
            <LinkButton variant="secondary" size="sm" href={`/tutor/document/${doc.id}`} icon={<Eye className="size-4" />}>
              Preview
            </LinkButton>
            <LinkButton size="sm" href={`/tutor/generate?doc=${doc.id}`} icon={<Sparkle weight="fill" className="size-4" />}>
              Build quiz
            </LinkButton>
          </>
        )}
        {!doc.isDemo && (
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${doc.title}`} title="Delete">
            <Trash className="size-4" />
          </Button>
        )}
      </div>
    </li>
  );
}

function QuizRow({ q, onStart, starting }: { q: QuizSummary; onStart: () => void; starting: boolean }) {
  const pct = q.lastAttempt && q.lastAttempt.maxScore ? Math.round((q.lastAttempt.totalScore / q.lastAttempt.maxScore) * 100) : null;
  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/tutor/review/${q.id}`} className="font-semibold hover:text-accent-ink hover:underline">
            {q.title}
          </a>
          <Badge tone={q.status === "ready" ? "ok" : "neutral"}>{q.status === "ready" ? "Ready" : "Draft"}</Badge>
          {q.needsReview > 0 && <Badge tone="warn">{q.needsReview} to check</Badge>}
          <Badge tone={q.generator.mode === "live" ? "accent" : "neutral"} icon={q.generator.mode === "live" ? <Lightning className="size-3" /> : undefined}>
            {q.generator.mode === "live" ? q.generator.model : "Demo"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-ink-2 tabular">
          {q.questionCount} questions · Class {q.grade} {q.subject} · {q.difficulty} · {timeAgo(q.createdAt)}
          {pct !== null && (
            <>
              {" · "}last score <span className="font-semibold text-ink">{q.lastAttempt!.totalScore}/{q.lastAttempt!.maxScore}</span> ({pct}%)
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <LinkButton variant="secondary" size="sm" href={`/tutor/review/${q.id}`} icon={<ListChecks className="size-4" />}>
          Review
        </LinkButton>
        {q.lastAttempt && (
          <LinkButton variant="ghost" size="sm" href={`/tutor/results/${q.lastAttempt.id}`} icon={<ChartBar className="size-4" />}>
            Results
          </LinkButton>
        )}
        <Button size="sm" variant="quiet" onClick={onStart} loading={starting} icon={<Play weight="fill" className="size-4" />}>
          Start
        </Button>
      </div>
    </li>
  );
}

export function TutorDashboard() {
  const router = useRouter();
  const [docs, setDocs] = useState<SourceDocument[] | null>(null);
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SourceDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        api<{ documents: SourceDocument[] }>("/api/documents"),
        api<{ quizzes: QuizSummary[] }>("/api/quizzes"),
        api<Status>("/api/status"),
      ]).then(
        ([d, q, s]) => {
          setDocs(d.documents);
          setQuizzes(q.quizzes);
          setStatus(s);
          setError(null);
        },
        (err) => setError(err instanceof ApiError ? err.message : "Couldn't load your workspace."),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/api/documents/${toDelete.id}`, { method: "DELETE" });
      setToDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  async function start(id: string) {
    setStarting(id);
    setStartError(null);
    try {
      router.push(`/tutor/quiz/${await startQuiz(id)}`);
    } catch (err) {
      setStartError(err instanceof ApiError ? `${err.message} ${((err.details.problems as string[]) ?? []).join(" ")}` : "Couldn't start the quiz.");
      setStarting(null);
    }
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Your workspace"
        description="Pick a source, build a quiz from it, check every question against its page, then hand it to a student."
        actions={
          <LinkButton href="/tutor/generate?doc=demo-reader" icon={<Sparkle weight="fill" className="size-4" />}>
            New quiz
          </LinkButton>
        }
      />

      {error && (
        <Notice tone="bad" title="Something went wrong" action={<Button variant="secondary" size="sm" onClick={load}>Retry</Button>}>
          {error}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <section aria-labelledby="sources-heading" className="lg:col-span-7">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="sources-heading" className="font-display text-xl font-semibold">Sources</h2>
            <p className="text-sm text-ink-3">Only the selected source is used as evidence</p>
          </div>
          {!docs ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <ul className="space-y-3">
              {docs.map((d) => (
                <DocRow key={d.id} doc={d} highlight={d.id === highlight} onDelete={() => setToDelete(d)} />
              ))}
            </ul>
          )}
        </section>
        <div className="lg:col-span-5">
          {status ? (
            <UploadPanel
              maxMb={status.limits.maxMb}
              maxPages={status.limits.maxPages}
              onChanged={(id) => {
                setHighlight(id ?? null);
                void load();
              }}
            />
          ) : (
            <Skeleton className="h-80 rounded-[1.4rem]" />
          )}
        </div>
      </div>

      <section aria-labelledby="quizzes-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="quizzes-heading" className="font-display text-xl font-semibold">Quizzes</h2>
          {quizzes && quizzes.length > 0 && <p className="text-sm text-ink-3">{quizzes.length} saved</p>}
        </div>
        {startError && <Notice tone="bad" className="mb-3">{startError}</Notice>}
        {!quizzes ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : quizzes.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line-2 bg-surface/50 p-8 sm:flex-row sm:items-center">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <ListChecks weight="duotone" className="size-7" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">No quizzes yet</p>
              <p className="text-sm text-ink-2">Build one from the demo reader — it takes about a minute and needs no setup.</p>
            </div>
            <LinkButton href="/tutor/generate?doc=demo-reader" variant="secondary" icon={<ArrowRight className="size-4" />}>
              Build your first quiz
            </LinkButton>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
            {quizzes.map((q) => (
              <QuizRow key={q.id} q={q} starting={starting === q.id} onStart={() => start(q.id)} />
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this document?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete} icon={<Trash className="size-4" />}>
              Delete document
            </Button>
          </>
        }
      >
        “{toDelete?.title}” and its extracted pages and chunks will be removed. Quizzes already built from it keep their
        questions, but you won&apos;t be able to build new ones.
      </Dialog>
    </div>
  );
}
