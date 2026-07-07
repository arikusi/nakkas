/**
 * CSS easing function evaluation for animation frame sampling.
 *
 * Supports the values TimingFunctionSchema documents: linear, ease, ease-in,
 * ease-out, ease-in-out, cubic-bezier(x1, y1, x2, y2) and steps(n[, position]).
 * Unknown strings fall back to linear so sampling never throws on user input.
 */

export type EasingFn = (t: number) => number;

/**
 * Build a cubic bezier easing function with fixed endpoints (0,0) and (1,1).
 * Solves x(u) = t for u via Newton-Raphson with a bisection fallback, then
 * returns y(u) — the standard CSS timing function evaluation.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const sampleDX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

  const solveU = (t: number): number => {
    // Newton-Raphson
    let u = t;
    for (let i = 0; i < 8; i++) {
      const x = sampleX(u) - t;
      if (Math.abs(x) < 1e-6) return u;
      const d = sampleDX(u);
      if (Math.abs(d) < 1e-6) break;
      u -= x / d;
    }
    // Bisection fallback
    let lo = 0;
    let hi = 1;
    u = t;
    while (lo < hi) {
      const x = sampleX(u);
      if (Math.abs(x - t) < 1e-6) return u;
      if (x < t) lo = u;
      else hi = u;
      const next = (lo + hi) / 2;
      if (next === u) break;
      u = next;
    }
    return u;
  };

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(solveU(t));
  };
}

function steps(count: number, position: string): EasingFn {
  const n = Math.max(1, Math.floor(count));
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const jump = position === "start" || position === "jump-start" ? Math.ceil(t * n) : Math.floor(t * n);
    return Math.min(1, jump / n);
  };
}

const NAMED: Record<string, EasingFn> = {
  "linear": (t) => t,
  "ease": cubicBezier(0.25, 0.1, 0.25, 1),
  "ease-in": cubicBezier(0.42, 0, 1, 1),
  "ease-out": cubicBezier(0, 0, 0.58, 1),
  "ease-in-out": cubicBezier(0.42, 0, 0.58, 1),
  "step-start": steps(1, "start"),
  "step-end": steps(1, "end"),
};

/** Resolve a CSS timing-function string to an evaluatable easing function. */
export function resolveEasing(spec: string | undefined): EasingFn {
  const s = (spec ?? "ease").trim().toLowerCase();
  if (NAMED[s]) return NAMED[s];

  const bezier = s.match(/^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);
  if (bezier) {
    const [x1, y1, x2, y2] = bezier.slice(1).map(Number);
    if ([x1, y1, x2, y2].every(Number.isFinite)) return cubicBezier(x1, y1, x2, y2);
  }

  const step = s.match(/^steps\(\s*(\d+)\s*(?:,\s*([a-z-]+)\s*)?\)$/);
  if (step) return steps(Number(step[1]), step[2] ?? "end");

  return NAMED["linear"];
}
