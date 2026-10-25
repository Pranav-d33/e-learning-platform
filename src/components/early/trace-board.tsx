"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { flattenPath, polylineLength, samplePolyline, strokeStart, toNormalized } from "@/lib/early/geometry";
import type { LessonGlyph, Point } from "@/lib/early/types";

export interface TraceBoardHandle {
  getStrokes: () => Point[][];
  clear: () => void;
  undo: () => void;
}

const INK = "#2b3496";

/** Start-dot positions; a stroke sharing an earlier start is nudged along its own path. */
function startMarkers(strokes: { id: number; d: string }[]) {
  const placed: Point[] = [];
  return strokes.map((s) => {
    const { start, angle } = strokeStart(s.d);
    let p = start;
    if (placed.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 16)) {
      p = { x: start.x + Math.cos(angle) * 20, y: start.y + Math.sin(angle) * 20 };
    }
    placed.push(p);
    return { id: s.id, p };
  });
}

/** One chevron per stroke, ~45% along it, pointing in the writing direction. */
function arrows(strokes: { id: number; d: string }[]) {
  return strokes.map((s) => {
    const poly = flattenPath(s.d)[0] ?? [];
    const pts = samplePolyline(poly, 2);
    const i = Math.min(pts.length - 2, Math.max(1, Math.floor(pts.length * 0.45)));
    const a = pts[i];
    const b = pts[i + 1] ?? a;
    return { id: s.id, x: a.x, y: a.y, deg: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
  });
}

export function TraceBoard({
  glyph,
  guideVisible,
  highlight,
  demo,
  onInkChange,
  ref,
  label,
}: {
  glyph: LessonGlyph;
  guideVisible: boolean;
  /** Stroke id to pulse after a partial trace (English). */
  highlight: string | null;
  /** Increment to play the "show me" animation. */
  demo: number;
  onInkChange: (strokeCount: number) => void;
  ref?: Ref<TraceBoardHandle>;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Point[][]>([]);
  const activePointer = useRef<number | null>(null);
  const sizeRef = useRef(0);

  const strokes = useMemo(() => (glyph.kind === "strokes" ? glyph.strokes : []), [glyph]);
  const markers = useMemo(() => startMarkers(strokes), [strokes]);
  const chevrons = useMemo(() => arrows(strokes), [strokes]);
  const demoTimings = useMemo(() => {
    const out: { id: number; d: string; len: number; dur: number; delay: number }[] = [];
    for (const s of strokes) {
      const len = flattenPath(s.d).reduce((sum, p) => sum + polylineLength(p), 0);
      const prev = out.at(-1);
      const delay = prev ? prev.delay + prev.dur + 0.3 : 0.2;
      out.push({ id: s.id, d: s.d, len: Math.ceil(len) + 2, dur: Math.max(0.55, len / 150), delay });
    }
    return out;
  }, [strokes]);

  function redraw() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const size = sizeRef.current;
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = size * 0.052;
    for (const s of strokesRef.current) {
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(s[0].x * size, s[0].y * size, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(s[0].x * size, s[0].y * size);
      for (let i = 1; i < s.length - 1; i++) {
        const mx = ((s[i].x + s[i + 1].x) / 2) * size;
        const my = ((s[i].y + s[i + 1].y) / 2) * size;
        ctx.quadraticCurveTo(s[i].x * size, s[i].y * size, mx, my);
      }
      const last = s[s.length - 1];
      ctx.lineTo(last.x * size, last.y * size);
      ctx.stroke();
    }
  }

  useImperativeHandle(ref, () => ({
    getStrokes: () => strokesRef.current.map((s) => s.slice()),
    clear: () => {
      strokesRef.current = [];
      redraw();
      onInkChange(0);
    },
    undo: () => {
      strokesRef.current = strokesRef.current.slice(0, -1);
      redraw();
      onInkChange(strokesRef.current.length);
    },
  }));

  // Keep the canvas crisp at any size / devicePixelRatio; normalised points survive resizes.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(([entry]) => {
      const size = entry.contentRect.width;
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = size;
      c.width = Math.round(size * dpr);
      c.height = Math.round(size * dpr);
      c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  function point(e: React.PointerEvent | PointerEvent): Point {
    return toNormalized(e.clientX, e.clientY, canvasRef.current!.getBoundingClientRect());
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointer.current !== null || (e.pointerType === "mouse" && e.button !== 0)) return; // ignore extra fingers
    e.preventDefault();
    activePointer.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    strokesRef.current.push([point(e)]);
    redraw();
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointer.current) return;
    e.preventDefault();
    const s = strokesRef.current[strokesRef.current.length - 1];
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    const ctx = canvasRef.current!.getContext("2d")!;
    const size = sizeRef.current;
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = point(ev);
      const prev = s[s.length - 1];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < 0.002) continue;
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.strokeStyle = INK;
      ctx.lineWidth = size * 0.052;
      ctx.moveTo(prev.x * size, prev.y * size);
      ctx.lineTo(p.x * size, p.y * size);
      ctx.stroke();
      s.push(p);
    }
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
    redraw(); // replace segment preview with the smoothed stroke
    onInkChange(strokesRef.current.length);
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-white ring-4 ring-sky/25 shadow-[0_8px_0_oklch(0.86_0.04_236)]">
      <svg viewBox={glyph.viewBox} className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        {glyph.kind === "strokes" && (
          <g stroke="oklch(0.86 0.03 236)" strokeWidth="0.8">
            <line x1="8" x2="192" y1="30" y2="30" />
            <line x1="8" x2="192" y1="100" y2="100" strokeDasharray="4 4" />
            <line x1="8" x2="192" y1="170" y2="170" strokeWidth="1.4" />
          </g>
        )}
        {guideVisible && glyph.kind === "outline" && <path d={glyph.outline} fill="var(--color-guide)" />}
        {guideVisible &&
          strokes.map((s) => (
            <path key={`g${s.id}`} d={s.d} fill="none" stroke="var(--color-guide)" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        {highlight &&
          strokes
            .filter((s) => String(s.id) === highlight)
            .map((s) => (
              <path key={`h${s.id}`} className="stroke-hint" d={s.d} fill="none" stroke="var(--color-sun)" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
            ))}
        {guideVisible &&
          strokes.map((s) => (
            <path key={`c${s.id}`} d={s.d} fill="none" stroke="oklch(0.74 0.02 75)" strokeWidth="1.5" strokeDasharray="3 5" strokeLinecap="round" />
          ))}
        {guideVisible &&
          chevrons.map((a) => (
            <path
              key={`a${a.id}`}
              d="M-4.5 -5 L1.5 0 L-4.5 5"
              transform={`translate(${a.x} ${a.y}) rotate(${a.deg})`}
              fill="none"
              stroke="var(--color-leaf-deep)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        {guideVisible &&
          markers.map((m) => (
            <g key={`m${m.id}`}>
              <circle cx={m.p.x} cy={m.p.y} r="9.5" fill="var(--color-leaf)" stroke="white" strokeWidth="2" />
              <text x={m.p.x} y={m.p.y + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="white" fontFamily="var(--font-baloo), sans-serif">
                {m.id}
              </text>
            </g>
          ))}
      </svg>
      <canvas
        ref={canvasRef}
        aria-label={label}
        role="img"
        className="absolute inset-0 size-full cursor-crosshair touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
      />
      {demo > 0 && (
        // Above the ink, so "show me" stays visible even after the child has drawn.
        <svg viewBox={glyph.viewBox} className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
          <g
            key={demo}
            className="demo-fade"
            style={{ "--fade-delay": `${(demoTimings.at(-1)?.delay ?? 0) + (demoTimings.at(-1)?.dur ?? 0) + 0.9}s` } as React.CSSProperties}
          >
            {demoTimings.map((t) => (
              <path
                key={`d${t.id}`}
                className="draw-stroke"
                d={t.d}
                fill="none"
                stroke="var(--color-tang)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ "--len": t.len, "--dur": `${t.dur}s`, "--delay": `${t.delay}s` } as React.CSSProperties}
              />
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}
