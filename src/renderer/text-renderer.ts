/**
 * SVG text element rendering: <text>, <tspan>, <textPath>.
 *
 * Text content may be a plain string or an array of strings and tspan objects.
 * TextPath wraps text in <text><textPath href="#pathId">...</textPath></text>.
 */

import type { TextElement, Text, TextPath, Tspan } from "../schemas/text.js";
import { attrs, tag, escapeXml, num } from "./utils.js";
import { renderBaseAttrs } from "./base-renderer.js";
import { renderSMILAnimations } from "./animation-renderer.js";

// ---------------------------------------------------------------------------
// Typography attribute helpers
// ---------------------------------------------------------------------------

function textStyleAttrs(el: Partial<{
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fontStyle: string;
  letterSpacing: number;
  textAnchor: string;
  dominantBaseline: string;
}>): Record<string, string | number | undefined> {
  return {
    "font-family": el.fontFamily,
    "font-size": el.fontSize !== undefined ? num(el.fontSize) : undefined,
    "font-weight": el.fontWeight !== undefined ? String(el.fontWeight) : undefined,
    "font-style": el.fontStyle,
    "letter-spacing": el.letterSpacing !== undefined ? num(el.letterSpacing) : undefined,
    "text-anchor": el.textAnchor,
    "dominant-baseline": el.dominantBaseline,
  };
}

// ---------------------------------------------------------------------------
// <tspan>
// ---------------------------------------------------------------------------

function renderTspan(tspan: Tspan): string {
  const a = attrs({
    dx: tspan.dx !== undefined ? num(tspan.dx) : undefined,
    dy: tspan.dy !== undefined ? num(tspan.dy) : undefined,
    x: tspan.x !== undefined ? num(tspan.x) : undefined,
    y: tspan.y !== undefined ? num(tspan.y) : undefined,
    rotate: tspan.rotate !== undefined ? String(tspan.rotate) : undefined,
    class: tspan.cssClass,
    style: tspan.style,
    fill: tspan.fill,
    stroke: tspan.stroke,
    "stroke-width": tspan.strokeWidth !== undefined ? num(tspan.strokeWidth) : undefined,
    opacity: tspan.opacity !== undefined ? num(tspan.opacity) : undefined,
    ...textStyleAttrs(tspan),
  } as Record<string, string | number | boolean | null | undefined>);

  return tag("tspan", a, escapeXml(tspan.text));
}

// ---------------------------------------------------------------------------
// Content rendering (string | (string | Tspan)[])
// ---------------------------------------------------------------------------

function renderContent(content: string | Array<string | Tspan>): string {
  if (typeof content === "string") return escapeXml(content);
  return content
    .map((item) => (typeof item === "string" ? escapeXml(item) : renderTspan(item)))
    .join("");
}

// ---------------------------------------------------------------------------
// <text>
// ---------------------------------------------------------------------------

function renderText(el: Text): string {
  const geom = attrs({
    x: el.x !== undefined ? num(el.x) : undefined,
    y: el.y !== undefined ? num(el.y) : undefined,
  } as Record<string, string | number | boolean | null | undefined>);

  const typo = attrs(textStyleAttrs(el) as Record<string, string | number | boolean | null | undefined>);
  const baseStr = renderBaseAttrs(el);
  const allAttrs = [geom, typo, baseStr].filter(Boolean).join(" ");

  const contentStr = renderContent(el.content);
  const smil = renderSMILAnimations(el.smilAnimations);
  // SMIL animations are child elements, not text — no separator to avoid whitespace rendering
  const children = contentStr + (smil ? smil : "");

  return tag("text", allAttrs, children);
}

// ---------------------------------------------------------------------------
// <textPath>
// ---------------------------------------------------------------------------

function renderTextPath(el: TextPath): string {
  const textPathAttrs = attrs({
    href: `#${el.pathId}`,
    startOffset: el.startOffset !== undefined ? String(el.startOffset) : undefined,
    method: el.method,
    spacing: el.spacing,
    ...textStyleAttrs(el),
  } as Record<string, string | number | boolean | null | undefined>);

  const smil = renderSMILAnimations(el.smilAnimations);
  const textPathContent = escapeXml(el.text);
  const textPathChildren = [textPathContent, smil].filter(Boolean).join("\n");
  const textPathElement = tag("textPath", textPathAttrs, textPathChildren);

  // Wrap in <text> — textPath needs a text parent
  const baseStr = renderBaseAttrs(el);
  const xyStr = attrs({
    x: el.x !== undefined ? num(el.x) : undefined,
    y: el.y !== undefined ? num(el.y) : undefined,
  } as Record<string, string | number | boolean | null | undefined>);
  const outerAttrs = [xyStr, baseStr].filter(Boolean).join(" ");
  return tag("text", outerAttrs, textPathElement);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function renderTextElement(element: TextElement): string {
  switch (element.type) {
    case "text":     return renderText(element);
    case "textPath": return renderTextPath(element);
  }
}
