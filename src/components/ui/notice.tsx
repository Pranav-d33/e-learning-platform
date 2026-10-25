import { CheckCircle, Info, Warning, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "warn" | "bad" | "ok";

const STYLE: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-accent-soft/70 border-accent-line text-accent-ink", icon: <Info weight="duotone" className="size-5" /> },
  warn: { box: "bg-warn-soft border-warn/25 text-[oklch(0.42_0.09_70)]", icon: <Warning weight="duotone" className="size-5" /> },
  bad: { box: "bg-bad-soft border-bad/25 text-bad", icon: <WarningOctagon weight="duotone" className="size-5" /> },
  ok: { box: "bg-ok-soft border-ok/25 text-ok", icon: <CheckCircle weight="duotone" className="size-5" /> },
};

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
  role,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: "alert" | "status" | "note";
}) {
  const s = STYLE[tone];
  return (
    <div role={role ?? (tone === "bad" ? "alert" : "note")} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", s.box, className)}>
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-2 [&_a]:font-semibold [&_a]:underline [&_code]:rounded [&_code]:bg-white/60 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
