import "server-only";
import type { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, details?: Record<string, unknown>) {
  return Response.json({ error: { message, ...details } }, { status });
}

export function zodMessage(err: ZodError): string {
  return err.issues
    .slice(0, 4)
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}

/** Wraps a route handler so unexpected errors never leak stack traces to the client. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return jsonError(err.status, err.message, err.details);
      console.error("[api] unhandled error", err);
      return jsonError(500, "Something went wrong on the server. Please try again.");
    }
  };
}

export type Emit = (event: Record<string, unknown>) => void;

/**
 * Streams newline-delimited JSON progress events. The final event is either
 * {stage:"done", ...} or {stage:"error", message}.
 */
export function ndjson(run: (emit: Emit) => Promise<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const result = await run(emit);
        emit({ stage: "done", ...result });
      } catch (err) {
        if (err instanceof HttpError) emit({ stage: "error", message: err.message, ...err.details });
        else {
          console.error("[api] stream error", err);
          emit({ stage: "error", message: "Something went wrong on the server. Please try again." });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "The request body must be valid JSON.");
  }
}

/* ------------------------------------------------------------ rate limiting */

const windows = new Map<string, { start: number; count: number }>();

/** Best-effort, per-instance fixed-window limiter (serverless instances do not share it). */
export function rateLimit(req: Request, bucket: string, limit: number, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start > windowMs) {
    windows.set(key, { start: now, count: 1 });
    return;
  }
  if (++w.count > limit) throw new HttpError(429, "Too many requests in a short time. Please wait a minute and try again.");
}

/* ------------------------------------------------------------------- limits */

export function uploadLimits() {
  const configured = Number(process.env.MAX_UPLOAD_MB) > 0 ? Number(process.env.MAX_UPLOAD_MB) : 15;
  // Vercel functions reject request bodies over 4.5 MB before our code runs.
  const platformCap = process.env.VERCEL ? 4.5 : Infinity;
  const maxPages = Number(process.env.MAX_PDF_PAGES) > 0 ? Number(process.env.MAX_PDF_PAGES) : 250;
  return { maxMb: Math.min(configured, platformCap), configuredMb: configured, platformCapped: configured > platformCap, maxPages };
}
