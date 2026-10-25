import { cn } from "@/lib/cn";

/** Open-book mark with a reading line — used across the platform, tinted per module. */
export function BrandMark({ tone = "ink", className }: { tone?: "ink" | "accent" | "tang"; className?: string }) {
  const fill = { ink: "var(--color-ink)", accent: "var(--color-accent)", tang: "var(--color-tang)" }[tone];
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9 shrink-0", className)} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill={fill} />
      <path d="M20 13.5c-3-2.2-6.6-2.6-10-1.6v15c3.4-1 7-.6 10 1.6 3-2.2 6.6-2.6 10-1.6v-15c-3.4-1-7-.6-10 1.6Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 13.5v15" stroke="white" strokeWidth="2" />
      <circle cx="30.5" cy="10" r="3.2" fill="var(--color-sun)" stroke={fill} strokeWidth="1.5" />
    </svg>
  );
}
