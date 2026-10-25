import { afterEach, beforeEach, vi } from "vitest";

const PROVIDER_ENV = [
  "LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL", "LLM_BASE_URL", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GROQ_API_KEY",
  "OPENROUTER_API_KEY", "OPENAI_API_KEY", "EMBEDDING_PROVIDER", "EMBEDDING_API_KEY", "EMBEDDING_MODEL",
  "DEMO_MODE", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN",
  "VERCEL", "MAX_UPLOAD_MB", "GROUNDING_JUDGE",
];

// Tests never use the developer's real keys or storage.
beforeEach(() => {
  for (const name of PROVIDER_ENV) vi.stubEnv(name, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
