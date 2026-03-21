/**
 * SVG shape element rendering.
 *
 * Each shape function renders the element's geometry + base attrs + SMIL children.
 * Uses self-closing tags when there are no SMIL animations.
 */

import type { ShapeElement, Rect, Circle, Ellipse, Line, Polyline, Polygon, Path, Image } from "../schemas/shapes.js";
import { attrs, tag, num } from "./utils.js";
import { renderBaseAttrs } from "./base-renderer.js";
import { renderSMILAnimations } from "./animation-renderer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a complete shape element: geometry attrs + base attrs + SMIL children. */
function shape(
  tagName: string,
  geometry: Record<string, string | number | null | undefined>,
  element: Partial<ShapeElement>,
  smil: string | undefined
): string {
  const geomStr = attrs(geometry as Record<string, string | number | boolean | null | undefined>);
  const baseStr = renderBaseAttrs(element);
  const allAttrs = [geomStr, baseStr].filter(Boolean).join(" ");

  if (smil) {
    return `<${tagName} ${allAttrs}>\n${smil}\n</${tagName}>`;
  }
  return tag(tagName, allAttrs);
}

// ---------------------------------------------------------------------------
// Shape renderers
// ---------------------------------------------------------------------------

function renderRect(el: Rect): string {
  const smil = renderSMILAnimations(el.smilAnimations);
  return shape(
    "rect",
    {
      x: el.x !== undefined ? num(el.x) : undefined,
      y: el.y !== undefined ? num(el.y) : undefined,
      width: num(el.width),
      height: num(el.height),
      rx: el.rx !== undefined ? num(el.rx) : undefined,
      ry: el.ry !== undefined ? num(el.ry) : undefined,
    },
    el,
    smil || undefined
  );
}

function renderCircle(el: Circle): string {
  const smil = renderSMILAnimations(el.smilAnimations);
  return shape(
    "circle",
    {
      cx: el.cx !== undefined ? num(el.cx) : undefined,
      cy: el.cy !== undefined ? num(el.cy) : undefined,
      r: num(el.r),
    },
    el,
    smil || undefined
  );
}

function renderEllipse(el: Ellipse): string {
  const smil = renderSMILAnimations(el.smilAnimations);
  return shape(
    "ellipse",
    {
      cx: el.cx !== undefined ? num(el.cx) : undefined,
      cy: el.cy !== undefined ? num(el.cy) : undefined,
      rx: num(el.rx),
      ry: num(el.ry),
    },
    el,
    smil || undefined
  );
}

function renderLine(el: Line): string {
  const smil = renderSMILAnimations(el.smilAnimations);
  return shape(
    "line",
    {
      x1: num(el.x1),
      y1: num(el.y1),
      x2: num(el.x2),
      y2: num(el.y2),
    },
    el,
    smil || undefined
  );
}

function renderPolyline(el: Polyline): string {
  const smil = renderSMILAnimations(el.smilAnimations);
  return shape("polyline", { points: el.points }, el, smil || undefined);
}

function renderPolygon(el: Polygon): string {
  const smil = renderSMILAnimations(el.smilAnimations);
  return shape("polygon", { points: el.points }, el, smil || undefined);
}

function renderPath(el: Path): string {
  const smil = renderSMILAnimations(el.smilAnimations);
  return shape("path", { d: el.d }, el, smil || undefined);
}

function renderImage(el: Image): string {
  const smil = renderSMILAnimations(el.smilAnimations);
  return shape(
    "image",
    {
      href: el.href,
      x: el.x !== undefined ? num(el.x) : undefined,
      y: el.y !== undefined ? num(el.y) : undefined,
      width: num(el.width),
      height: num(el.height),
      preserveAspectRatio: el.preserveAspectRatio,
    },
    el,
    smil || undefined
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function renderShape(element: ShapeElement): string {
  switch (element.type) {
    case "rect":     return renderRect(element);
    case "circle":   return renderCircle(element);
    case "ellipse":  return renderEllipse(element);
    case "line":     return renderLine(element);
    case "polyline": return renderPolyline(element);
    case "polygon":  return renderPolygon(element);
    case "path":     return renderPath(element);
    case "image":    return renderImage(element);
  }
}
