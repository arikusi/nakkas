/**
 * Post-render design audits — the checks that need either the rasterizer's
 * layout knowledge (bounding boxes) or color math (contrast), which the
 * config-level rules in analysis.ts cannot see.
 */

import { Resvg } from "@resvg/resvg-js";
import type { SVGConfig, AnyElement } from "../schemas/config.js";
import { buildFontOptions, resolveGenericFamilies } from "../preview.js";
import { parseHexColor } from "./interpolate.js";
import { num } from "../renderer/utils.js";

// ---------------------------------------------------------------------------
// Bounding box overflow
// ---------------------------------------------------------------------------

/**
 * Compare the rendered content's bounding box against the viewport and warn
 * when content pokes out (it will be clipped in most hosts). Tolerance: 2px
 * or 1% of the dimension, whichever is larger — stroke widths and filter
 * margins commonly overhang by a hair on purpose.
 */
export function checkContentBounds(svg: string, config: SVGConfig): string[] {
  let bbox: { x: number; y: number; width: number; height: number } | undefined;
  try {
    const resvg = new Resvg(resolveGenericFamilies(svg), { font: buildFontOptions() });
    bbox = resvg.getBBox() ?? resvg.innerBBox();
  } catch {
    return [];
  }
  if (!bbox || bbox.width <= 0 || bbox.height <= 0) return [];

  // Viewport rect: viewBox if present, else 0 0 width height (numeric only)
  let vx = 0, vy = 0, vw = NaN, vh = NaN;
  const vb = config.canvas.viewBox?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb.every(Number.isFinite)) {
    [vx, vy, vw, vh] = vb;
  } else {
    if (typeof config.canvas.width === "number") vw = config.canvas.width;
    if (typeof config.canvas.height === "number") vh = config.canvas.height;
  }
  if (!Number.isFinite(vw) || !Number.isFinite(vh)) return [];

  const tolX = Math.max(2, vw * 0.01);
  const tolY = Math.max(2, vh * 0.01);
  const overflows: string[] = [];
  const left = vx - bbox.x;
  const top = vy - bbox.y;
  const right = bbox.x + bbox.width - (vx + vw);
  const bottom = bbox.y + bbox.height - (vy + vh);
  if (left > tolX) overflows.push(`${num(left, 1)}px past the left edge`);
  if (top > tolY) overflows.push(`${num(top, 1)}px past the top edge`);
  if (right > tolX) overflows.push(`${num(right, 1)}px past the right edge`);
  if (bottom > tolY) overflows.push(`${num(bottom, 1)}px past the bottom edge`);

  if (overflows.length === 0) return [];
  return [
    `Content extends ${overflows.join(", ")} of the viewport and will be clipped. ` +
      `Enlarge the viewBox or move the overflowing elements inside.`,
  ];
}

// ---------------------------------------------------------------------------
// Text contrast
// ---------------------------------------------------------------------------

/** WCAG relative luminance for an sRGB color. */
function luminance([r, g, b]: [number, number, number, number]): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio between two hex colors, or null if unparseable. */
export function contrastRatio(a: string, b: string): number | null {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  if (!ca || !cb) return null;
  const la = luminance(ca);
  const lb = luminance(cb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Warn about text that will be hard to read against the canvas background.
 * Fires when both colors are plain hex, and also when the text fill is a
 * gradient reference: gradient stops are hex-only by schema, so the worst
 * stop against the background is reported instead of skipping the check.
 * Pattern fills are still skipped rather than guessed at. Threshold follows
 * WCAG: 3:1 for large text (>= 24px), 4.5:1 below that.
 */
export function checkTextContrast(config: SVGConfig): string[] {
  const bg = config.canvas.background;
  if (!bg || !parseHexColor(bg)) return [];

  const warnings: string[] = [];
  const visit = (el: AnyElement) => {
    if (el.type !== "text" && el.type !== "textPath") return;
    const fill = (el as { fill?: string }).fill;
    if (!fill) return;
    const size = (el as { fontSize?: number }).fontSize ?? 16;
    const threshold = size >= 24 ? 3 : 4.5;
    const label = el.type === "text" && "content" in el && typeof el.content === "string"
      ? `"${el.content.slice(0, 24)}"`
      : `a ${el.type} element`;

    if (parseHexColor(fill)) {
      const ratio = contrastRatio(fill, bg);
      if (ratio !== null && ratio < threshold) {
        warnings.push(
          `Text ${label} has ${num(ratio, 2)}:1 contrast against the ${bg} background ` +
            `(WCAG wants ${threshold}:1 at ${num(size)}px). Darken or lighten the fill.`
        );
      }
      return;
    }

    // Gradient fill: report the worst stop instead of skipping the check.
    const refId = /^url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)$/.exec(fill)?.[1];
    if (!refId) return;
    const gradient = config.defs?.gradients?.find((g) => g.id === refId);
    if (!gradient) return;
    let worst: { color: string; ratio: number } | null = null;
    for (const stop of gradient.stops) {
      const ratio = contrastRatio(stop.color, bg);
      if (ratio !== null && (!worst || ratio < worst.ratio)) {
        worst = { color: stop.color, ratio };
      }
    }
    if (worst && worst.ratio < threshold) {
      warnings.push(
        `Text ${label} uses gradient "${refId}" whose stop ${worst.color} has only ` +
          `${num(worst.ratio, 2)}:1 contrast against the ${bg} background ` +
          `(WCAG wants ${threshold}:1 at ${num(size)}px). Adjust that stop or the background.`
      );
    }
  };

  for (const el of config.elements) {
    visit(el);
    if (el.type === "group") for (const c of el.children) visit(c as AnyElement);
  }
  return warnings;
}
