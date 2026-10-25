import { cn } from "@/lib/cn";

export function SiteFooter({ variant = "default" }: { variant?: "default" | "kid" }) {
  return (
    <footer
      className={cn(
        "mt-auto border-t py-6 text-sm",
        variant === "kid" ? "border-tang/20 bg-surface/70 text-ink-2" : "border-line bg-surface/60 text-ink-2",
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-3xl">
          <strong className="font-semibold text-ink">Prototype.</strong> AI-generated questions and answer scoring may be
          imperfect — adult review is recommended. Tracing feedback is a playful guide, not a handwriting or developmental
          assessment. The demo reader is original sample content, not an official textbook.
        </p>
        <p className="shrink-0 text-ink-3">No accounts · no recordings · no child data stored on the server</p>
      </div>
    </footer>
  );
}
