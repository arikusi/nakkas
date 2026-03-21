/**
 * Group, use, symbol, clipPath, and mask rendering.
 *
 * Groups (<g>) apply shared presentation attributes to all children.
 * Use (<use>) instances symbols or clones elements by ID.
 * Symbol, clipPath, mask live in <defs> — rendered by svg-renderer.
 */

import type { Group, Use, Symbol, ClipPath, Mask, LeafElement } from "../schemas/groups.js";
import { attrs, blockTag, tag, num } from "./utils.js";
import { renderBaseAttrs } from "./base-renderer.js";
import { renderSMILAnimations } from "./animation-renderer.js";
import { renderShape } from "./shape-renderer.js";
import { renderTextElement } from "./text-renderer.js";

// ---------------------------------------------------------------------------
// Leaf element dispatcher (shapes + text + use)
// ---------------------------------------------------------------------------

export function renderLeafElement(element: LeafElement): string {
  if (element.type === "use") return renderUse(element);
  if (
    element.type === "rect" ||
    element.type === "circle" ||
    element.type === "ellipse" ||
    element.type === "line" ||
    element.type === "polyline" ||
    element.type === "polygon" ||
    element.type === "path" ||
    element.type === "image"
  ) {
    return renderShape(element);
  }
  return renderTextElement(element);
}

// ---------------------------------------------------------------------------
// <use>
// ---------------------------------------------------------------------------

export function renderUse(el: Use): string {
  const geom = attrs({
    href: el.href,
    x: el.x !== undefined ? num(el.x) : undefined,
    y: el.y !== undefined ? num(el.y) : undefined,
    width: el.width !== undefined ? num(el.width) : undefined,
    height: el.height !== undefined ? num(el.height) : undefined,
  } as Record<string, string | number | boolean | null | undefined>);

  const baseStr = renderBaseAttrs(el);
  const allAttrs = [geom, baseStr].filter(Boolean).join(" ");
  const smil = renderSMILAnimations(el.smilAnimations);

  if (smil) return `<use ${allAttrs}>\n${smil}\n</use>`;
  return tag("use", allAttrs);
}

// ---------------------------------------------------------------------------
// <g> — group
// ---------------------------------------------------------------------------

export function renderGroup(el: Group): string {
  const baseStr = renderBaseAttrs(el);
  const children = el.children.map(renderLeafElement).join("\n");
  const smil = renderSMILAnimations(el.smilAnimations);
  const allChildren = [children, smil].filter(Boolean).join("\n");
  return blockTag("g", baseStr, allChildren);
}

// ---------------------------------------------------------------------------
// <symbol> — for use in <defs>
// ---------------------------------------------------------------------------

export function renderSymbol(sym: Symbol): string {
  const a = attrs({
    id: sym.id,
    viewBox: sym.viewBox,
    preserveAspectRatio: sym.preserveAspectRatio,
    overflow: sym.overflow,
  } as Record<string, string | number | boolean | null | undefined>);

  const children = sym.children
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

  return blockTag("symbol", a, children);
}

// ---------------------------------------------------------------------------
// <clipPath> — for use in <defs>
// ---------------------------------------------------------------------------

export function renderClipPath(cp: ClipPath): string {
  const a = attrs({
    id: cp.id,
    clipPathUnits: cp.clipPathUnits,
  } as Record<string, string | number | boolean | null | undefined>);

  const children = cp.children.map(renderShape).join("\n");
  return blockTag("clipPath", a, children);
}

// ---------------------------------------------------------------------------
// <mask> — for use in <defs>
// ---------------------------------------------------------------------------

export function renderMask(mask: Mask): string {
  const a = attrs({
    id: mask.id,
    maskUnits: mask.maskUnits,
    maskContentUnits: mask.maskContentUnits,
    x: mask.x,
    y: mask.y,
    width: mask.width,
    height: mask.height,
  } as Record<string, string | number | boolean | null | undefined>);

  const children = mask.children
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

  return blockTag("mask", a, children);
}
