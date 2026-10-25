"use client";

import { Check } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/cn";

function NavLinks({ path }: { path: string | null }) {
  const items = [
    { href: "/tutor", label: "Workspace", active: path === "/tutor" || !!path?.startsWith("/tutor/document") },
    { href: "/tutor/generate", label: "New quiz", active: !!path?.startsWith("/tutor/generate") },
  ];
  return (
    <nav aria-label="Tutor" className="flex items-center gap-1 text-sm font-semibold">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-2 transition-colors",
            i.active ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

function ActiveNav() {
  return <NavLinks path={usePathname()} />;
}

/** Pathname is request data under Cache Components, so the active state streams in. */
export function TutorNav() {
  return (
    <Suspense fallback={<NavLinks path={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

const STEPS = ["Source", "Set up", "Review", "Quiz", "Results"] as const;
export type StepName = (typeof STEPS)[number];

/** Where the teacher is in the source → results flow. */
export function Steps({ current }: { current: StepName }) {
  const at = STEPS.indexOf(current);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-ink-3" aria-label="Quiz steps">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === at ? "step" : undefined}>
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full text-[0.65rem] tabular",
              i < at && "bg-accent text-white",
              i === at && "bg-ink text-paper",
              i > at && "border border-line-2 text-ink-3",
            )}
          >
            {i < at ? <Check weight="bold" className="size-3" /> : i + 1}
          </span>
          <span className={cn(i === at && "text-ink", i < at && "text-ink-2")}>{s}</span>
          {i < STEPS.length - 1 && <span className="h-px w-5 bg-line-2" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-3">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.4rem] sm:leading-tight">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(iso).toLocaleDateString();
}
