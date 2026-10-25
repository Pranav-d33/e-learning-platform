"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(NETWORK_MESSAGE, 0);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok) {
    const { message, ...details } = body?.error ?? {};
    throw new ApiError(message || `Request failed (${res.status}).`, res.status, details);
  }
  return body as T;
}

export type StreamEvent = { stage: string; message?: string; [key: string]: unknown };

/** Reads an NDJSON progress stream; resolves with the final event (done or error). */
export async function readStream(res: Response, onEvent: (e: StreamEvent) => void): Promise<StreamEvent> {
  if (!res.ok || !res.headers.get("content-type")?.includes("ndjson")) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const { message, ...details } = body?.error ?? {};
    throw new ApiError(message || `Request failed (${res.status}).`, res.status, details);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: StreamEvent = { stage: "error", message: "The server closed the connection early." };
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      last = JSON.parse(line) as StreamEvent;
      onEvent(last);
    }
    if (done) break;
  }
  return last;
}

export async function postStream(url: string, json: unknown, onEvent: (e: StreamEvent) => void) {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(json) });
  } catch {
    throw new ApiError(NETWORK_MESSAGE, 0);
  }
  return readStream(res, onEvent);
}

/** Multipart upload with byte-level progress (XHR), then NDJSON processing events. */
export function uploadWithProgress(
  url: string,
  form: FormData,
  handlers: { onUpload: (fraction: number) => void; onEvent: (e: StreamEvent) => void },
): Promise<StreamEvent> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let seen = 0;
    let last: StreamEvent | null = null;
    const drain = () => {
      const text = xhr.responseText;
      let nl: number;
      while ((nl = text.indexOf("\n", seen)) >= 0) {
        const line = text.slice(seen, nl).trim();
        seen = nl + 1;
        if (!line) continue;
        try {
          last = JSON.parse(line) as StreamEvent;
          handlers.onEvent(last);
        } catch {
          /* partial line — wait for more */
        }
      }
    };
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && handlers.onUpload(e.loaded / e.total);
    xhr.onprogress = () => {
      if (xhr.getResponseHeader("content-type")?.includes("ndjson")) drain();
    };
    xhr.onload = () => {
      if (xhr.getResponseHeader("content-type")?.includes("ndjson")) {
        drain();
        resolve(last ?? { stage: "error", message: "The server closed the connection early." });
        return;
      }
      let message = `Upload failed (${xhr.status}).`;
      let details: Record<string, unknown> = {};
      try {
        const body = JSON.parse(xhr.responseText) as { error?: { message?: string } };
        ({ message = message, ...details } = body.error ?? {});
      } catch {
        if (xhr.status === 413) message = "That file is too large for the server to accept. Upload a smaller PDF.";
      }
      reject(new ApiError(message, xhr.status, details));
    };
    xhr.onerror = () => reject(new ApiError(NETWORK_MESSAGE, 0));
    xhr.send(form);
  });
}
