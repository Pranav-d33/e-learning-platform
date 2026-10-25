import "server-only";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface KV {
  readonly kind: "file" | "upstash" | "memory";
  /** False when data may disappear between requests or deploys (serverless /tmp). */
  readonly durable: boolean;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(keys: string[]): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export class MemoryKV implements KV {
  readonly kind = "memory" as const;
  readonly durable = false;
  private map = new Map<string, string>();
  async get<T>(key: string) {
    const v = this.map.get(key);
    return v === undefined ? null : (JSON.parse(v) as T);
  }
  async set(key: string, value: unknown) {
    this.map.set(key, JSON.stringify(value));
  }
  async del(keys: string[]) {
    for (const k of keys) this.map.delete(k);
  }
  async keys(prefix: string) {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
}

/** One JSON file per key. Writes are atomic (temp file + rename). */
export class FileKV implements KV {
  readonly kind = "file" as const;
  constructor(
    private dir: string,
    readonly durable: boolean,
  ) {}
  private file(key: string) {
    return path.join(this.dir, `${encodeURIComponent(key)}.json`);
  }
  async get<T>(key: string) {
    try {
      return JSON.parse(await readFile(this.file(key), "utf8")) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
  async set(key: string, value: unknown) {
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.file(key)}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(value));
    await rename(tmp, this.file(key));
  }
  async del(keys: string[]) {
    await Promise.all(keys.map((k) => rm(this.file(k), { force: true })));
  }
  async keys(prefix: string) {
    try {
      return (await readdir(this.dir))
        .filter((f) => f.endsWith(".json"))
        .map((f) => decodeURIComponent(f.slice(0, -5)))
        .filter((k) => k.startsWith(prefix));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
}

/** Upstash Redis over its REST API (works on serverless; no TCP client needed). */
export class UpstashKV implements KV {
  readonly kind = "upstash" as const;
  readonly durable = true;
  constructor(
    private url: string,
    private token: string,
  ) {}
  private async cmd<T>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!res.ok || data.error) throw new Error(`Upstash ${args[0]} failed: ${data.error ?? res.status}`);
    return data.result as T;
  }
  async get<T>(key: string) {
    const raw = await this.cmd<string | null>("GET", key);
    return raw == null ? null : (JSON.parse(raw) as T);
  }
  async set(key: string, value: unknown) {
    await this.cmd("SET", key, JSON.stringify(value));
  }
  async del(keys: string[]) {
    if (keys.length) await this.cmd("DEL", ...keys);
  }
  async keys(prefix: string) {
    const out: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await this.cmd<[string, string[]]>("SCAN", cursor, "MATCH", `${prefix}*`, "COUNT", 500);
      out.push(...batch);
      cursor = next;
    } while (cursor !== "0");
    return out;
  }
}

let instance: KV | null = null;

export function getKV(): KV {
  if (instance) return instance;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) instance = new UpstashKV(url, token);
  else if (process.env.VERCEL) instance = new FileKV(process.env.DATA_DIR || "/tmp/alp-data", false);
  else instance = new FileKV(process.env.DATA_DIR || path.join(process.cwd(), ".data"), true);
  return instance;
}

/** Test hook. */
export function setKV(kv: KV | null) {
  instance = kv;
}

export function storageStatus() {
  const kv = getKV();
  return {
    kind: kv.kind,
    durable: kv.durable,
    label:
      kv.kind === "upstash"
        ? "Upstash Redis (persistent)"
        : kv.kind === "memory"
          ? "In-memory (temporary)"
          : kv.durable
            ? "Local files (.data/)"
            : "Serverless temp storage (cleared when the instance recycles)",
  };
}
