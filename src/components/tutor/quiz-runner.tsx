"use client";

import { ArrowLeft, ArrowRight, BookOpenText, CheckCircle, Circle, PaperPlaneTilt } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { Skeleton, Spinner } from "@/components/ui/spinner";
import { ApiError, api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import type { AnswerInput, StudentQuestion } from "@/lib/tutor/types";

interface AttemptView {
  attempt: { id: string; quizId: string; startedAt: string; submittedAt: string | null };
  quiz: { id: string; title: string; grade: number; subject: string; count: number };
  questions: StudentQuestion[];
}

const PROMPT: Record<StudentQuestion["type"], string> = {
  mcq: "Choose one answer",
  fill_blank: "Write the missing word",
  short_answer: "Write your answer in a sentence",
  comprehension: "Read the passage, then answer",
};

function answered(q: StudentQuestion, a: AnswerInput | undefined) {
  return q.type === "mcq" ? !!a?.optionId : !!a?.text?.trim();
}

function Options({ q, value, onChange }: { q: StudentQuestion; value: string | undefined; onChange: (id: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const opts = q.options ?? [];
  function onKey(e: React.KeyboardEvent, i: number) {
    const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? i + 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const j = (next + opts.length) % opts.length;
    onChange(opts[j].id);
    refs.current[j]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={q.questionText} className="mt-6 grid gap-3">
      {opts.map((o, i) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (!value && i === 0) ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "press flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left text-[1.05rem] font-semibold",
              on ? "border-accent bg-accent-soft text-ink" : "border-line-2 bg-surface hover:border-accent-line hover:bg-accent-soft/40",
            )}
          >
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold", on ? "bg-accent text-white" : "bg-paper-2 text-ink-2")}>
              {o.label}
            </span>
            <span className="flex-1">{o.text}</span>
            {on && <CheckCircle weight="fill" className="size-6 text-accent" />}
          </button>
        );
      })}
      <p className="text-xs text-ink-3">Tip: press 1–{opts.length} or use the arrow keys.</p>
    </div>
  );
}

