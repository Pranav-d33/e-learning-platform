"use client";

import { House, Star } from "@phosphor-icons/react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { useProgress } from "@/lib/early/progress";

export function EarlyHeader() {
  const progress = useProgress();
  const stars = Object.values(progress.attempts).filter((a) => a.completed).length;
  return (
    <header className="border-b-2 border-tang/15 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-5xl items-center gap-3 px-4">
        <Link
          href="/"
          aria-label="Platform home"
          className="press grid size-12 place-items-center rounded-2xl bg-surface text-ink-2 ring-2 ring-line shadow-[0_4px_0_var(--color-line-2)] hover:text-ink"
        >
          <House weight="fill" className="size-6" />
        </Link>
        <Link href="/early" className="flex items-center gap-2.5 rounded-xl">
          <BrandMark tone="tang" className="hidden size-10 sm:block" />
          <span className="font-kid text-xl leading-none font-bold tracking-tight sm:text-2xl">Early Learning Studio</span>
        </Link>
        <span
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-sun-soft px-3.5 py-1.5 font-kid text-lg font-bold text-sun-deep ring-2 ring-sun/50"
          aria-label={`${stars} letter${stars === 1 ? "" : "s"} traced`}
          title="Letters traced"
        >
          <Star weight="fill" className="size-5 text-sun drop-shadow-[0_1px_0_var(--color-sun-deep)]" />
          <span className="tabular">{stars}</span>
        </span>
      </div>
    </header>
  );
}
