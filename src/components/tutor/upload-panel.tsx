"use client";

import { CheckCircle, FilePdf, UploadSimple, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, uploadWithProgress, type StreamEvent } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import type { SourceDocument } from "@/lib/tutor/types";

type Phase = "idle" | "uploading" | "extracting" | "indexing" | "embedding" | "done" | "error";

const ORDER: Phase[] = ["uploading", "extracting", "indexing", "done"];

export function UploadPanel({
  maxMb,
  maxPages,
  onChanged,
}: {
  maxMb: number;
  maxPages: number;
  /** Called after the document list changed (new ready doc, or a saved failed record). */
  onChanged: (highlightId?: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("1");
  const [subject, setSubject] = useState("English");
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(SourceDocument & { warnings?: string[] }) | null>(null);

  const busy = phase !== "idle" && phase !== "done" && phase !== "error";

  function choose(f: File | undefined | null) {
    setError(null);
    setResult(null);
    setPhase("idle");
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      setFile(null);
      setError(`“${f.name}” isn't a PDF. Only searchable PDF files are accepted.`);
      return;
    }
    if (f.size > maxMb * 1024 * 1024) {
      setFile(null);
      setError(`“${f.name}” is ${(f.size / 1024 / 1024).toFixed(1)} MB — the limit is ${maxMb} MB. Upload a single chapter or compress the PDF.`);
      return;
    }
    setFile(f);
    setTitle(f.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " "));
  }

  async function submit() {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    form.append("grade", grade);
    form.append("subject", subject);
    setPhase("uploading");
    setUploadPct(0);
    setError(null);
    setDetail(null);
    try {
      const last = await uploadWithProgress("/api/documents", form, {
        onUpload: (f) => setUploadPct(Math.round(f * 100)),
        onEvent: (e: StreamEvent) => {
          if (e.stage === "extracting") setPhase("extracting");
          if (e.stage === "indexing") {
            setPhase("indexing");
            setDetail(`${e.pages} pages → ${e.chunks} chunks${e.lowTextPages ? ` · ${e.lowTextPages} page(s) with little text` : ""}`);
          }
          if (e.stage === "embedding") {
            setPhase("embedding");
            setDetail(`Embedding ${e.done} / ${e.total} chunks`);
          }
        },
      });
      if (last.stage === "done") {
        const doc = last.document as SourceDocument & { warnings?: string[] };
        setPhase("done");
        setResult(doc);
        setFile(null);
        onChanged(doc.id);
      } else {
        setPhase("error");
        setFile(null); // let the teacher pick another file straight away
        setError(last.message ?? "Processing failed.");
        if (last.documentId) onChanged();
      }
    } catch (err) {
      setPhase("error");
      setFile(null);
      setError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    }
  }

  const stepIndex = phase === "embedding" ? 2 : ORDER.indexOf(phase);

  return (
    <section aria-labelledby="upload-heading" className="rounded-[1.4rem] border border-line bg-surface p-5 shadow-soft sm:p-6">
      <h2 id="upload-heading" className="font-display text-xl font-semibold">Add a textbook</h2>
      <p className="mt-1 text-sm text-ink-2">
        Searchable PDF · up to {maxMb} MB and {maxPages} pages. Text is extracted page by page so every question can cite
        its page.
      </p>

      {!file && !busy && (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "mt-4 flex flex-col items-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors",
            drag ? "border-accent bg-accent-soft" : "border-line-2 bg-paper/60",
          )}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <UploadSimple weight="duotone" className="size-6" />
          </span>
          <p className="mt-3 font-semibold">Drop a PDF here</p>
          <p className="text-sm text-ink-2">or</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => input.current?.click()}>
            Choose a file
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Choose a PDF to upload"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {file && !busy && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-paper/60 px-3.5 py-3">
            <FilePdf weight="duotone" className="size-7 shrink-0 text-bad" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-ink-2 tabular">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-paper-2"
              aria-label="Remove file"
            >
              <X className="size-4" />
            </button>
          </div>
          <Field label="Title" htmlFor="up-title">
            <Input id="up-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class" htmlFor="up-grade">
              <Select id="up-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Class {i + 1}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" htmlFor="up-subject">
              <Input id="up-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={40} />
            </Field>
          </div>
          <Button className="w-full" onClick={submit} icon={<UploadSimple weight="bold" className="size-4" />}>
            Upload and index
          </Button>
        </div>
      )}

      {busy && (
        <ol className="mt-5 space-y-3" aria-live="polite">
          {[
            { label: "Uploading", sub: `${uploadPct}%` },
            { label: "Extracting text", sub: "Reading the PDF text layer page by page" },
            { label: phase === "embedding" ? "Embedding chunks" : "Chunking & indexing", sub: detail ?? "Splitting into page-tagged chunks" },
          ].map((s, i) => {
            const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "todo";
            return (
              <li key={s.label} className="flex gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center">
                  {state === "done" ? (
                    <CheckCircle weight="fill" className="size-6 text-ok" />
                  ) : state === "active" ? (
                    <Spinner className="text-accent" />
                  ) : (
                    <span className="size-4 rounded-full border-2 border-line-2" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold", state === "todo" && "text-ink-3")}>{s.label}</p>
                  {state === "active" && <p className="text-xs text-ink-2">{s.sub}</p>}
                  {state === "active" && i === 0 && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-2">
                      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${uploadPct}%` }} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {error && (
        <Notice tone="bad" title="That upload didn't work" className="mt-4">
          {error}
        </Notice>
      )}
      {phase === "done" && result && (
        <Notice tone="ok" title="Ready to use" className="mt-4" role="status">
          {result.title} — {result.pageCount} pages, {result.chunkCount} chunks
          {result.chapters?.length ? `, ${result.chapters.length} chapters detected` : ""}.
          {result.warnings?.map((w) => (
            <span key={w} className="mt-1 block">
              {w}
            </span>
          ))}
        </Notice>
      )}

      <p className="mt-5 border-t border-dashed border-line pt-4 text-xs text-ink-2">
        Need a test file? Download the{" "}
        <a className="font-semibold text-accent-ink underline" href="/samples/sunny-steps-demo-reader.pdf" download>
          sample reader PDF
        </a>{" "}
        (searchable) or a{" "}
        <a className="font-semibold text-accent-ink underline" href="/samples/scanned-sample.pdf" download>
          scanned sample
        </a>{" "}
        to see the scanned-PDF message.
      </p>
    </section>
  );
}
