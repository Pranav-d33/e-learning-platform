"use client";

import { SpeakerSlash, Star } from "@phosphor-icons/react";
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { speaker } from "@/lib/early/speaker";
import { cn } from "@/lib/cn";

export type KidColor = "tang" | "leaf" | "sky" | "berry" | "sun" | "white";

const FACE: Record<KidColor, string> = {
  tang: "bg-tang text-white shadow-[0_6px_0_var(--color-tang-deep)] group-active:shadow-[0_2px_0_var(--color-tang-deep)]",
  leaf: "bg-leaf text-white shadow-[0_6px_0_var(--color-leaf-deep)] group-active:shadow-[0_2px_0_var(--color-leaf-deep)]",
  sky: "bg-sky text-white shadow-[0_6px_0_var(--color-sky-deep)] group-active:shadow-[0_2px_0_var(--color-sky-deep)]",
  berry: "bg-berry text-white shadow-[0_6px_0_var(--color-berry-deep)] group-active:shadow-[0_2px_0_var(--color-berry-deep)]",
  sun: "bg-sun text-ink shadow-[0_6px_0_var(--color-sun-deep)] group-active:shadow-[0_2px_0_var(--color-sun-deep)]",
  white: "bg-surface text-ink ring-2 ring-line shadow-[0_6px_0_var(--color-line-2)] group-active:shadow-[0_2px_0_var(--color-line-2)]",
};

const SIZE = { xl: "size-24 [&_svg]:size-11", lg: "size-20 [&_svg]:size-9", md: "size-16 [&_svg]:size-7", sm: "size-13 [&_svg]:size-6" };

/** Big, round, labelled button. The label is for adults and screen readers; the icon carries meaning. */
export function KidButton({
  icon,
  label,
  color = "tang",
  size = "lg",
  onClick,
  href,
  active,
  disabled,
  hideLabel,
  className,
}: {
  icon: ReactNode;
  label: string;
  color?: KidColor;
  size?: keyof typeof SIZE;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  className?: string;
}) {
  const face = (
    <>
      <span
        className={cn(
          "relative grid place-items-center rounded-full transition-[transform,box-shadow] duration-150 group-hover:-translate-y-0.5 group-active:translate-y-1",
          FACE[color],
          SIZE[size],
          active && "animate-pulse-ring",
          disabled && "opacity-40 grayscale",
        )}
      >
        {icon}
      </span>
      <span className={cn("font-kid text-[0.95rem] leading-tight font-bold text-ink-2", hideLabel && "sr-only")}>{label}</span>
    </>
  );
  const cls = cn("group flex min-w-16 flex-col items-center gap-2 rounded-2xl text-center outline-offset-4 select-none", disabled && "pointer-events-none", className);
  if (href)
    return (
      <Link href={href} className={cls} aria-label={label}>
        {face}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} aria-label={label} className={cls}>
      {face}
    </button>
  );
}

export function Stars({ filled, total = 3, className }: { filled: number; total?: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-1", className)} aria-label={`${filled} of ${total} stars`} role="img">
      {Array.from({ length: total }, (_, i) => (
        <Star
          key={i}
          weight={i < filled ? "fill" : "regular"}
          className={cn("size-8 transition-transform", i < filled ? "text-sun drop-shadow-[0_2px_0_var(--color-sun-deep)]" : "text-line-2")}
          style={{ transitionDelay: `${i * 80}ms` }}
        />
      ))}
    </span>
  );
}

/** Shown when a clip and the browser voice both failed — so we never pretend audio played. */
export function AudioUnavailable({ readAloud }: { readAloud: string }) {
  const state = useSyncExternalStore(speaker.subscribe, speaker.getSnapshot, () => speaker.state);
  if (!state.unavailable) return null;
  return (
    <div role="status" className="mx-auto flex max-w-xl items-start gap-3 rounded-2xl border-2 border-dashed border-sun-deep/40 bg-sun-soft px-4 py-3 text-sm text-ink-2">
      <SpeakerSlash weight="duotone" className="mt-0.5 size-6 shrink-0 text-sun-deep" />
      <p>
        <strong className="text-ink">Sound isn&apos;t playing on this device.</strong> Check the volume, or a grown-up can read
        aloud: <span className="font-kid font-semibold text-ink">{readAloud}</span>. Tracing still works without sound.
      </p>
    </div>
  );
}

export function useSpeakerState() {
  return useSyncExternalStore(speaker.subscribe, speaker.getSnapshot, () => speaker.state);
}

/** Little animated equaliser shown on whatever is currently speaking. */
export function SoundBars({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-4 items-end gap-0.5", className)} aria-hidden="true">
      {[0, 150, 300].map((d) => (
        <span key={d} className="eq-bar h-full w-1 rounded-full bg-current" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}
