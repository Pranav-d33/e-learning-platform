import { Flask, Lightning } from "@phosphor-icons/react/dist/ssr";
import { connection } from "next/server";
import { Suspense } from "react";
import { publicAiStatus } from "@/lib/ai/config";
import { storageStatus } from "@/lib/store/kv";
import { Notice } from "./ui/notice";

async function Badge() {
  await connection(); // read env at request time, not at build time
  const s = publicAiStatus();
  if (s.mode === "demo")
    return (
      <span
        title={s.demoReason ?? undefined}
        className="inline-flex items-center gap-1.5 rounded-lg bg-warn-soft px-2.5 py-1 text-xs font-semibold text-[oklch(0.45_0.1_70)] ring-1 ring-warn/25 ring-inset"
      >
        <Flask weight="duotone" className="size-4" /> Demo mode
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok ring-1 ring-ok/20 ring-inset">
      <Lightning weight="duotone" className="size-4" /> Live · <span className="font-mono font-medium">{s.model}</span>
    </span>
  );
}

export function ModeBadge() {
  return (
    <Suspense fallback={<span className="skeleton inline-block h-6 w-28" />}>
      <Badge />
    </Suspense>
  );
}

async function Banner() {
  await connection();
  const s = publicAiStatus();
  const storage = storageStatus();
  return (
    <div className="space-y-2">
      {s.mode === "demo" && (
        <Notice tone="warn" title="Demo mode — model API not configured">
          Quizzes from the built-in reader use its reviewed question set; uploaded PDFs get rule-based fill-in-the-blank
          and word-choice questions. Open answers are marked by a keyword checker. Set <code>LLM_API_KEY</code> (Gemini,
          Groq or OpenRouter) on the server to switch to live AI generation and grading.
        </Notice>
      )}
      {!storage.durable && (
        <Notice tone="info" title="Uploads on this deployment are temporary">
          Documents and quizzes are kept in {storage.label.toLowerCase()} — they can disappear when the server instance
          restarts. The built-in demo reader is always available.
        </Notice>
      )}
    </div>
  );
}

export function ModeBanner() {
  return (
    <Suspense fallback={null}>
      <Banner />
    </Suspense>
  );
}
