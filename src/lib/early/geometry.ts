import type { Point } from "./types";

/* ------------------------------------------------------------------ SVG paths */

type Seg =
  | { kind: "M"; to: Point }
  | { kind: "L"; to: Point }
  | { kind: "C"; c1: Point; c2: Point; to: Point }
  | { kind: "Q"; c: Point; to: Point }
  | { kind: "Z" };

const TOKEN = /[MLHVCQZmlhvcqz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;

/** Parses the subset of SVG path syntax used by authored strokes and font outlines. */
export function parsePath(d: string): Seg[] {
  const tokens = d.match(TOKEN) ?? [];
  const out: Seg[] = [];
  let i = 0;
  let cmd = "";
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  const num = () => {
    const t = tokens[i++];
    if (t === undefined || /[a-z]/i.test(t)) throw new Error(`Malformed path data near token ${i}`);
    return parseFloat(t);
  };
  const pt = (rel: boolean): Point => {
    const x = num();
    const y = num();
    return rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
  };

  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new Error("Path data must start with a command");
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M": {
        cur = start = pt(rel);
        out.push({ kind: "M", to: cur });
        cmd = rel ? "l" : "L"; // implicit lineto after moveto
        break;
      }
      case "L":
        cur = pt(rel);
        out.push({ kind: "L", to: cur });
        break;
      case "H": {
        const x = num();
        cur = { x: rel ? cur.x + x : x, y: cur.y };
        out.push({ kind: "L", to: cur });
        break;
      }
      case "V": {
        const y = num();
        cur = { x: cur.x, y: rel ? cur.y + y : y };
        out.push({ kind: "L", to: cur });
        break;
      }
      case "C": {
        const c1 = pt(rel);
        const c2 = pt(rel);
        const to = pt(rel);
        out.push({ kind: "C", c1, c2, to });
        cur = to;
        break;
      }
      case "Q": {
        const c = pt(rel);
        const to = pt(rel);
        out.push({ kind: "Q", c, to });
        cur = to;
        break;
      }
      case "Z":
        out.push({ kind: "Z" });
        cur = start;
        cmd = "";
        break;
      default:
        throw new Error(`Unsupported path command ${cmd}`);
    }
  }
  return out;
}

/** Flattens a path into polylines (one per sub-path). */
export function flattenPath(d: string, stepsPerCurve = 24): Point[][] {
  const polys: Point[][] = [];
  let poly: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  for (const s of parsePath(d)) {
    if (s.kind === "M") {
      if (poly.length > 1) polys.push(poly);
      poly = [s.to];
      cur = start = s.to;
    } else if (s.kind === "L") {
      poly.push(s.to);
      cur = s.to;
    } else if (s.kind === "C") {
      for (let k = 1; k <= stepsPerCurve; k++) {
        const t = k / stepsPerCurve;
        const u = 1 - t;
        poly.push({
          x: u * u * u * cur.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x,
          y: u * u * u * cur.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y,
        });
      }
      cur = s.to;
    } else if (s.kind === "Q") {
      for (let k = 1; k <= stepsPerCurve; k++) {
        const t = k / stepsPerCurve;
        const u = 1 - t;
        poly.push({
          x: u * u * cur.x + 2 * u * t * s.c.x + t * t * s.to.x,
          y: u * u * cur.y + 2 * u * t * s.c.y + t * t * s.to.y,
        });
      }
      cur = s.to;
    } else {
      poly.push(start);
      cur = start;
    }
  }
  if (poly.length > 1) polys.push(poly);
  return polys;
}

export function polylineLength(poly: Point[]): number {
  let len = 0;
  for (let i = 1; i < poly.length; i++) len += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
  return len;
}

/** Points every `spacing` units along a polyline (always includes both ends). */
export function samplePolyline(poly: Point[], spacing: number): Point[] {
  if (poly.length === 0) return [];
  const out: Point[] = [poly[0]];
  let carry = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) continue;
    let dist = spacing - carry;
    while (dist <= seg) {
      const t = dist / seg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      dist += spacing;
    }
    carry = seg - (dist - spacing);
  }
  const last = poly[poly.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > spacing * 0.25) out.push(last);
  return out;
}

