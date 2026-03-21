/**
 * Base element attribute rendering.
 *
 * Converts schema field names (camelCase) to SVG attribute names (kebab-case).
 * Separates CSS-only properties (transform-box, transform-origin) from SVG attributes.
 * Merges all CSS-only props and inline style into a single style="" attribute.
 */

import type { BaseElement } from "../schemas/base.js";
import { attr, attrs, styleString, num } from "./utils.js";

// ---------------------------------------------------------------------------
// Presentation attribute mapping
// ---------------------------------------------------------------------------

/**
 * Render all presentation + structural attributes for a base element.
 * Returns an attribute string ready to embed in an SVG tag.
 *
 * Handles:
 * - id, class (cssClass) → direct SVG attributes
 * - fill, stroke, opacity, etc. → kebab-case SVG presentation attributes
 * - transformBox, transformOrigin → CSS properties in style=""
 * - Merges with element's explicit inline style
 */
export function renderBaseAttrs(element: Partial<BaseElement>): string {
  // --- SVG attributes ---
  const svgObj: Record<string, string | number | boolean | null | undefined> = {};

  // Structural
  if (element.id) svgObj["id"] = element.id;
  if (element.cssClass) svgObj["class"] = element.cssClass;

  // Fill
  if (element.fill !== undefined) svgObj["fill"] = element.fill;
  if (element.fillOpacity !== undefined) svgObj["fill-opacity"] = num(element.fillOpacity);
  if (element.fillRule !== undefined) svgObj["fill-rule"] = element.fillRule;

  // Stroke
  if (element.stroke !== undefined) svgObj["stroke"] = element.stroke;
  if (element.strokeWidth !== undefined) svgObj["stroke-width"] = num(element.strokeWidth);
  if (element.strokeOpacity !== undefined) svgObj["stroke-opacity"] = num(element.strokeOpacity);
  if (element.strokeLinecap !== undefined) svgObj["stroke-linecap"] = element.strokeLinecap;
  if (element.strokeLinejoin !== undefined) svgObj["stroke-linejoin"] = element.strokeLinejoin;
  if (element.strokeDasharray !== undefined) svgObj["stroke-dasharray"] = element.strokeDasharray;
  if (element.strokeDashoffset !== undefined) svgObj["stroke-dashoffset"] = num(element.strokeDashoffset);

  // Misc presentation
  if (element.opacity !== undefined) svgObj["opacity"] = num(element.opacity);
  if (element.visibility !== undefined) svgObj["visibility"] = element.visibility;
  if (element.filter !== undefined) svgObj["filter"] = element.filter;
  if (element.clipPath !== undefined) svgObj["clip-path"] = element.clipPath;
  if (element.mask !== undefined) svgObj["mask"] = element.mask;
  if (element.transform !== undefined) svgObj["transform"] = element.transform;

  // --- CSS-only properties → style="" ---
  const cssProps: Record<string, string> = {};
  if (element.transformBox) cssProps["transform-box"] = element.transformBox;
  if (element.transformOrigin) cssProps["transform-origin"] = element.transformOrigin;

  const style = styleString(cssProps, element.style);
  if (style) svgObj["style"] = style;

  return attrs(svgObj);
}

/**
 * Build an attrs string for geometry + base attrs together.
 * Merges shape-specific geometry record with base element attrs.
 *
 * @param geometry - Shape-specific SVG attributes (x, y, width, r, d, etc.)
 * @param element - Base element with structural + presentation attrs
 */
export function renderElementAttrs(
  geometry: Record<string, string | number | null | undefined>,
  element: Partial<BaseElement>
): string {
  const geomStr = attrs(geometry as Record<string, string | number | boolean | null | undefined>);
  const baseStr = renderBaseAttrs(element);
  return [geomStr, baseStr].filter(Boolean).join(" ");
}
