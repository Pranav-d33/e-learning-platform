import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[0_1px_0_oklch(0.3_0.05_190),0_8px_20px_-10px_oklch(0.4_0.07_190/0.6)] hover:bg-accent-ink disabled:bg-ink-3/60 disabled:shadow-none",
  secondary: "bg-surface text-ink border border-line-2 shadow-soft hover:border-ink-3 hover:bg-white disabled:text-ink-3",
  ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink disabled:text-ink-3",
  quiet: "text-accent-ink hover:bg-accent-soft disabled:text-ink-3",
  danger: "text-bad border border-bad/25 bg-surface hover:bg-bad-soft hover:border-bad/50 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 gap-1.5 px-3 text-sm rounded-lg",
  md: "h-11 gap-2 px-4.5 text-[0.95rem] rounded-xl",
  lg: "h-13 gap-2.5 px-6 text-base rounded-xl",
};

const base =
  "press inline-flex select-none items-center justify-center font-semibold whitespace-nowrap disabled:cursor-not-allowed";

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, VARIANTS[variant], SIZES[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