/** Samples an SVG path and normalises to 0..1 using the glyph grid size. */
export function samplePathNormalized(d: string, gridSize = 200, spacing = 3): Point[] {
  return flattenPath(d)
    .flatMap((poly) => samplePolyline(poly, spacing))
    .map((p) => ({ x: p.x / gridSize, y: p.y / gridSize }));
}

/** Start point and initial heading of a stroke, for numbered start dots and arrows. */
export function strokeStart(d: string): { start: Point; angle: number } {
  const poly = flattenPath(d)[0] ?? [{ x: 0, y: 0 }];
  const start = poly[0];
  const ahead = samplePolyline(poly, 14)[1] ?? poly[1] ?? start;
  return { start, angle: Math.atan2(ahead.y - start.y, ahead.x - start.x) };
}

/* ------------------------------------------------------------- coordinates */

/** Pointer position → normalised 0..1 canvas coordinates (clamped to the canvas). */
export function toNormalized(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): Point {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) };
}

export function fromNormalized(p: Point, width: number, height: number): Point {
  return { x: p.x * width, y: p.y * height };
}

/** Fills gaps in a stroke so fast pointer moves still register continuous ink. */
export function densify(stroke: Point[], maxGap: number): Point[] {
  if (stroke.length < 2) return stroke.slice();
  const out: Point[] = [stroke[0]];
  for (let i = 1; i < stroke.length; i++) {
    const a = stroke[i - 1];
    const b = stroke[i];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.ceil(dist / maxGap);
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/* ---------------------------------------------------------------- coverage */

export interface GuideGroup {
  id: string;
  /** Number shown on the stroke (English) or region name key (Hindi). */
  label: string;
  points: Point[];
}

export type TraceVerdict = "empty" | "great" | "partial" | "retry" | "offtrack";

export interface TraceScore {
  verdict: TraceVerdict;
  /** Share of guide samples with ink within the threshold (0..1). */
  coverage: number;
  /** Share of the child's ink that lies near the guide (0..1). */
  onGuide: number;
  groups: { id: string; label: string; coverage: number }[];
  weakest: { id: string; label: string; coverage: number } | null;
}

export const TRACE_DEFAULTS = {
  /** Normalised distance; ≈ 18–22 CSS px on a 340–400 px canvas. */
  threshold: 0.055,
  passCoverage: 0.7,
  passOnGuide: 0.55,
  partialCoverage: 0.35,
};

class PointGrid {
  private cells = new Map<string, Point[]>();
  constructor(
    points: Point[],
    private cell: number,
  ) {
    for (const p of points) {
      const k = this.key(Math.floor(p.x / cell), Math.floor(p.y / cell));
      const bucket = this.cells.get(k);
      if (bucket) bucket.push(p);
      else this.cells.set(k, [p]);
    }
  }
  private key(cx: number, cy: number) {
    return `${cx}:${cy}`;
  }
  hasNeighbour(p: Point, radius: number): boolean {
    const r2 = radius * radius;
    const span = Math.ceil(radius / this.cell);
    const cx = Math.floor(p.x / this.cell);
    const cy = Math.floor(p.y / this.cell);
    for (let dx = -span; dx <= span; dx++) {
      for (let dy = -span; dy <= span; dy++) {
        const bucket = this.cells.get(this.key(cx + dx, cy + dy));
        if (!bucket) continue;
        for (const q of bucket) {
          const ex = q.x - p.x;
          const ey = q.y - p.y;
          if (ex * ex + ey * ey <= r2) return true;
        }
      }
    }
    return false;
  }
}

/**
 * Deterministic, formative tracing score. Guide samples count as covered when any
 * ink lies within `threshold`; on-guide ratio catches scribbles that cover the
 * letter by flooding the canvas. Not a handwriting-recognition score.
 */
export function scoreTrace(
  groups: GuideGroup[],
  ink: Point[][],
  options: Partial<typeof TRACE_DEFAULTS> = {},
): TraceScore {
  const o = { ...TRACE_DEFAULTS, ...options };
  const inkPoints = ink.flatMap((s) => densify(s, o.threshold / 3));
  const guidePoints = groups.flatMap((g) => g.points);
  const empty: TraceScore = {
    verdict: "empty",
    coverage: 0,
    onGuide: 0,
    groups: groups.map((g) => ({ id: g.id, label: g.label, coverage: 0 })),
    weakest: null,
  };
  if (inkPoints.length < 3 || guidePoints.length === 0) return empty;

  const inkGrid = new PointGrid(inkPoints, o.threshold);
  let covered = 0;
  const perGroup = groups.map((g) => {
    let hit = 0;
    for (const p of g.points) if (inkGrid.hasNeighbour(p, o.threshold)) hit++;
    covered += hit;
    return { id: g.id, label: g.label, coverage: g.points.length ? hit / g.points.length : 1 };
  });
  const coverage = covered / guidePoints.length;

  const guideGrid = new PointGrid(guidePoints, o.threshold);
  let near = 0;
  for (const p of inkPoints) if (guideGrid.hasNeighbour(p, o.threshold * 1.4)) near++;
  const onGuide = near / inkPoints.length;

  let verdict: TraceVerdict;
  if (coverage >= o.passCoverage && onGuide >= o.passOnGuide) verdict = "great";
  else if (coverage >= o.passCoverage) verdict = "offtrack";
  else if (coverage >= o.partialCoverage) verdict = "partial";
  else if (onGuide < 0.3 && inkPoints.length > 40) verdict = "offtrack";
  else verdict = "retry";

  const candidates = perGroup.filter((g) => g.coverage < 0.6).sort((a, b) => a.coverage - b.coverage);
  return { verdict, coverage, onGuide, groups: perGroup, weakest: candidates[0] ?? null };
}

/** Builds guide groups from authored strokes (one group per numbered stroke). */
export function strokeGroups(strokes: { id: number; d: string }[], gridSize = 200): GuideGroup[] {
  return strokes.map((s) => ({ id: String(s.id), label: String(s.id), points: samplePathNormalized(s.d, gridSize) }));
}

/* ------------------------------------------------------- skeleton (outlines) */

/** Zhang–Suen thinning. `mask` is row-major, 1 = ink. Returns a new 1-pixel-wide skeleton. */
export function zhangSuen(mask: Uint8Array, w: number, h: number): Uint8Array {
  const img = Uint8Array.from(mask);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x]);
  let changed = true;
  const remove: number[] = [];
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      remove.length = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!img[y * w + x]) continue;
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) a++;
          if (a !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0 : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0)
            remove.push(y * w + x);
        }
      }
      if (remove.length) {
        changed = true;
        for (const idx of remove) img[idx] = 0;
      }
    }
  }
  return img;
}

