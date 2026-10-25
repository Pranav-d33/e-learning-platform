"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Accessible modal built on the native <dialog> element (focus trap + Esc for free). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on backdrop
      }}
      className={cn(
        "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/35 backdrop:backdrop-blur-[2px] open:animate-pop",
        className,
      )}
    >
      <div className="p-6">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {children && <div className="mt-3 text-sm text-ink-2">{children}</div>}
      </div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper/60 px-6 py-4">{footer}</div>}
    </dialog>
  );
}
