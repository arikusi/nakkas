/**
 * Animation rendering: CSS @keyframes and SMIL animation elements.
 *
 * CSS animations → <style> block with @keyframes + class rules.
 * SMIL animations → child elements inside the animated SVG element.
 *
 * Notes:
 * - CSS keyframes: supported in all modern SVG renderers
 * - SMIL: supported in all modern SVG renderers
 * - SMIL begin="click" / "mouseover": not supported when SVG is used as a static image (<img> tag)
 */

import type {
  CSSAnimation,
  CSSKeyframe,
  SMILAnimate,
  SMILAnimateTransform,
  SMILAnimateMotion,
  SMILAnimation,
} from "../schemas/animations.js";
import { attr, attrs, tag, escapeXml, num } from "./utils.js";

// ---------------------------------------------------------------------------
// CSS @keyframes rendering
// ---------------------------------------------------------------------------

/**
 * Convert camelCase CSS property names to kebab-case.
 * Accepts both camelCase (strokeDashoffset) and kebab-case (stroke-dashoffset).
 * CSS inside <style> blocks requires kebab-case.
 */
function toKebabCase(prop: string): string {
  return prop.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Sanitize a CSS value: strip block-breakout chars and </style> tag injection.
 */
function safeCSSValue(val: string): string {
  return val.replace(/[{}]/g, "").replace(/<\/style>/gi, "");
}

/**
 * Sanitize a CSS identifier (animation name used in @keyframes and class selectors).
 * Replaces any character that is not a valid CSS identifier char with underscore.
 * Prepends underscore if the result starts with a digit (CSS idents cannot start with [0-9]).
 */
function safeCSSIdent(name: string): string {
  const s = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return /^[0-9]/.test(s) ? `_${s}` : s;
}

/** Render a single keyframe stop: "0% { prop: val; ... }" */
function renderKeyframeStop(kf: CSSKeyframe): string {
  const position = typeof kf.offset === "number" ? `${num(kf.offset)}%` : kf.offset;
  const declarations = Object.entries(kf.properties)
    .map(([prop, val]) => `${toKebabCase(prop)}:${safeCSSValue(val)}`)
    .join(";");
  return `${position}{${declarations}}`;
}

/**
 * Render a CSS animation: produces @keyframes + class rule.
 *
 * Generated CSS:
 * ```css
 * @keyframes {name} { 0%{...} 100%{...} }
 * .{name} { animation-name: {name}; animation-duration: {dur}; ... }
 * ```
 * Uses individual animation-* properties instead of the shorthand for clarity and robustness.
 */
export function renderCSSAnimation(anim: CSSAnimation): string {
  const safeName = safeCSSIdent(anim.name);

  // @keyframes block
  const stops = anim.keyframes.map(renderKeyframeStop).join(" ");
  const keyframesBlock = `@keyframes ${safeName}{${stops}}`;

  // Build individual animation properties (only emit defined values)
  const props: string[] = [
    `animation-name:${safeName}`,
    `animation-duration:${safeCSSValue(anim.duration)}`,
    `animation-timing-function:${safeCSSValue(anim.timingFunction ?? "ease")}`,
  ];
  if (anim.delay) props.push(`animation-delay:${safeCSSValue(anim.delay)}`);
  if (anim.iterationCount !== undefined) props.push(`animation-iteration-count:${anim.iterationCount}`);
  if (anim.direction) props.push(`animation-direction:${anim.direction}`);
  if (anim.fillMode) props.push(`animation-fill-mode:${anim.fillMode}`);

  const classRule = `.${safeName}{${props.join(";")}}`;
  return `${keyframesBlock}\n${classRule}`;
}

/**
 * Render all CSS animations into a complete <style> block.
 * Returns empty string if no animations.
 */
export function renderCSSAnimations(animations: CSSAnimation[]): string {
  if (animations.length === 0) return "";
  const rules = animations.map(renderCSSAnimation).join("\n");
  return `<style>\n${rules}\n</style>`;
}

// ---------------------------------------------------------------------------
// SMIL animation element rendering
// ---------------------------------------------------------------------------

/** Render a SMIL <animate> element. */
function renderSMILAnimate(anim: SMILAnimate): string {
  const a = attrs({
    attributeName: anim.attributeName,
    from: anim.from,
    to: anim.to,
    values: anim.values,
    keyTimes: anim.keyTimes,
    dur: anim.dur,
    repeatCount: anim.repeatCount !== undefined ? String(anim.repeatCount) : undefined,
    begin: anim.begin,
    calcMode: anim.calcMode,
    additive: anim.additive,
    accumulate: anim.accumulate,
    fill: anim.fill,
  });
  return tag("animate", a);
}

/** Render a SMIL <animateTransform> element. */
function renderSMILAnimateTransform(anim: SMILAnimateTransform): string {
  const a = attrs({
    attributeName: "transform",
    attributeType: "XML",
    type: anim.type,
    from: anim.from,
    to: anim.to,
    values: anim.values,
    keyTimes: anim.keyTimes,
    dur: anim.dur,
    repeatCount: anim.repeatCount !== undefined ? String(anim.repeatCount) : undefined,
    begin: anim.begin,
    additive: anim.additive,
    fill: anim.fill,
  });
  return tag("animateTransform", a);
}

/** Render a SMIL <animateMotion> element. */
function renderSMILAnimateMotion(anim: SMILAnimateMotion): string {
  const a = attrs({
    path: anim.path,
    dur: anim.dur,
    repeatCount: anim.repeatCount !== undefined ? String(anim.repeatCount) : undefined,
    begin: anim.begin,
    rotate: anim.rotate !== undefined ? String(anim.rotate) : undefined,
    keyTimes: anim.keyTimes,
    keyPoints: anim.keyPoints,
    fill: anim.fill,
    calcMode: anim.calcMode,
  });
  return tag("animateMotion", a);
}

/** Dispatch to the correct SMIL renderer based on kind. */
export function renderSMILAnimation(anim: SMILAnimation): string {
  switch (anim.kind) {
    case "animate":
      return renderSMILAnimate(anim);
    case "animateTransform":
      return renderSMILAnimateTransform(anim);
    case "animateMotion":
      return renderSMILAnimateMotion(anim);
  }
}

/** Render all SMIL animations for an element, joined as child element strings. */
export function renderSMILAnimations(animations: SMILAnimation[] | undefined): string {
  if (!animations || animations.length === 0) return "";
  return animations.map(renderSMILAnimation).join("\n");
}
