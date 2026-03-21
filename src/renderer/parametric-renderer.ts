/**
 * Parametric curve renderer.
 *
 * Generates SVG path data from mathematical functions server-side.
 * The AI provides named function and parameters. The server computes all coordinates.
 *
 * Supported functions:
 *   rose         rhodonea petal curves: r = scale * cos(k * theta)
 *   lissajous    harmonic oscillation patterns: x = A*sin(a*t+d), y = B*sin(b*t)
 *   spiral       archimedean (r = a*t) or logarithmic (r = a*e^(b*t))
 *   heart        classic parametric heart curve
 *   star         regular star polygon with alternating outer and inner radii
 *   superformula Gielis formula generalizing many natural shapes
 *   epitrochoid  outer spirograph curve
 *   hypotrochoid inner spirograph curve
 *   wave         sine wave path
 */

import type { Parametric } from "../schemas/patterns.js";
import { renderBaseAttrs } from "./base-renderer.js";
import { renderSMILAnimations } from "./animation-renderer.js";
import { blockTag, tag, num } from "./utils.js";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Convert sampled points to SVG path data string. */
function pointsToPath(pts: [number, number][], closed: boolean): string {
  if (pts.length === 0) return "M 0 0";
  const parts = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${num(x)} ${num(y)}`);
  if (closed) parts.push("Z");
  return parts.join(" ");
}

/** Greatest common divisor (for computing trochoid periods). */
function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b > 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

// ---------------------------------------------------------------------------
// Curve generators
// ---------------------------------------------------------------------------

function generateRose(p: Parametric): [number, number][] {
  const cx = p.cx ?? 0;
  const cy = p.cy ?? 0;
  const k = p.k ?? 3;
  const scale = p.scale ?? 80;
  const steps = p.steps ?? 360;
  // Period: for even k → 2π (produces 2k petals), for odd k → π (produces k petals).
  // Using 2π safely covers both cases (odd k traces petals twice, still correct path).
  const period = 2 * Math.PI;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * period;
    const r = scale * Math.cos(k * t);
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  });
}

function generateHeart(p: Parametric): [number, number][] {
  const cx = p.cx ?? 0;
  const cy = p.cy ?? 0;
  const scale = p.scale ?? 80;
  const steps = p.steps ?? 300;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * 2 * Math.PI;
    // Classic parametric heart curve (normalised to fit within ±scale)
    const x = cx + (scale / 16) * 16 * Math.pow(Math.sin(t), 3);
    const y =
      cy -
      (scale / 16) *
        (13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t));
    return [x, y];
  });
}

function generateStar(p: Parametric): [number, number][] {
  const cx = p.cx ?? 0;
  const cy = p.cy ?? 0;
  const scale = p.scale ?? 80;
  const n = p.points ?? 5;
  const inner = p.innerRadius ?? scale * 0.4;
  return Array.from({ length: n * 2 }, (_, i) => {
    // Start at top (-π/2) and alternate outer/inner radii
    const angle = (i / (n * 2)) * 2 * Math.PI - Math.PI / 2;
    const r = i % 2 === 0 ? scale : inner;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}

function generateLissajous(p: Parametric): [number, number][] {
  const cx = p.cx ?? 0;
  const cy = p.cy ?? 0;
  const freqA = p.freqA ?? 3;
  const freqB = p.freqB ?? 2;
  const delta = p.delta ?? Math.PI / 2;
  const sx = p.scaleX ?? p.scale ?? 80;
  const sy = p.scaleY ?? p.scale ?? 80;
  const steps = p.steps ?? 500;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * 2 * Math.PI;
    return [cx + sx * Math.sin(freqA * t + delta), cy + sy * Math.sin(freqB * t)];
  });
}

function generateSpiral(p: Parametric): [number, number][] {
  const cx = p.cx ?? 0;
  const cy = p.cy ?? 0;
  const scale = p.scale ?? 5;
  const turns = p.turns ?? 3;
  const growth = p.growth ?? 0.2;
  const steps = p.steps ?? 500;
  const totalAngle = turns * 2 * Math.PI;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * totalAngle;
    const r =
      p.spiralType === "logarithmic"
        ? scale * Math.exp(growth * t)
        : scale * t; // archimedean: r = a·t
    // Start at top (-π/2)
    return [cx + r * Math.cos(t - Math.PI / 2), cy + r * Math.sin(t - Math.PI / 2)];
  });
}

function generateSuperformula(p: Parametric): [number, number][] {
  const cx = p.cx ?? 0;
  const cy = p.cy ?? 0;
  const scale = p.scale ?? 80;
  const m = p.m ?? 4;
  const n1 = p.n1 ?? 1;
  const n2 = p.n2 ?? 1;
  const n3 = p.n3 ?? 1;
  const steps = p.steps ?? 360;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const theta = (i / steps) * 2 * Math.PI;
    const t1 = Math.pow(Math.abs(Math.cos((m * theta) / 4)), n2);
    const t2 = Math.pow(Math.abs(Math.sin((m * theta) / 4)), n3);
    const base = t1 + t2;
    const r = base === 0 ? 0 : scale * Math.pow(base, -1 / n1);
    const rSafe = isFinite(r) ? r : 0;
    return [cx + rSafe * Math.cos(theta), cy + rSafe * Math.sin(theta)];
  });
}

function generateEpitrochoid(p: Parametric): [number, number][] {
  const cx = p.cx ?? 0;
  const cy = p.cy ?? 0;
  const R = p.R ?? 80;
  const r = p.r ?? 30;
  const d = p.d ?? 50;
  const steps = p.steps ?? 500;
  // Full period: lcm(R, r) / r full rotations of the rolling circle
  const g = gcd(R, r);
  const periodFactor = r / g; // number of rolling-circle rotations for one full period
  const period = 2 * Math.PI * periodFactor;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * period;
    const x = cx + (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
    const y = cy + (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
    return [x, y];
  });
}

function generateHypotrochoid(p: Parametric): [number, number][] {
  const cx = p.cx ?? 0;
  const cy = p.cy ?? 0;
  const R = p.R ?? 80;
  const r = p.r ?? 30;
  const d = p.d ?? 50;
  const steps = p.steps ?? 500;
  const g = gcd(R, r);
  const periodFactor = r / g;
  const period = 2 * Math.PI * periodFactor;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * period;
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    return [x, y];
  });
}

function generateWave(p: Parametric): [number, number][] {
  const cx = p.cx ?? 0;
  const cy = p.cy ?? 0;
  const waveWidth = p.width ?? 400;
  const amplitude = p.amplitude ?? 30;
  const frequency = p.frequency ?? 2;
  const phase = p.phase ?? 0;
  const steps = p.steps ?? 200;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const x = cx + t * waveWidth;
    const y = cy + amplitude * Math.sin(frequency * 2 * Math.PI * t + phase);
    return [x, y];
  });
}

// ---------------------------------------------------------------------------
// Default closed state per function
// ---------------------------------------------------------------------------

const CLOSED_BY_DEFAULT = new Set<Parametric["fn"]>([
  "rose",
  "heart",
  "star",
  "superformula",
  "epitrochoid",
  "hypotrochoid",
  // wave, lissajous, spiral default to open
]);

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export function renderParametric(el: Parametric): string {
  let points: [number, number][];
  switch (el.fn) {
    case "rose":
      points = generateRose(el);
      break;
    case "heart":
      points = generateHeart(el);
      break;
    case "star":
      points = generateStar(el);
      break;
    case "lissajous":
      points = generateLissajous(el);
      break;
    case "spiral":
      points = generateSpiral(el);
      break;
    case "superformula":
      points = generateSuperformula(el);
      break;
    case "epitrochoid":
      points = generateEpitrochoid(el);
      break;
    case "hypotrochoid":
      points = generateHypotrochoid(el);
      break;
    case "wave":
      points = generateWave(el);
      break;
  }

  const closed = el.closed ?? CLOSED_BY_DEFAULT.has(el.fn);
  const d = pointsToPath(points, closed);
  const baseStr = renderBaseAttrs(el);
  const smil = renderSMILAnimations(el.smilAnimations);

  if (smil) {
    return blockTag("path", `d="${d}" ${baseStr}`, smil);
  }
  return tag("path", `d="${d}" ${baseStr}`);
}
