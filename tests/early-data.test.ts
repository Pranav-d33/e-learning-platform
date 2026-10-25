import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { audioManifest } from "@/lib/early/audio-manifest";
import { FEEDBACK_LINES, traceFeedback } from "@/lib/early/feedback";
import { flattenPath, scoreTrace } from "@/lib/early/geometry";
import { HI_OUTLINES } from "@/lib/early/glyphs-hi";
import { getLesson, getLessons, neighbours } from "@/lib/early/lessons";
import { PICTURE_SOURCES } from "@/lib/early/pictures";

const pub = (p: string) => path.join(process.cwd(), "public", p);

describe("curated lesson data", () => {
  it("covers English A–Z with 2–3 example words each", () => {
    const en = getLessons("en");
    expect(en.map((l) => l.character).join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    for (const l of en) {
      expect(l.exampleWords.length, l.character).toBeGreaterThanOrEqual(2);
      expect(l.exampleWords.length, l.character).toBeLessThanOrEqual(3);
      expect(l.glyph.kind).toBe("strokes");
    }
  });

  it("has a Hindi set of vowels and consonants with outlines", () => {
    const hi = getLessons("hi");
    expect(hi.filter((l) => l.group === "vowel").length).toBe(10);
    expect(hi.filter((l) => l.group === "consonant").length).toBe(8);
    for (const l of hi) {
      expect(l.glyph.kind).toBe("outline");
      expect(HI_OUTLINES[l.character], l.character).toBeTruthy();
      expect(flattenPath(HI_OUTLINES[l.character]).length).toBeGreaterThan(0);
    }
  });

  it("uses unique, URL-safe slugs", () => {
    for (const lang of ["en", "hi"] as const) {
      const slugs = getLessons(lang).map((l) => l.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(slugs.every((s) => /^[a-z]+$/.test(s))).toBe(true);
    }
  });

  it("navigates between neighbouring letters", () => {
    expect(neighbours("en", "a").prev).toBeNull();
    expect(neighbours("en", "a").next?.slug).toBe("b");
    expect(neighbours("hi", "tta").next).toBeNull();
    expect(getLesson("hi", "kha")?.character).toBe("ख");
  });

  it("bundles every audio clip and picture it references", () => {
    const missingAudio = audioManifest().filter((c) => !existsSync(pub(c.path)));
    expect(missingAudio.map((c) => c.path)).toEqual([]);
    const usedPictures = new Set([...getLessons("en"), ...getLessons("hi")].flatMap((l) => l.exampleWords.map((w) => w.image)));
    for (const key of usedPictures) {
      expect(PICTURE_SOURCES[key], key).toBeTruthy();
      expect(existsSync(pub(`pictures/${key}.svg`)), key).toBe(true);
    }
  });
});

describe("spoken feedback", () => {
  it("has a line for every verdict in both languages", () => {
    const empty = scoreTrace([], []);
    for (const lang of ["en", "hi"] as const) {
      for (const verdict of ["empty", "great", "partial", "retry", "offtrack"] as const) {
        const fb = traceFeedback(lang, { ...empty, verdict });
        expect(fb.spoken.text).toBeTruthy();
        expect(existsSync(pub(fb.spoken.audio)), fb.spoken.audio).toBe(true);
      }
    }
  });

  it("points at the weakest stroke or region", () => {
    const base = scoreTrace([], []);
    const en = traceFeedback("en", { ...base, verdict: "partial", weakest: { id: "3", label: "3", coverage: 0.1 } });
    expect(en.spoken.text).toBe(FEEDBACK_LINES.en["line-3"]);
    const hi = traceFeedback("hi", { ...base, verdict: "partial", weakest: { id: "top", label: "top", coverage: 0.1 } });
    expect(hi.spoken.text).toBe(FEEDBACK_LINES.hi.top);
  });

  it("never uses punitive wording", () => {
    const all = Object.values(FEEDBACK_LINES.en).join(" ").toLowerCase();
    for (const word of ["wrong", "bad", "fail", "incorrect"]) expect(all).not.toContain(word);
  });
});
