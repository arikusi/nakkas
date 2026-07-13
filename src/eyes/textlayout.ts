/**
 * Per-text layout audit — ink bounding boxes for every text element,
 * measured by rendering each one in isolation through resvg.
 *
 * The whole-content bbox audit in audit.ts can say THAT something escapes
 * the viewport but not what; and it is blind to collisions inside it. Ink
 * boxes per text element make both checks possible: overflow warnings that
 * name the text, and text-on-text overlap detection. Boxes are measured at
 * the base state, before any animation runs; warnings say so when one of
 * the involved texts is animated.
 */

import { Resvg } from "@resvg/resvg-js";
import type { SVGConfig, AnyElement } from "../schemas/config.js";
import { renderSVG } from "../renderer/svg-renderer.js";
import { drainRenderWarnings, num } from "../renderer/utils.js";
import { buildFontOptions, buildMeasureFontOptions, resolveGenericFamilies } from "../preview.js";

export interface InkBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MeasuredText {
  label: string;
  animated: boolean;
  box: InkBox;
}

/** Isolated renders are cheap but not free; audits stay bounded. */
export const TEXT_MEASURE_CAP = 24;

function flattenContent(el: AnyElement): string {
  if (el.type === "text") {
    const c = (el as { content: string | Array<string | { text: string }> }).content;
    if (typeof c === "string") return c;
    return c.map((part) => (typeof part === "string" ? part : part.text)).join("");
  }
  if (el.type === "textPath") return (el as { text: string }).text;
  return "";
}

function textLabel(el: AnyElement): string {
  const flat = flattenContent(el).slice(0, 24);
  return el.type === "textPath" ? `textPath "${flat}"` : `"${flat}"`;
}

function isAnimated(el: AnyElement, config: SVGConfig): boolean {
  const cls = (el as { cssClass?: string }).cssClass;
  if (!cls) return false;
  return (config.animations ?? []).some((a) => a.name === cls);
}

/**
 * Collect every text/textPath in the config, each paired with the element
 * to render in isolation. Text inside a group keeps its group shell (the
 * group's transform and inherited presentation attrs move the ink), with
 * the siblings stripped out. Pattern-group children are skipped: their
 * placements are generated and overlap among copies is usually the design.
 */
/** Invisible text cannot visually collide or overflow; keep it out of the audit. */
function isInvisible(el: AnyElement): boolean {
  const p = el as { opacity?: number; fillOpacity?: number; visibility?: string };
  return p.opacity === 0 || p.fillOpacity === 0 || p.visibility === "hidden";
}

function collectTexts(
  config: SVGConfig
): Array<{ el: AnyElement; isolated: AnyElement }> {
  const targets: Array<{ el: AnyElement; isolated: AnyElement }> = [];
  for (const el of config.elements) {
    if ((el.type === "text" || el.type === "textPath") && !isInvisible(el)) {
      targets.push({ el, isolated: el });
    } else if (el.type === "group" && !isInvisible(el)) {
      for (const child of el.children) {
        const c = child as AnyElement;
        if ((c.type === "text" || c.type === "textPath") && !isInvisible(c)) {
          targets.push({ el: c, isolated: { ...el, children: [child] } as AnyElement });
        }
      }
    }
  }
  return targets;
}

/**
 * Measure the ink bounding box of every text element by rendering each one
 * alone on a transparent canvas. Unmeasurable text (empty, unparseable,
 * zero ink) is skipped, not guessed at.
 */
const GENERIC_FAMILIES = new Set(["sans-serif", "serif", "monospace", "cursive", "fantasy"]);

/** True when every measured text sticks to generic font families (or none). */
function onlyGenericFonts(targets: Array<{ el: AnyElement }>): boolean {
  return targets.every((t) => {
    const family = (t.el as { fontFamily?: string }).fontFamily;
    if (family && !GENERIC_FAMILIES.has(family.trim().toLowerCase())) return false;
    const content = (t.el as { content?: unknown }).content;
    if (Array.isArray(content)) {
      for (const part of content) {
        const f = (part as { fontFamily?: string }).fontFamily;
        if (f && !GENERIC_FAMILIES.has(f.trim().toLowerCase())) return false;
      }
    }
    return true;
  });
}

/**
 * Best font options for a measurement-only render of this config: the fast
 * font-file path when every text uses generic families, the full system
 * scan otherwise. Exported for the other bbox-based audit.
 */
