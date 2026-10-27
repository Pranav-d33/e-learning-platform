import "server-only";
import type { ZodType } from "zod";
import type { EmbeddingConfig, LlmConfig } from "./config";

export type AiErrorKind = "auth" | "rate_limit" | "unavailable" | "timeout" | "bad_output" | "bad_request";

/** Errors carry a message that is safe to show to users — never raw provider output. */
export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    public userMessage: string,
    detail?: string,
  ) {
    super(detail ?? userMessage);
  }
}

const USER_MESSAGES: Record<AiErrorKind, string> = {
  auth: "The model provider rejected the API key. Check LLM_API_KEY (and the provider) in the server environment.",
  rate_limit: "The model provider is rate-limiting requests right now. Wait a moment and try again.",
  unavailable: "The model provider is unavailable right now. Try again shortly.",
  timeout: "The model took too long to respond. Try again, or ask for fewer questions.",
  bad_output: "The model returned an answer we couldn't validate, even after a retry.",
  bad_request: "The model provider rejected the request. Check LLM_MODEL is a valid model for this provider.",
};

function headers(cfg: { apiKey: string; provider: string }): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` };
  if (cfg.provider === "openrouter") {
    h["x-title"] = "AI Learning Platform (prototype)";
    h["http-referer"] = process.env.PUBLIC_APP_URL || "http://localhost:3000";
  }
  return h;
}

async function post(url: string, body: unknown, cfg: { apiKey: string; provider: string }, timeoutMs: number) {
  let lastErr: AiError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: headers(cfg),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const name = (err as Error)?.name;
      lastErr = new AiError(name === "TimeoutError" ? "timeout" : "unavailable", USER_MESSAGES[name === "TimeoutError" ? "timeout" : "unavailable"], String(err));
      if (name === "TimeoutError") throw lastErr;
      continue;
    }
    if (res.ok) return res.json();
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) throw new AiError("auth", USER_MESSAGES.auth, text.slice(0, 300));
    if (res.status === 429 || res.status >= 500) {
      lastErr = new AiError(res.status === 429 ? "rate_limit" : "unavailable", USER_MESSAGES[res.status === 429 ? "rate_limit" : "unavailable"], text.slice(0, 300));
      const wait = Math.min(8, Number(res.headers.get("retry-after")) || 2 * (attempt + 1));
      if (attempt === 0) await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    console.warn("[ai] provider rejected request", res.status, text.slice(0, 500));
    throw new AiError("bad_request", USER_MESSAGES.bad_request, `${res.status} ${text.slice(0, 500)}`);
  }
  throw lastErr ?? new AiError("unavailable", USER_MESSAGES.unavailable);
}

/** Pulls a JSON object out of a model reply (tolerates code fences and leading prose). */
export function parseJsonReply(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("No JSON object found in reply");
  }
}

export interface ChatJsonOptions<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Chat completion that must return schema-valid JSON. Invalid output gets exactly one
 * corrective retry (PRD §13); after that an AiError("bad_output") is thrown.
 */
export async function chatJson<T>(cfg: LlmConfig, opts: ChatJsonOptions<T>): Promise<T> {
  const messages: { role: string; content: string }[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  let jsonMode = true;
  for (let attempt = 0; attempt < 2; attempt++) {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 8000,
    };
    if (jsonMode) body.response_format = { type: "json_object" };
    if (cfg.reasoningEffort) body.reasoning_effort = cfg.reasoningEffort;
    let data: { choices?: { message?: { content?: string | null }; finish_reason?: string }[] };
    try {
      data = await post(`${cfg.baseUrl}/chat/completions`, body, cfg, cfg.timeoutMs);
    } catch (err) {
      // Some models reject JSON mode; retry the same turn without it.
      if (err instanceof AiError && err.kind === "bad_request" && jsonMode && /response_format|json/i.test(err.message)) {
        jsonMode = false;
        attempt--;
        continue;
      }
      throw err;
    }
    const content = data.choices?.[0]?.message?.content ?? "";
    let problem: string;
    try {
      const parsed = opts.schema.safeParse(parseJsonReply(content));
      if (parsed.success) return parsed.data;
      problem = parsed.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (err) {
      problem = data.choices?.[0]?.finish_reason === "length" ? "the reply was cut off (too long)" : (err as Error).message;
    }
    messages.push({ role: "assistant", content: content.slice(0, 6000) });
    messages.push({
      role: "user",
      content: `Your previous reply could not be used: ${problem}. Reply again with ONLY one JSON object that matches the requested format exactly.`,
    });
  }
  throw new AiError("bad_output", USER_MESSAGES.bad_output);
}

/** OpenAI-compatible embeddings, batched. Returns one vector per input, in order. */
export async function embed(cfg: EmbeddingConfig, inputs: string[], batchSize = 64): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const body: Record<string, unknown> = { model: cfg.model, input: batch };
    if (cfg.dimensions) body.dimensions = cfg.dimensions;
    const data = (await post(`${cfg.baseUrl}/embeddings`, body, cfg, 60_000)) as {
      data?: { index: number; embedding: number[] }[];
    };
    const rows = [...(data.data ?? [])].sort((a, b) => a.index - b.index);
    if (rows.length !== batch.length || rows.some((r) => !Array.isArray(r.embedding)))
      throw new AiError("bad_output", "The embedding provider returned an unexpected response.");
    out.push(...rows.map((r) => r.embedding));
  }
  return out;
}