export function QuizRunner({ id }: { id: string }) {
  const router = useRouter();
  const storageKey = `alp:attempt:${id}`;
  const [data, setData] = useState<AttemptView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerInput>>({});
  const [reviewing, setReviewing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    api<AttemptView>(`/api/attempts/${id}`)
      .then((d) => {
        if (d.attempt.submittedAt) return router.replace(`/tutor/results/${id}`);
        setData(d);
        try {
          const saved = sessionStorage.getItem(storageKey);
          if (saved) setAnswers(JSON.parse(saved));
        } catch {
          /* storage unavailable: answers live in memory only */
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't open this quiz."));
  }, [id, router, storageKey]);

  const setAnswer = useCallback(
    (qid: string, a: AnswerInput) => {
      setAnswers((cur) => {
        const next = { ...cur, [qid]: a };
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey],
  );

  const q = data?.questions[idx];

  useEffect(() => {
    if (!q || reviewing) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, dialog")) return;
      if (q!.type === "mcq" && /^[1-4]$/.test(e.key)) {
        const opt = q!.options?.[Number(e.key) - 1];
        if (opt) setAnswer(q!.id, { optionId: opt.id });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, reviewing, setAnswer]);

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    setConfirm(false);
    try {
      await api(`/api/attempts/${id}/submit`, { method: "POST", json: { answers } });
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      router.replace(`/tutor/results/${id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't submit. Your answers are still here — try again.");
      setSubmitting(false);
    }
  }

  if (error)
    return (
      <Notice tone="bad" title="This quiz can't be opened" action={<LinkButton variant="secondary" size="sm" href="/tutor">Teacher view</LinkButton>}>
        {error}
      </Notice>
    );
  if (!data || !q)
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-3" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );

  const total = data.questions.length;
  const done = data.questions.filter((x) => answered(x, answers[x.id])).length;
  const unanswered = data.questions.map((x, i) => (answered(x, answers[x.id]) ? null : i + 1)).filter((x): x is number => x !== null);

  if (submitting)
    return (
      <div className="grid min-h-[50vh] place-items-center text-center" aria-live="polite">
        <div>
          <Spinner className="mx-auto size-10 text-accent" />
          <p className="mt-4 font-display text-2xl font-semibold">Checking your answers…</p>
          <p className="mt-1 text-ink-2">Written answers are being compared with the rubric. This can take a few seconds.</p>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="truncate text-sm font-semibold text-ink-2">{data.quiz.title}</h1>
          <p className="shrink-0 text-sm font-semibold tabular">
            {reviewing ? `${done} of ${total} answered` : `Question ${idx + 1} of ${total}`}
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Answered">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <nav aria-label="Questions" className="mt-3 flex flex-wrap gap-1.5">
          {data.questions.map((x, i) => {
            const a = answered(x, answers[x.id]);
            const current = !reviewing && i === idx;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  setIdx(i);
                  setReviewing(false);
                }}
                aria-label={`Question ${i + 1}${a ? ", answered" : ", not answered"}`}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "press grid size-8 place-items-center rounded-lg text-xs font-bold tabular",
                  current ? "bg-ink text-paper" : a ? "bg-accent-soft text-accent-ink ring-1 ring-accent-line" : "bg-surface text-ink-3 ring-1 ring-line",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </nav>
      </div>

      {reviewing ? (
        <section className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Ready to hand in?</h2>
          <p className="mt-1 text-ink-2">Check your answers. You can still go back and change any of them.</p>
          <ul className="mt-5 divide-y divide-line rounded-2xl border border-line">
            {data.questions.map((x, i) => {
              const a = answers[x.id];
              const ok = answered(x, a);
              const shown = x.type === "mcq" ? x.options?.find((o) => o.id === a?.optionId)?.text : a?.text;
              return (
                <li key={x.id}>
                  <button type="button" onClick={() => { setIdx(i); setReviewing(false); }} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-paper/60">
                    {ok ? <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-accent" /> : <Circle className="mt-0.5 size-5 shrink-0 text-ink-3" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {i + 1}. {x.questionText}
                      </span>
                      <span className={cn("block truncate text-sm", ok ? "text-ink-2" : "text-warn")}>{ok ? shown : "Not answered yet"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {submitError && <Notice tone="bad" className="mt-4">{submitError}</Notice>}
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <Button variant="secondary" onClick={() => setReviewing(false)} icon={<ArrowLeft className="size-4" />}>
              Keep working
            </Button>
            <Button size="lg" onClick={() => (unanswered.length ? setConfirm(true) : submit())} icon={<PaperPlaneTilt weight="fill" className="size-5" />}>
              Submit answers
            </Button>
          </div>
        </section>
      ) : (
        <article key={q.id} className="animate-rise rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
          <p className="text-sm font-semibold text-accent">{PROMPT[q.type]}</p>
          {q.passage && (
            <div className="mt-4 rounded-2xl border border-sun/40 bg-sun-soft/60 p-5">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-sun-deep">
                <BookOpenText weight="duotone" className="size-4" /> Passage{q.passage.title ? ` · ${q.passage.title}` : ""}
              </p>
              <p className="font-display text-[1.08rem] leading-relaxed whitespace-pre-line">{q.passage.text}</p>
            </div>
          )}
          <h2 className="mt-4 font-display text-[1.6rem] leading-snug font-semibold tracking-tight sm:text-3xl">{q.questionText}</h2>
          {q.type === "mcq" && <Options q={q} value={answers[q.id]?.optionId} onChange={(optionId) => setAnswer(q.id, { optionId })} />}
          {q.type === "fill_blank" && (
            <div className="mt-6">
              <label htmlFor={`a-${q.id}`} className="block text-sm font-semibold text-ink-2">
                Missing word
              </label>
              <input
                id={`a-${q.id}`}
                value={answers[q.id]?.text ?? ""}
                onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && (idx < total - 1 ? setIdx(idx + 1) : setReviewing(true))}
                autoComplete="off"
                spellCheck={false}
                maxLength={120}
                className="mt-1.5 w-full max-w-sm rounded-2xl border-2 border-line-2 bg-surface px-4 py-3.5 text-xl font-semibold focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/20"
              />
            </div>
          )}
          {(q.type === "short_answer" || q.type === "comprehension") && (
            <div className="mt-6">
              <label htmlFor={`a-${q.id}`} className="block text-sm font-semibold text-ink-2">
                Your answer
              </label>
              <textarea
                id={`a-${q.id}`}
                value={answers[q.id]?.text ?? ""}
                onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                maxLength={2000}
                rows={4}
                className="mt-1.5 w-full rounded-2xl border-2 border-line-2 bg-surface px-4 py-3.5 text-lg leading-relaxed focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/20"
              />
              <p className="mt-1 text-xs text-ink-3">Spelling won&apos;t be marked — just explain your idea. Worth {q.maxScore} point{q.maxScore === 1 ? "" : "s"}.</p>
            </div>
          )}
          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)} icon={<ArrowLeft className="size-4" />}>
              Back
            </Button>
            {idx < total - 1 ? (
              <Button onClick={() => setIdx(idx + 1)}>
                Next <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => setReviewing(true)}>
                Review answers <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </article>
      )}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`${unanswered.length} question${unanswered.length === 1 ? " is" : "s are"} not answered`}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setConfirm(false); setReviewing(false); setIdx(unanswered[0] - 1); }}>
              Answer them
            </Button>
            <Button onClick={submit}>Submit anyway</Button>
          </>
        }
      >
        Question{unanswered.length === 1 ? "" : "s"} {unanswered.join(", ")} will score zero if you submit now.
      </Dialog>
    </div>
  );
}
