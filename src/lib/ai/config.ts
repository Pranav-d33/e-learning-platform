import "server-only";

export type ProviderId = "gemini" | "groq" | "openrouter" | "openai" | "custom";

interface Preset {
  label: string;
  baseUrl: string;
  model: string;
  embedModel: string | null;
  keyEnv: string[];
  keyPrefix: RegExp | null;
}

/** All presets speak the OpenAI-compatible chat-completions protocol. */
export const PRESETS: Record<ProviderId, Preset> = {
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    embedModel: "gemini-embedding-001",
    keyEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    keyPrefix: /^AIza/,
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    embedModel: null,
    keyEnv: ["GROQ_API_KEY"],
    keyPrefix: /^gsk_/,
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-oss-120b",
    embedModel: null,
    keyEnv: ["OPENROUTER_API_KEY"],
    keyPrefix: /^sk-or-/,
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5-mini",
    embedModel: "text-embedding-3-small",
    keyEnv: ["OPENAI_API_KEY"],
    keyPrefix: /^sk-(?!or-)/,
  },
  custom: { label: "Custom (OpenAI-compatible)", baseUrl: "", model: "", embedModel: null, keyEnv: [], keyPrefix: null },
};

export interface LlmConfig {
  provider: ProviderId;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  reasoningEffort: string | null;
  judge: boolean;
}

export interface EmbeddingConfig {
  provider: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number | null;
}

export interface AiConfig {
  mode: "live" | "demo";
  demoReason: string | null;
  llm: LlmConfig | null;
  embeddings: EmbeddingConfig | null;
}

const env = (name: string) => process.env[name]?.trim() || "";

function isProvider(v: string): v is ProviderId {
  return v in PRESETS;
}

function keyFor(p: ProviderId): string {
  for (const name of PRESETS[p].keyEnv) if (env(name)) return env(name);
  return "";
}

function detectProvider(): ProviderId | null {
  const explicit = env("LLM_PROVIDER").toLowerCase();
  if (explicit) return isProvider(explicit) ? explicit : null;
  const generic = env("LLM_API_KEY");
  if (generic && env("LLM_BASE_URL")) return "custom";
  if (generic) {
    for (const p of Object.keys(PRESETS) as ProviderId[]) if (PRESETS[p].keyPrefix?.test(generic)) return p;
  }
  for (const p of ["gemini", "groq", "openrouter", "openai"] as ProviderId[]) if (keyFor(p)) return p;
  return null;
}

function resolveEmbeddings(llmProvider: ProviderId | null): EmbeddingConfig | null {
  const requested = env("EMBEDDING_PROVIDER").toLowerCase();
  if (requested === "none" || env("DEMO_MODE").match(/^(1|true|yes)$/i)) return null;
  let provider: ProviderId | null = null;
  if (requested && isProvider(requested)) provider = requested;
  else if (llmProvider && PRESETS[llmProvider].embedModel) provider = llmProvider;
  else if (keyFor("gemini")) provider = "gemini";
  else if (keyFor("openai")) provider = "openai";
  if (!provider) return null;
  const apiKey =
    env("EMBEDDING_API_KEY") || keyFor(provider) || (provider === llmProvider ? env("LLM_API_KEY") : "");
  const model = env("EMBEDDING_MODEL") || PRESETS[provider].embedModel || "";
  const baseUrl = (provider === "custom" ? env("EMBEDDING_BASE_URL") : PRESETS[provider].baseUrl).replace(/\/$/, "");
  if (!apiKey || !model || !baseUrl) return null;
  const dims = Number(env("EMBEDDING_DIMENSIONS"));
  return { provider, baseUrl, apiKey, model, dimensions: Number.isFinite(dims) && dims > 0 ? dims : null };
}

/** Reads provider configuration from the environment. Never sent to the browser. */
export function getAiConfig(): AiConfig {
  if (/^(1|true|yes)$/i.test(env("DEMO_MODE")))
    return { mode: "demo", demoReason: "DEMO_MODE is enabled", llm: null, embeddings: null };
  const provider = detectProvider();
  if (!provider) {
    const reason = env("LLM_PROVIDER") ? `Unknown LLM_PROVIDER "${env("LLM_PROVIDER")}"` : "No model API key configured";
    return { mode: "demo", demoReason: reason, llm: null, embeddings: resolveEmbeddings(null) };
  }
  const preset = PRESETS[provider];
  const apiKey = env("LLM_API_KEY") || keyFor(provider);
  const baseUrl = (provider === "custom" ? env("LLM_BASE_URL") : env("LLM_BASE_URL") || preset.baseUrl).replace(/\/$/, "");
  const model = env("LLM_MODEL") || preset.model;
  if (!apiKey || !baseUrl || !model) {
    return {
      mode: "demo",
      demoReason: !apiKey ? `No API key found for ${preset.label}` : "LLM_BASE_URL and LLM_MODEL are required for a custom provider",
      llm: null,
      embeddings: resolveEmbeddings(provider),
    };
  }
  const timeout = Number(env("LLM_TIMEOUT_MS"));
  return {
    mode: "live",
    demoReason: null,
    llm: {
      provider,
      label: preset.label,
      baseUrl,
      apiKey,
      model,
      timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 90_000,
      // gpt-oss reasons before answering and the reasoning counts toward max_tokens; keep it short by default.
      reasoningEffort: env("LLM_REASONING_EFFORT") || (/gpt-oss/i.test(model) ? "low" : null),
      judge: !/^(0|false|no)$/i.test(env("GROUNDING_JUDGE")),
    },
    embeddings: resolveEmbeddings(provider),
  };
}

/** Browser-safe summary of the current mode. */
export function publicAiStatus() {
  const c = getAiConfig();
  return {
    mode: c.mode,
    demoReason: c.demoReason,
    provider: c.llm?.label ?? null,
    model: c.llm?.model ?? null,
    retrieval: c.embeddings ? ("hybrid" as const) : ("bm25" as const),
    embeddingModel: c.embeddings?.model ?? null,
    groundingJudge: c.llm?.judge ?? false,
  };
}
