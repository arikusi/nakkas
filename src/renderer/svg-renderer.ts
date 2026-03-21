/**
 * Main SVG renderer — coordinates all sub-renderers.
 *
 * renderSVG(config): SVGConfig → string
 *
 * Output structure:
 * <svg ...>
 *   <defs>
 *     gradients, filters, patterns, clipPaths, masks, symbols, path defs
 *   </defs>
 *   <style>@keyframes...</style>   (if CSS animations)
 *   <rect fill="background"/>      (if canvas.background)
 *   elements...
 * </svg>
 *
 * Safety: no <script>, no event handlers injected.
 */

import type { SVGConfig, AnyElement, Pattern } from "../schemas/config.js";
import { attrs, tag, blockTag, comment, num, length } from "./utils.js";
import { renderCSSAnimations } from "./animation-renderer.js";
import { renderGradient } from "./gradient-renderer.js";
import { renderFilter } from "./filter-renderer.js";
import { renderShape } from "./shape-renderer.js";
import { renderTextElement } from "./text-renderer.js";
import { renderGroup, renderUse, renderSymbol, renderClipPath, renderMask } from "./group-renderer.js";
import {
  renderRadialGroup,
  renderArcGroup,
  renderGridGroup,
  renderScatterGroup,
  renderPathGroup,
} from "./pattern-renderer.js";
import { renderParametric } from "./parametric-renderer.js";

// ---------------------------------------------------------------------------
// Element dispatcher
// ---------------------------------------------------------------------------

function renderAnyElement(element: AnyElement): string {
  switch (element.type) {
    case "rect":
    case "circle":
    case "ellipse":
    case "line":
    case "polyline":
    case "polygon":
    case "path":
    case "image":
      return renderShape(element);

    case "text":
    case "textPath":
      return renderTextElement(element);

    case "group":
      return renderGroup(element);

    case "use":
      return renderUse(element);

    case "radial-group":
      return renderRadialGroup(element);

    case "arc-group":
      return renderArcGroup(element);

    case "grid-group":
      return renderGridGroup(element);

    case "scatter-group":
      return renderScatterGroup(element);

    case "path-group":
      return renderPathGroup(element);

    case "parametric":
      return renderParametric(element);
  }
}

// ---------------------------------------------------------------------------
// <pattern> renderer
// ---------------------------------------------------------------------------

function renderPattern(p: Pattern): string {
  const a = attrs({
    id: p.id,
    x: p.x !== undefined ? num(p.x) : undefined,
    y: p.y !== undefined ? num(p.y) : undefined,
    width: num(p.width),
    height: num(p.height),
    patternUnits: p.patternUnits ?? "userSpaceOnUse",
    patternTransform: p.patternTransform,
  } as Record<string, string | undefined>);

  const children = p.children
    .map((child) => {
      if (
        child.type === "rect" ||
        child.type === "circle" ||
        child.type === "ellipse" ||
        child.type === "line" ||
        child.type === "polyline" ||
        child.type === "polygon" ||
        child.type === "path" ||
        child.type === "image"
      ) {
        return renderShape(child);
      }
      return renderTextElement(child);
    })
    .join("\n");

  return blockTag("pattern", a, children);
}

// ---------------------------------------------------------------------------
// <defs> block
// ---------------------------------------------------------------------------

function renderDefs(config: SVGConfig): string {
  const parts: string[] = [];

  // Path definitions for textPath elements
  if (config.defs?.paths) {
    for (const p of config.defs.paths) {
      parts.push(tag("path", attrs({ id: p.id, d: p.d, fill: "none", stroke: "none" })));
    }
  }

  if (config.defs?.gradients) {
    for (const g of config.defs.gradients) {
      parts.push(renderGradient(g));
    }
  }

  if (config.defs?.filters) {
    for (const f of config.defs.filters) {
      parts.push(renderFilter(f));
    }
  }

  if (config.defs?.patterns) {
    for (const p of config.defs.patterns) {
      parts.push(renderPattern(p));
    }
  }

  if (config.defs?.clipPaths) {
    for (const cp of config.defs.clipPaths) {
      parts.push(renderClipPath(cp));
    }
  }

  if (config.defs?.masks) {
    for (const m of config.defs.masks) {
      parts.push(renderMask(m));
    }
  }

  if (config.defs?.symbols) {
    for (const s of config.defs.symbols) {
      parts.push(renderSymbol(s));
    }
  }

  if (parts.length === 0) return "";
  return blockTag("defs", "", parts.join("\n"));
}

// ---------------------------------------------------------------------------
// Background rect
// ---------------------------------------------------------------------------

function renderBackground(config: SVGConfig): string {
  const bg = config.canvas.background;
  if (!bg) return "";

  // Transparent is the SVG default; no background rect needed
  if (bg === "transparent") return comment("transparent background");

  return tag("rect", attrs({ width: "100%", height: "100%", fill: bg }));
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

/**
 * Render a complete SVG document from a validated SVGConfig.
 *
 * @param config - Parsed and validated SVGConfig
 * @returns Complete SVG XML string (no <?xml?> declaration, suitable for inline use)
 * @throws Error if config is structurally invalid
 */
export function renderSVG(config: SVGConfig): string {
  const canvas = config.canvas;

  // Build root <svg> attributes
  const svgAttrs = attrs({
    xmlns: canvas.xmlns ?? "http://www.w3.org/2000/svg",
    width: length(canvas.width),
    height: length(canvas.height),
    viewBox: canvas.viewBox,
    preserveAspectRatio: canvas.preserveAspectRatio,
  } as Record<string, string | number | boolean | null | undefined>);

  // Render sections
  const defsBlock = renderDefs(config);
  const styleBlock = renderCSSAnimations(config.animations ?? []);
  const backgroundRect = renderBackground(config);
  const elementBlocks = config.elements.map(renderAnyElement);

  // Assemble body
  const bodyParts: string[] = [];
  if (defsBlock) bodyParts.push(defsBlock);
  if (styleBlock) bodyParts.push(styleBlock);
  if (backgroundRect) bodyParts.push(backgroundRect);
  bodyParts.push(...elementBlocks);

  const body = bodyParts.join("\n");
  const indentedBody = body
    .split("\n")
    .map((line) => (line.trim() ? `  ${line}` : ""))
    .join("\n");

  return `<svg ${svgAttrs}>\n${indentedBody}\n</svg>`;
}