/** Normalised skeleton sample points, thinned to roughly one point per `step` pixels. */
export function skeletonPoints(skeleton: Uint8Array, w: number, h: number, step = 3): Point[] {
  const pts: Point[] = [];
  const taken = new Set<string>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!skeleton[y * w + x]) continue;
      const key = `${Math.floor(x / step)}:${Math.floor(y / step)}`;
      if (taken.has(key)) continue;
      taken.add(key);
      pts.push({ x: (x + 0.5) / w, y: (y + 0.5) / h });
    }
  }
  return pts;
}

/**
 * Splits outline-glyph skeleton points into broad regions so feedback can name
 * a missing area ("the top line", "the left part") without stroke-order data.
 */
export function regionGroups(points: Point[]): GuideGroup[] {
  if (points.length === 0) return [];
  const ys = points.map((p) => p.y);
  const xs = points.map((p) => p.x);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const topCut = minY + (maxY - minY) * 0.16;
  const groups: GuideGroup[] = [
    { id: "top", label: "top", points: points.filter((p) => p.y <= topCut) },
    { id: "left", label: "left", points: points.filter((p) => p.y > topCut && p.x < midX) },
    { id: "right", label: "right", points: points.filter((p) => p.y > topCut && p.x >= midX) },
  ];
  return groups.filter((g) => g.points.length >= 4);
}
