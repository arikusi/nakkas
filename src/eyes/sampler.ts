/**
 * Animation frame sampling: compute the visual state of a config's CSS
 * animations at an arbitrary time t and bake it into a static config.
 *
 * This is what lets the preview stop lying about motion — resvg renders
 * static SVG only, so instead of showing the base state we evaluate the
 * @keyframes math ourselves (duration, delay, iteration count, direction,
 * fill mode, easing per segment) and write the sampled values back onto the
 * elements as plain attributes.
 *
 * CSS `transform` needs special care: browsers resolve transform-box:
 * fill-box / transform-origin: center at layout time, which a string
 * renderer cannot. We compute the element's bounding-box center from its
 * geometry (shapes, pattern groups, groups of shapes) and wrap the sampled
 * transform in translate(origin) ... translate(-origin). Elements whose
 * origin cannot be derived keep their base state and produce a note.
 */

import type { SVGConfig, AnyElement } from "../schemas/config.js";
import type { CSSAnimation } from "../schemas/animations.js";
import { resolveEasing } from "./easing.js";
import { lerpValue } from "./interpolate.js";
import { num } from "../renderer/utils.js";

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** Parse a CSS duration ("2s", "500ms", "1.5s") to seconds. Invalid → 0. */
export function parseDuration(s: string | undefined): number {
  if (!s) return 0;
  const m = s.trim().match(/^(-?\d*\.?\d+)\s*(ms|s)?$/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  return (m[2] ?? "s").toLowerCase() === "ms" ? v / 1000 : v;
}

/**
 * Timeline length of one animation in seconds: delay plus one cycle for
 * infinite animations, delay plus all iterations for finite ones.
 */
function animationSpan(anim: CSSAnimation): number {
  const dur = parseDuration(anim.duration);
  const delay = parseDuration(anim.delay);
  const count = anim.iterationCount === "infinite" ? 1 : (anim.iterationCount ?? 1);
  return delay + dur * count;
}

/** Total timeline of a config's CSS animations (0 when there are none). */
export function configTimeline(config: SVGConfig): number {
  return Math.max(0, ...(config.animations ?? []).map(animationSpan));
}

/** True when every animation loops forever (frame times should skip t=T). */
export function allInfinite(config: SVGConfig): boolean {
  const anims = config.animations ?? [];
  return anims.length > 0 && anims.every((a) => a.iterationCount === "infinite");
}

// ---------------------------------------------------------------------------
// Keyframe evaluation
// ---------------------------------------------------------------------------

interface Stop {
  offset: number; // 0..1
  properties: Record<string, string>;
}

/** Normalize keyframe offsets exactly the way the CSS renderer does. */
function normalizeStops(anim: CSSAnimation): Stop[] {
  const stops = anim.keyframes.map((kf) => {
    let offset: number;
    if (kf.offset === "from") offset = 0;
    else if (kf.offset === "to") offset = 1;
    else {
      const n = kf.offset;
      // Match renderKeyframeStop: values in (0, 1] are fractions, others percentages
      const pct = n <= 1 && n > 0 ? n * 100 : n;
      offset = pct / 100;
    }
    return { offset, properties: kf.properties };
  });
  return stops.sort((a, b) => a.offset - b.offset);
}

/** camelCase → kebab-case, matching the CSS renderer. */
function toKebabCase(prop: string): string {
  return prop.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Map elapsed time to keyframe progress (0..1), honoring delay, duration,
 * iteration count, direction and fill mode. Returns null when the animation
 * contributes no styles at time t (before delay without backwards fill, or
 * finished without forwards fill).
 */
export function progressAtTime(anim: CSSAnimation, t: number): number | null {
  const dur = parseDuration(anim.duration);
  const delay = parseDuration(anim.delay);
  const fill = anim.fillMode ?? "none";
  const direction = anim.direction ?? "normal";
  const count = anim.iterationCount ?? 1;

  const directed = (cycle: number, frac: number): number => {
    switch (direction) {
      case "reverse": return 1 - frac;
      case "alternate": return cycle % 2 === 0 ? frac : 1 - frac;
      case "alternate-reverse": return cycle % 2 === 0 ? 1 - frac : frac;
      default: return frac;
    }
  };

  if (dur <= 0) return null;

  const local = t - delay;
  if (local < 0) {
    return fill === "backwards" || fill === "both" ? directed(0, 0) : null;
  }

  const iters = local / dur;
  if (count !== "infinite" && iters >= count) {
    if (fill === "forwards" || fill === "both") {
      const lastCycle = Math.ceil(count) - 1;
      return directed(lastCycle, 1);
    }
    return null;
  }

  const cycle = Math.floor(iters);
  const frac = iters - cycle;
  return directed(cycle, frac);
}

/**
 * Evaluate an animation's property values at progress p (0..1).
 * Easing applies per keyframe segment, the way CSS animation-timing-function
 * does. Properties are keyed kebab-case.
 */
export function sampleProperties(anim: CSSAnimation, p: number): Record<string, string> {
  const stops = normalizeStops(anim);
  const easing = resolveEasing(anim.timingFunction);

  // Collect every property name that appears in any keyframe
  const propNames = new Set<string>();
  for (const s of stops) for (const k of Object.keys(s.properties)) propNames.add(toKebabCase(k));

  const valueAt = (stop: Stop, prop: string): string | undefined => {
    for (const [k, v] of Object.entries(stop.properties)) {
      if (toKebabCase(k) === prop) return v;
    }
    return undefined;
  };

  const out: Record<string, string> = {};
  for (const prop of propNames) {
    const defined = stops.filter((s) => valueAt(s, prop) !== undefined);
    if (defined.length === 0) continue;

    const first = defined[0];
    const last = defined[defined.length - 1];
    if (p <= first.offset) { out[prop] = valueAt(first, prop)!; continue; }
    if (p >= last.offset) { out[prop] = valueAt(last, prop)!; continue; }

    for (let i = 0; i < defined.length - 1; i++) {
      const a = defined[i];
      const b = defined[i + 1];
      if (p >= a.offset && p <= b.offset) {
        const span = b.offset - a.offset;
        const u = span > 0 ? (p - a.offset) / span : 1;
        out[prop] = lerpValue(valueAt(a, prop)!, valueAt(b, prop)!, easing(u));
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Transform origin resolution
// ---------------------------------------------------------------------------

type Point = { x: number; y: number };

/** Bounding-box center for elements whose geometry makes it derivable. */
export function resolveOriginCenter(el: AnyElement): Point | null {
  switch (el.type) {
    case "circle":
    case "ellipse":
      return { x: el.cx, y: el.cy };
    case "rect":
      return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    case "line":
      return { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 };
    case "radial-group":
    case "arc-group":
      return { x: el.cx, y: el.cy };
    case "grid-group": {
      const x = el.x ?? 0;
      const y = el.y ?? 0;
      return {
        x: x + ((el.cols - 1) * el.colSpacing) / 2,
        y: y + ((el.rows - 1) * el.rowSpacing) / 2,
      };
    }
    case "scatter-group": {
      const x = el.x ?? 0;
      const y = el.y ?? 0;
      return { x: x + el.width / 2, y: y + el.height / 2 };
    }
    case "path-group": {
      const pts = el.waypoints;
      if (pts.length === 0) return null;
      const sx = pts.reduce((s, p) => s + p.x, 0);
      const sy = pts.reduce((s, p) => s + p.y, 0);
      return { x: sx / pts.length, y: sy / pts.length };
    }
    case "parametric":
      return { x: el.cx ?? 0, y: el.cy ?? 0 };
    case "text":
      return { x: el.x, y: el.y };
    case "group": {
      const centers = el.children
        .map((c) => resolveOriginCenter(c as AnyElement))
        .filter((c): c is Point => c !== null);
      if (centers.length === 0) return null;
      return {
        x: centers.reduce((s, c) => s + c.x, 0) / centers.length,
        y: centers.reduce((s, c) => s + c.y, 0) / centers.length,
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Frame baking
// ---------------------------------------------------------------------------

// CSS property → config field for values the schema models directly
const FIELD_MAP: Record<string, { field: string; numeric: boolean }> = {
  "opacity": { field: "opacity", numeric: true },
  "fill": { field: "fill", numeric: false },
  "stroke": { field: "stroke", numeric: false },
  "fill-opacity": { field: "fillOpacity", numeric: true },
  "stroke-opacity": { field: "strokeOpacity", numeric: true },
  "stroke-width": { field: "strokeWidth", numeric: true },
  "stroke-dashoffset": { field: "strokeDashoffset", numeric: true },
  "visibility": { field: "visibility", numeric: false },
};

export interface BakedFrame {
  config: SVGConfig;
  notes: string[];
}

function applySample(
  el: AnyElement,
  sample: Record<string, string>,
  notes: Set<string>
): void {
  const target = el as Record<string, unknown>;
  const extraStyle: string[] = [];

  for (const [prop, value] of Object.entries(sample)) {
    if (prop === "transform") {
      const wantsBoxOrigin =
        typeof target.transformBox === "string" || typeof target.transformOrigin === "string";
      const hasRotateOrScale = /rotate|scale|skew/i.test(value);
      if (wantsBoxOrigin && hasRotateOrScale) {
        const origin = resolveOriginCenter(el);
        if (!origin) {
          notes.add(
            `Frame sampling: could not derive a transform origin for a "${el.type}" element ` +
              `with cssClass "${String(target.cssClass)}"; it is shown without its transform animation.`
          );
          continue;
        }
        target.transform = `translate(${num(origin.x)}, ${num(origin.y)}) ${stripUnits(value)} translate(${num(-origin.x)}, ${num(-origin.y)})`;
      } else {
        // CSS transform replaces the attribute transform during animation
        target.transform = stripUnits(value);
      }
      delete target.transformBox;
      delete target.transformOrigin;
      continue;
    }

    const mapped = FIELD_MAP[prop];
    if (mapped) {
      target[mapped.field] = mapped.numeric ? parseFloat(value) : value;
    } else {
      extraStyle.push(`${prop}:${value}`);
    }
  }

  if (extraStyle.length > 0) {
    const existing = typeof target.style === "string" && target.style ? `;${target.style}` : "";
    target.style = extraStyle.join(";") + existing;
  }

  // The class no longer has an animation behind it; drop it to keep output clean
  delete target.cssClass;
}

/** Strip CSS units (deg, px) from a transform for SVG attribute syntax. */
function stripUnits(transform: string): string {
  return transform.replace(/(-?\d*\.?\d+)(deg|px)/g, "$1");
}

function walkElements(elements: AnyElement[], visit: (el: AnyElement) => void): void {
  for (const el of elements) {
    visit(el);
    if (el.type === "group") {
      for (const child of el.children) visit(child as AnyElement);
    }
    if ("child" in el && el.child) visit(el.child as AnyElement);
  }
}

/**
 * Produce a static config representing the animation state at time t seconds.
 * The returned config has no CSS animations; sampled values are baked onto
 * the elements. SMIL animations are left in place but noted, since resvg
 * shows their base state.
 */
export function bakeFrame(config: SVGConfig, t: number): BakedFrame {
  const baked = structuredClone(config) as SVGConfig;
  const notes = new Set<string>();

  const samples = new Map<string, Record<string, string>>();
  for (const anim of baked.animations ?? []) {
    const p = progressAtTime(anim, t);
    if (p === null) continue;
    samples.set(anim.name, sampleProperties(anim, p));
  }

  let smilSeen = false;
  walkElements(baked.elements, (el) => {
    const cssClass = (el as Record<string, unknown>).cssClass;
    if (typeof cssClass === "string" && samples.has(cssClass)) {
      applySample(el, samples.get(cssClass)!, notes);
    }
    if ("smilAnimations" in el && Array.isArray(el.smilAnimations) && el.smilAnimations.length > 0) {
      smilSeen = true;
    }
  });

  if (smilSeen) {
    notes.add("SMIL animations are not sampled in frames; those elements show their base state.");
  }

  delete (baked as Record<string, unknown>).animations;
  return { config: baked, notes: [...notes] };
}
