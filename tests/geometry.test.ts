import { describe, expect, it } from "vitest";
import {
  densify,
  flattenPath,
  parsePath,
  regionGroups,
  samplePathNormalized,
  samplePolyline,
  scoreTrace,
  skeletonPoints,
  strokeGroups,
  strokeStart,
  toNormalized,
  zhangSuen,
} from "@/lib/early/geometry";
import { EN_STROKES } from "@/lib/early/strokes-en";
import type { Point } from "@/lib/early/types";

describe("SVG path handling", () => {
  it("parses absolute and relative commands", () => {
    const segs = parsePath("M10 10 L20 10 h10 v10 l-5 5 Z");
    expect(segs.map((s) => s.kind)).toEqual(["M", "L", "L", "L", "L", "Z"]);
  });

  it("flattens curves and keeps endpoints", () => {
    const [poly] = flattenPath("M0 0 C0 100 100 100 100 0");
    expect(poly[0]).toEqual({ x: 0, y: 0 });
    expect(poly.at(-1)).toEqual({ x: 100, y: 0 });
    expect(Math.max(...poly.map((p) => p.y))).toBeCloseTo(75, 0);
  });

  it("samples polylines at an even spacing", () => {
    const pts = samplePolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 2);
    expect(pts.map((p) => p.x)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("normalises samples into 0..1 using the glyph grid", () => {
    const pts = samplePathNormalized("M0 0 L200 200", 200, 10);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts.at(-1)!.x).toBeCloseTo(1);
    expect(pts.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(true);
  });

  it("reports start point and heading for arrows", () => {
    const { start, angle } = strokeStart("M100 30 L100 170");
    expect(start).toEqual({ x: 100, y: 30 });
    expect(angle).toBeCloseTo(Math.PI / 2);
  });

  it("parses every authored English stroke inside the grid", () => {
    for (const [letter, strokes] of Object.entries(EN_STROKES)) {
      expect(strokes.length, letter).toBeGreaterThan(0);
      for (const s of strokes) {
        const pts = flattenPath(s.d).flat();
        expect(pts.every((p) => p.x >= 0 && p.x <= 200 && p.y >= 0 && p.y <= 200), letter).toBe(true);
      }
    }
  });
});

describe("coordinate normalisation", () => {
  const rect = { left: 100, top: 50, width: 400, height: 400 };
  it("maps client coordinates into 0..1 and clamps outside points", () => {
    expect(toNormalized(300, 250, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(toNormalized(50, 900, rect)).toEqual({ x: 0, y: 1 });
  });
  it("is resolution independent", () => {
    const small = toNormalized(150, 100, { left: 100, top: 50, width: 200, height: 200 });
    const large = toNormalized(200, 150, { left: 100, top: 50, width: 400, height: 400 });
    expect(small).toEqual(large);
  });
  it("densifies sparse strokes", () => {
    const d = densify([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0.1);
    expect(d.length).toBe(11);
  });
});

describe("trace coverage scoring", () => {
  const groups = strokeGroups(EN_STROKES.L);
  const trace = (strokeIds: string[]): Point[][] =>
    groups.filter((g) => strokeIds.includes(g.id)).map((g) => g.points);

  it("treats an empty canvas as empty, never success", () => {
    expect(scoreTrace(groups, []).verdict).toBe("empty");
    expect(scoreTrace(groups, [[{ x: 0.5, y: 0.5 }]]).verdict).toBe("empty");
  });

  it("passes a full, accurate trace", () => {
    const s = scoreTrace(groups, trace(["1", "2"]));
    expect(s.verdict).toBe("great");
    expect(s.coverage).toBeGreaterThan(0.95);
    expect(s.onGuide).toBeGreaterThan(0.95);
  });

  it("tolerates a slightly offset trace within the threshold", () => {
    const shifted = trace(["1", "2"]).map((st) => st.map((p) => ({ x: p.x + 0.03, y: p.y + 0.02 })));
    expect(scoreTrace(groups, shifted).verdict).toBe("great");
  });

  it("names the missing stroke on a partial trace", () => {
    const s = scoreTrace(groups, trace(["1"]));
    expect(s.verdict).toBe("partial");
    expect(s.weakest?.label).toBe("2");
  });

  it("rejects scribbles that flood the canvas", () => {
    const scribble: Point[][] = [];
    for (let y = 0.02; y < 1; y += 0.05) scribble.push([{ x: 0, y }, { x: 1, y }]);
    const s = scoreTrace(groups, scribble);
    expect(s.coverage).toBeGreaterThan(0.7);
    expect(s.verdict).toBe("offtrack");
  });

  it("does not reward ink far from the letter", () => {
    const s = scoreTrace(groups, [[{ x: 0.85, y: 0.05 }, { x: 0.95, y: 0.4 }]]);
    expect(s.coverage).toBe(0);
    expect(["retry", "offtrack"]).toContain(s.verdict);
  });

  it("is unaffected by stroke order or direction", () => {
    const reversed = trace(["2", "1"]).map((st) => [...st].reverse());
    expect(scoreTrace(groups, reversed).verdict).toBe("great");
  });
});

describe("outline skeletons (Hindi guides)", () => {
  it("thins a thick bar to a one-pixel line", () => {
    const w = 40, h = 20;
    const mask = new Uint8Array(w * h);
    for (let y = 6; y < 14; y++) for (let x = 4; x < 36; x++) mask[y * w + x] = 1;
    const skel = zhangSuen(mask, w, h);
    const rows = new Set<number>();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (skel[y * w + x]) rows.add(y);
    expect(rows.size).toBeLessThanOrEqual(2);
    expect(skeletonPoints(skel, w, h, 3).length).toBeGreaterThan(5);
  });

  it("splits skeleton points into top/left/right regions", () => {
    const pts: Point[] = [];
    for (let x = 0.2; x <= 0.8; x += 0.02) pts.push({ x, y: 0.3 }); // headline
    for (let y = 0.35; y <= 0.8; y += 0.02) pts.push({ x: 0.3, y }, { x: 0.7, y });
    const ids = regionGroups(pts).map((g) => g.id);
    expect(ids).toEqual(["top", "left", "right"]);
  });
});