export function measurementFontOptions(config: SVGConfig): ReturnType<typeof buildFontOptions> {
  return (onlyGenericFonts(collectTexts(config)) ? buildMeasureFontOptions() : null) ?? buildFontOptions();
}

export function measureTextInk(config: SVGConfig): {
  measured: MeasuredText[];
  skipped: number;
} {
  const targets = collectTexts(config);
  const measured: MeasuredText[] = [];
  // Generic families resolve to known font files, which skips resvg's
  // ~90ms-per-instance system font scan. Custom font names keep the full
  // scan so their real metrics are measured.
  const fontOptions = measurementFontOptions(config);

  for (const target of targets.slice(0, TEXT_MEASURE_CAP)) {
    const isolated: SVGConfig = {
      ...config,
      canvas: { ...config.canvas, background: undefined },
      elements: [target.isolated],
      animations: [],
      output: undefined,
    };
    try {
      const svg = renderSVG(isolated);
      const resvg = new Resvg(resolveGenericFamilies(svg), { font: fontOptions });
      const box = resvg.getBBox() ?? resvg.innerBBox();
      if (box && box.width > 0 && box.height > 0) {
        measured.push({
          label: textLabel(target.el),
          animated: isAnimated(target.el, config),
          box,
        });
      }
    } catch {
      // skip
    }
  }
  drainRenderWarnings(); // isolated renders repeat the main render's warnings

  return { measured, skipped: Math.max(0, targets.length - TEXT_MEASURE_CAP) };
}

/** Viewport rect: viewBox if present, else 0 0 width height (numeric only). */
function viewportRect(
  config: SVGConfig
): { x: number; y: number; w: number; h: number } | null {
  const vb = config.canvas.viewBox?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb.every(Number.isFinite)) {
    return { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  }
  if (
    typeof config.canvas.width === "number" &&
    typeof config.canvas.height === "number"
  ) {
    return { x: 0, y: 0, w: config.canvas.width, h: config.canvas.height };
  }
  return null;
}

/**
 * Warn about text that escapes the viewport (named, unlike the generic
 * content-bounds warning) and about text-on-text collisions. Ink boxes are
 * tight glyph outlines, so any intersection beyond a hair is real.
 */
export function checkTextLayout(config: SVGConfig): string[] {
  const { measured, skipped } = measureTextInk(config);
  if (measured.length === 0 && skipped === 0) return [];

  const warnings: string[] = [];

  const vp = viewportRect(config);
  if (vp) {
    const tolX = Math.max(2, vp.w * 0.01);
    const tolY = Math.max(2, vp.h * 0.01);
    for (const m of measured) {
      const overflows: string[] = [];
      const left = vp.x - m.box.x;
      const top = vp.y - m.box.y;
      const right = m.box.x + m.box.width - (vp.x + vp.w);
      const bottom = m.box.y + m.box.height - (vp.y + vp.h);
      if (left > tolX) overflows.push(`${num(left, 1)}px past the left edge`);
      if (top > tolY) overflows.push(`${num(top, 1)}px past the top edge`);
      if (right > tolX) overflows.push(`${num(right, 1)}px past the right edge`);
      if (bottom > tolY) overflows.push(`${num(bottom, 1)}px past the bottom edge`);
      if (overflows.length > 0) {
        warnings.push(
          `Text ${m.label} extends ${overflows.join(", ")} of the viewport. ` +
            `Move it inside, shorten it, or reduce its font size.`
        );
      }
    }
  }

  for (let i = 0; i < measured.length; i++) {
    for (let j = i + 1; j < measured.length; j++) {
      const a = measured[i];
      const b = measured[j];
      const ow =
        Math.min(a.box.x + a.box.width, b.box.x + b.box.width) -
        Math.max(a.box.x, b.box.x);
      const oh =
        Math.min(a.box.y + a.box.height, b.box.y + b.box.height) -
        Math.max(a.box.y, b.box.y);
      if (ow > 1 && oh > 1) {
        const note =
          a.animated || b.animated ? " (measured before animations run)" : "";
        warnings.push(
          `Text ${a.label} overlaps text ${b.label} by ${num(ow, 1)}x${num(oh, 1)}px${note}. ` +
            `Give them separate space.`
        );
      }
    }
  }

  if (skipped > 0) {
    warnings.push(
      `${skipped} text element(s) beyond the first ${TEXT_MEASURE_CAP} were not layout-checked.`
    );
  }

  return warnings;
}
