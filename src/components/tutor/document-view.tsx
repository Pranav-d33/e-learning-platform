"use client";

import { ArrowLeft, Cards, CaretDown, Sparkle, Trash, Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { Skeleton, Spinner } from "@/components/ui/spinner";
import { ApiError, api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import type { SourceDocument } from "@/lib/tutor/types";
import { PageHeader, timeAgo } from "./chrome";

interface PageRow {
  page: number;
  chapter: string | null;
  chars: number;
  lowText: boolean;
  preview: string;
  chunkCount: number;
}
interface Preview {
  document: SourceDocument;
  pages: PageRow[];
  chunks: { count: number; embedded: number; averageTokens: number };
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-paper-2/70 px-4 py-3">
      <dt className="text-xs font-semibold text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular">{value}</dd>
    </div>
  );
}

function PageItem({ docId, row }: { docId: string; row: PageRow }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<{ text: string; truncated: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !full) {
      setLoading(true);
      try {
        const r = await api<{ page: { text: string; truncated: boolean } }>(`/api/documents/${docId}?page=${row.page}`);
        setFull(r.page);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load this page.");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <li id={`page-${row.page}`} className="scroll-mt-24 border-b border-line last:border-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-paper/60"
      >
        <span className="w-14 shrink-0 font-mono text-sm font-semibold text-accent-ink">p. {row.page}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
            {row.chapter && <span className="font-semibold text-ink-2">{row.chapter}</span>}
            <span className="tabular">{row.chars.toLocaleString()} characters</span>
            <span className="tabular">{row.chunkCount} chunk{row.chunkCount === 1 ? "" : "s"}</span>
            {row.lowText && <Badge tone="warn">Little or no text — skipped</Badge>}
          </span>
          {!open && <span className="mt-1 line-clamp-2 block text-sm text-ink-2">{row.preview || "—"}</span>}
        </span>
        <CaretDown className={cn("mt-1 size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-5 pl-[5.5rem]">
          {loading && <Spinner className="text-accent" label="Loading page" />}
          {error && <Notice tone="bad">{error}</Notice>}
          {full && (
            <>
              <p className="max-w-3xl whitespace-pre-line rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed">{full.text}</p>
              {full.truncated && <p className="mt-2 text-xs text-ink-3">Preview limited to the first 4,000 characters of this page.</p>}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function DocumentView({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    () =>
      api<Preview>(`/api/documents/${id}`).then(
        (d) => {
          setData(d);
          setError(null);
        },
        (err) => setError(err instanceof ApiError ? err.message : "Couldn't load this document."),
      ),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function remove() {
    setDeleting(true);
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      router.push("/tutor");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed.");
      setDeleting(false);
      setConfirm(false);
    }
  }

  const back = (
    <Link href="/tutor" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
      <ArrowLeft className="size-4" /> Workspace
    </Link>
  );

  if (error && !data)
    return (
      <div className="space-y-6">
        {back}
        <Notice tone="bad" title="Document unavailable" action={<Button variant="secondary" size="sm" onClick={load}>Retry</Button>}>
          {error}
        </Notice>
      </div>
    );
  if (!data)
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );

  const doc = data.document;
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={back}
        title={doc.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={doc.status === "ready" ? "ok" : "bad"}>{doc.status === "ready" ? "Ready" : "Failed"}</Badge>
            {doc.isDemo ? <Badge>Built-in demo · original sample content</Badge> : <span className="text-sm">{doc.originalFilename} · added {timeAgo(doc.createdAt)}</span>}
          </span>
        }
        actions={
          <>
            {!doc.isDemo && (
              <Button variant="danger" onClick={() => setConfirm(true)} icon={<Trash className="size-4" />}>
                Delete
              </Button>
            )}
            {doc.status === "ready" && (
              <>
                <LinkButton variant="secondary" href={`/tutor/study/${doc.id}`} icon={<Cards className="size-4" />}>
                  Study studio
                </LinkButton>
                <LinkButton href={`/tutor/generate?doc=${doc.id}`} icon={<Sparkle weight="fill" className="size-4" />}>
                  Build a quiz from this
                </LinkButton>
              </>
            )}
          </>
        }
      />

      {doc.status === "failed" && <Notice tone="bad" title="Extraction failed">{doc.errorMessage} Upload a text-based PDF from the workspace to try again.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}

      {doc.status === "ready" && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Pages" value={doc.pageCount} />
            <Stat label="Chunks" value={data.chunks.count} />
            <Stat label="Avg tokens / chunk" value={`≈ ${data.chunks.averageTokens}`} />
            <Stat label="Chapters found" value={doc.chapters.length || "—"} />
            <Stat label="Extraction" value={<span className="text-sm">{doc.extractionMethod === "seeded-demo" ? "Seeded text" : "PDF text layer"}</span>} />
            <Stat label="Retrieval" value={<span className="text-sm">{data.chunks.embedded ? `Hybrid · ${doc.embedding?.model}` : "BM25 keywords"}</span>} />
          </dl>

          {doc.lowTextPages.length > 0 && (
            <Notice tone="warn" title={`${doc.lowTextPages.length} page(s) had little or no extractable text`}>
              Pages {doc.lowTextPages.join(", ")} look like images (scans or illustrations), so they were left out of the
              index. OCR is not enabled in this prototype.
            </Notice>
          )}

          <div className="grid gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-4">
              <h2 className="font-display text-lg font-semibold">Chapters</h2>
              {doc.chapters.length ? (
                <ol className="mt-3 space-y-1.5">
                  {doc.chapters.map((c) => (
                    <li key={c.title + c.pageStart}>
                      <a href={`#page-${c.pageStart}`} className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-paper-2">
                        <span className="font-medium">{c.title}</span>
                        <span className="shrink-0 font-mono text-xs text-ink-3">
                          p. {c.pageStart}
                          {c.pageEnd > c.pageStart ? `–${c.pageEnd}` : ""}
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-ink-2">No “Chapter / Unit / Lesson” headings were detected — you can still scope quizzes by page range.</p>
              )}
            </aside>
            <section className="lg:col-span-8" aria-labelledby="pages-heading">
              <h2 id="pages-heading" className="font-display text-lg font-semibold">Extracted pages</h2>
              <p className="text-sm text-ink-2">Open a page to read exactly what the tutor can cite.</p>
              <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
                {data.pages.map((p) => (
                  <PageItem key={p.page} docId={doc.id} row={p} />
                ))}
              </ul>
            </section>
          </div>
        </>
      )}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this document?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Keep it</Button>
            <Button variant="danger" loading={deleting} onClick={remove} icon={<Warning className="size-4" />}>Delete document</Button>
          </>
        }
      >
        Its extracted pages and chunks will be removed from this prototype&apos;s storage.
      </Dialog>
    </div>
  );
}
