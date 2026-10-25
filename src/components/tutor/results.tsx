"use client";

import { ArrowCounterClockwise, CheckCircle, Circle, ListChecks, MinusCircle, Sparkle, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { ApiError, api } from "@/lib/client/api";
import { startQuiz } from "@/lib/client/quiz";
import { cn } from "@/lib/cn";
import { TYPE_LABEL, type AnswerEvaluation, type Question, type Quiz } from "@/lib/tutor/types";
import { Steps } from "./chrome";
import { Citations } from "./review";
import { SourceDrawer, type DrawerTarget } from "./source-drawer";

interface ResultsView {
  attempt: { id: string; quizId: string; submittedAt: string; totalScore: number; maxScore: number; evaluationStatus: "complete" | "needs_review" };
  quiz: { id: string; title: string; grade: number; subject: string; generator: Quiz["generator"] };
  items: { question: Question; evaluation: AnswerEvaluation | null }[];
}

const EVALUATOR: Record<AnswerEvaluation["evaluator"], string> = {
  exact_option: "Scored exactly (option match)",
  normalized_match: "Scored exactly (accepted answers)",
  llm_rubric: "AI rubric estimate",
  demo_keyword: "Demo keyword check",
  none: "Not scored — needs a teacher",
};

function verdict(e: AnswerEvaluation | null) {
  if (!e || e.evaluator === "none") return { label: "Needs a teacher", tone: "warn" as const, icon: <WarningCircle weight="fill" className="size-5" /> };
  if (!e.answerText && !e.optionId) return { label: "Not answered", tone: "neutral" as const, icon: <MinusCircle weight="fill" className="size-5" /> };
  if (e.score >= e.maxScore) return { label: "Correct", tone: "ok" as const, icon: <CheckCircle weight="fill" className="size-5" /> };
  if (e.score > 0) return { label: "Partly there", tone: "warn" as const, icon: <CheckCircle weight="duotone" className="size-5" /> };
  return { label: "Not yet", tone: "bad" as const, icon: <XCircle weight="fill" className="size-5" /> };
}

function ScoreRing({ score, max }: { score: number; max: number }) {
  const [shown, setShown] = useState(0);
  const pct = max ? score / max : 0;
  useEffect(() => {
    const t = setTimeout(() => setShown(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);
  const r = 62;
  const c = 2 * Math.PI * r;
  const color = pct >= 0.6 ? "var(--color-ok)" : pct >= 0.3 ? "var(--color-sun-deep)" : "var(--color-tang)";
  return (
    <div className="relative size-40" role="img" aria-label={`Score ${score} out of ${max}`}>
      <svg viewBox="0 0 160 160" className="size-40 -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--color-paper-2)" strokeWidth="14" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: "stroke-dashoffset 1100ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-4xl font-semibold tabular">
            {score}
            <span className="text-xl text-ink-3">/{max}</span>
          </p>
          <p className="text-xs font-semibold text-ink-3 tabular">{Math.round(pct * 100)}%</p>
        </div>
      </div>
    </div>
  );
}

export function QuizResults({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<ResultsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [retaking, setRetaking] = useState(false);

  useEffect(() => {
    api<ResultsView>(`/api/attempts/${id}/results`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load these results."));
  }, [id]);

  async function retake() {
    if (!data) return;
    setRetaking(true);
    try {
      router.push(`/tutor/quiz/${await startQuiz(data.quiz.id)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start a new attempt.");
      setRetaking(false);
    }
  }

  if (error && !data) return <Notice tone="bad" title="Results unavailable" action={<LinkButton variant="secondary" size="sm" href="/tutor">Teacher view</LinkButton>}>{error}</Notice>;
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="mx-auto size-40 rounded-full" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );

  const { attempt, items } = data;
  const pct = attempt.maxScore ? attempt.totalScore / attempt.maxScore : 0;
  const headline = pct >= 0.9 ? "Excellent work" : pct >= 0.6 ? "Good work" : pct >= 0.3 ? "Good effort — a few to look at together" : "Let's look at these together";
  const reviewCount = items.filter((i) => i.evaluation?.reviewFlag || i.evaluation?.evaluator === "none").length;
  const usesAi = items.some((i) => i.evaluation?.evaluator === "llm_rubric");
  const usesDemo = items.some((i) => i.evaluation?.evaluator === "demo_keyword");

  return (
    <div className="space-y-8">
      <Steps current="Results" />
      <section className="flex flex-col items-center gap-6 rounded-3xl border border-line bg-surface p-8 text-center shadow-soft sm:flex-row sm:text-left">
        <ScoreRing score={attempt.totalScore} max={attempt.maxScore} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h1>
          <p className="mt-1 text-ink-2">
            {data.quiz.title} · {items.length} questions · {new Date(attempt.submittedAt).toLocaleString()}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button onClick={retake} loading={retaking} icon={<ArrowCounterClockwise weight="bold" className="size-4" />}>
              Try again
            </Button>
            <LinkButton variant="secondary" href={`/tutor/review/${data.quiz.id}`} icon={<ListChecks className="size-4" />}>
              Teacher view
            </LinkButton>
            <LinkButton variant="ghost" href="/tutor/generate" icon={<Sparkle className="size-4" />}>
              New quiz
            </LinkButton>
          </div>
        </div>
      </section>

      <div className="space-y-2">
        {reviewCount > 0 && (
          <Notice tone="warn" title={`${reviewCount} answer${reviewCount === 1 ? "" : "s"} marked for a teacher's check`}>
            The score above may change after review.
          </Notice>
        )}
        {(usesAi || usesDemo) && (
          <Notice tone="info">
            Multiple-choice and fill-in-the-blank answers were scored exactly.{" "}
            {usesAi && "Written answers were scored by AI against the rubric — this is an estimate and may need teacher review. "}
            {usesDemo && "Written answers were checked by the demo keyword checker, which is approximate."}
          </Notice>
        )}
      </div>

      <ol className="space-y-4">
        {items.map(({ question: q, evaluation: e }, i) => {
          const v = verdict(e);
          const studentAnswer = e?.answerText;
          const expected = q.type === "fill_blank" ? q.acceptedAnswers[0] : q.expectedAnswer;
          return (
            <li key={q.id} className="animate-rise rounded-2xl border border-line bg-surface p-5 shadow-soft" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-ink-3">Q{i + 1}</span>
                <span className="text-xs font-semibold text-ink-3">{TYPE_LABEL[q.type]}</span>
                <span
                  className={cn(
                    "ml-auto inline-flex items-center gap-1.5 text-sm font-semibold",
                    { ok: "text-ok", warn: "text-warn", bad: "text-bad", neutral: "text-ink-3" }[v.tone],
                  )}
                >
                  {v.icon}
                  {v.label}
                  {e && e.evaluator !== "none" && (
                    <span className="tabular text-ink-2">
                      · {e.score}/{e.maxScore}
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-2 font-semibold">{q.questionText}</p>
              {e?.feedback && <p className="mt-2 text-ink-2">{e.feedback}</p>}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-paper-2/70 p-3 text-sm">
                  <p className="text-xs font-semibold text-ink-3">Your answer</p>
                  <p className="mt-1">{studentAnswer || <em className="text-ink-3">No answer</em>}</p>
                </div>
                <div className="rounded-xl bg-ok-soft/60 p-3 text-sm">
                  <p className="text-xs font-semibold text-ok">Expected answer</p>
                  <p className="mt-1">{expected}</p>
                </div>
              </div>
              {e && q.rubric.criteria.length > 0 && e.evaluator !== "none" && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {q.rubric.criteria.map((c) => {
                    const met = e.matchedCriteria.includes(c.id);
                    return (
                      <li key={c.id} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", met ? "bg-ok-soft text-ok" : "bg-paper-2 text-ink-2")}>
                        {met ? <CheckCircle weight="fill" className="size-3.5" /> : <Circle className="size-3.5" />}
                        {c.criterion}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-4 flex flex-col gap-2 border-t border-dashed border-line pt-3 sm:flex-row sm:items-start sm:justify-between">
                <Citations q={q} onOpen={setDrawer} />
                {e && (
                  <Badge tone={e.reviewFlag ? "warn" : "neutral"} className="self-start">
                    {EVALUATOR[e.evaluator]}
                    {e.reviewFlag && e.evaluator !== "none" ? " · teacher check" : ""}
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <SourceDrawer target={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
