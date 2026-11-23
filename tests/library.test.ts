import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryKV, setKV } from "@/lib/store/kv";
import * as library from "@/app/api/library/route";
import { getChunks } from "@/lib/store/repo";
import catalogue from "@/lib/library/catalogue.json";

const book = (catalogue as { chapters: [string, number, string, number][] }[]).find((b) => b.chapters.some((c) => c[3] >= 2))!;
const [chapterId, , title, count] = book.chapters.find((c) => c[3] >= 2)!;
const post = (body: unknown) =>
  new NextRequest("http://test/api/library", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("textbook library", () => {
  beforeEach(() => {
    setKV(new MemoryKV());
    vi.stubEnv("PINECONE_API_KEY", "k");
    vi.stubEnv("PINECONE_INDEX_HOST", "https://idx.test");
    vi.stubGlobal("fetch", async (url: string) => {
      const ids = [...new URL(url).searchParams.getAll("ids")];
      return Response.json({ vectors: Object.fromEntries(ids.map((id, i) => [id, { metadata: { text: `chunk ${i} of ${id}` } }])) });
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lists books filtered by board/class/medium", async () => {
    const res = await library.GET(new Request(`http://test/api/library?board=${(book as { board?: string }).board}`));
    const { books } = await res.json();
    expect(books.length).toBeGreaterThan(0);
  });

  it("imports one chapter as a ready document with only that chapter's chunks", async () => {
    const res = await library.POST(post({ chapterId }));
    const { document } = await res.json();
    expect(document.status).toBe("ready");
    expect(document.chunkCount).toBe(count);
    expect(document.chapters[0].title).toBe(title);
    const chunks = await getChunks(document);
    expect(chunks).toHaveLength(count);
    expect(chunks.every((c) => c.chapter === title)).toBe(true);
    const again = await (await library.POST(post({ chapterId }))).json();
    expect(again.document.id).toBe(document.id);
  });

  it("rejects unknown chapters", async () => {
    expect((await library.POST(post({ chapterId: "nope-nope" }))).status).toBe(404);
  });
});
