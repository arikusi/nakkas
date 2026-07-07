/**
 * CSS value interpolation for animation frame sampling.
 *
 * Handles the value kinds nakkas animations actually use: plain numbers
 * (opacity, stroke-dashoffset), hex colors, and transform function lists.
 * Anything unrecognized interpolates discretely (nearest keyframe wins),
 * which matches how CSS treats non-interpolable values.
 */

import { num } from "../renderer/utils.js";

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const NUMBER_VALUE = /^-?(\d+\.?\d*|\.\d+)([a-z%]*)$/i;

/** Parse "12", "12px", "45deg" → { value, unit } or null. */
function parseNumberWithUnit(s: string): { value: number; unit: string } | null {
  const m = s.trim().match(NUMBER_VALUE);
  if (!m) return null;
  return { value: parseFloat(m[0]), unit: m[2] ?? "" };
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

/** Parse #rgb, #rrggbb, #rrggbbaa → [r, g, b, a] (0-255, a 0-1) or null. */
export function parseHexColor(s: string): [number, number, number, number] | null {
  const hex = s.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  if (!hex) return null;
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
      1,
    ];
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, a];
}

export function lerpColor(a: string, b: string, t: number): string | null {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  if (!ca || !cb) return null;
  const ch = (i: number) => Math.round(lerp(ca[i], cb[i], t));
  const alpha = lerp(ca[3], cb[3], t);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  const rgb = `#${hex(ch(0))}${hex(ch(1))}${hex(ch(2))}`;
  return alpha >= 0.999 ? rgb : `${rgb}${hex(Math.round(alpha * 255))}`;
}

// ---------------------------------------------------------------------------
// Transform lists
// ---------------------------------------------------------------------------

export interface TransformFn {
  name: string;
  args: number[];
}

/**
 * Parse a CSS/SVG transform list: "translate(10px, 20px) rotate(45deg)" →
 * [{name:"translate", args:[10,20]}, {name:"rotate", args:[45]}].
 * Units (px, deg) are stripped — SVG transform attribute values are unitless
 * user units and degrees. Returns null on anything unparseable (matrix is
 * fine, 3d functions are not).
 */
export function parseTransformList(s: string): TransformFn[] | null {
  if (s.trim() === "" || s.trim().toLowerCase() === "none") return [];
  const out: TransformFn[] = [];
  const re = /([a-zA-Z]+)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const name = m[1].toLowerCase();
    if (/3d$/.test(name) || name === "perspective") return null;
    const args = m[2].trim() === "" ? [] : m[2].split(/[\s,]+/).map((part) => {
      const p = parseNumberWithUnit(part);
      return p && (p.unit === "" || p.unit === "px" || p.unit === "deg") ? p.value : NaN;
    });
    if (args.some((a) => !Number.isFinite(a))) return null;
    out.push({ name, args });
  }
  // Reject if the string held anything besides the matched functions and whitespace
  if (s.replace(re, "").trim() !== "") return null;
  return out;
}

/** Serialize a transform list to SVG transform attribute syntax. */
export function serializeTransformList(fns: TransformFn[]): string {
  return fns.map((f) => `${f.name}(${f.args.map((a) => num(a)).join(", ")})`).join(" ");
}

/**
 * Interpolate two transform lists. Requires identical function names and
 * arg counts position by position (the common case for keyframes authored
 * as matching from/to pairs). Returns null when the lists don't match.
 */
export function lerpTransform(a: string, b: string, t: number): string | null {
  const fa = parseTransformList(a);
  const fb = parseTransformList(b);
  if (!fa || !fb) return null;
  // "none" on one side pairs with identity of the other side's functions
  const identity = (f: TransformFn): TransformFn => ({
    name: f.name,
    args: f.args.map(() => (f.name.startsWith("scale") ? 1 : 0)),
  });
  const la = fa.length === 0 && fb.length > 0 ? fb.map(identity) : fa;
  const lb = fb.length === 0 && fa.length > 0 ? fa.map(identity) : fb;
  if (la.length !== lb.length) return null;
  const out: TransformFn[] = [];
  for (let i = 0; i < la.length; i++) {
    if (la[i].name !== lb[i].name || la[i].args.length !== lb[i].args.length) return null;
    out.push({
      name: la[i].name,
      args: la[i].args.map((av, j) => lerp(av, lb[i].args[j], t)),
    });
  }
  return serializeTransformList(out);
}

// ---------------------------------------------------------------------------
// Generic dispatch
// ---------------------------------------------------------------------------

/**
 * Interpolate two CSS values at t. Dispatch order: transform lists, numbers
 * with matching units, hex colors; otherwise discrete (t < 0.5 → a, else b).
 */
export function lerpValue(a: string, b: string, t: number): string {
  if (a === b) return a;

  const ta = lerpTransform(a, b, t);
  if (ta !== null) return ta;

  const na = parseNumberWithUnit(a);
  const nb = parseNumberWithUnit(b);
  if (na && nb && na.unit === nb.unit) {
    return `${num(lerp(na.value, nb.value, t))}${na.unit}`;
  }

  const color = lerpColor(a, b, t);
  if (color !== null) return color;

  return t < 0.5 ? a : b;
}
