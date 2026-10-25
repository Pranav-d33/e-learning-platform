"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/** Radio group styled as a segmented control (keyboard: arrow keys, via native radios). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl bg-paper-2 p-1 ring-1 ring-line ring-inset", className)}>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "relative flex-1 cursor-pointer rounded-lg px-3.5 py-2 text-center text-sm font-semibold whitespace-nowrap transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-accent/30",
            value === o.value ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:text-ink",
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
