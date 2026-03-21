/**
 * Gradient rendering: linearGradient and radialGradient with their stops.
 *
 * Stop color/opacity can be animated via SMIL — the most reliable way to
 * create color cycling and gradient morph effects.
 */

import type { Gradient, GradientStop, LinearGradient, RadialGradient } from "../schemas/gradients.js";
import { attrs, tag, blockTag, num, length } from "./utils.js";
import { renderSMILAnimations } from "./animation-renderer.js";

// ---------------------------------------------------------------------------
// Gradient stop
// ---------------------------------------------------------------------------

function renderStop(stop: GradientStop): string {
  const offset =
    typeof stop.offset === "number"
      ? `${num(stop.offset * 100)}%`
      : stop.offset;

  const stopAttrs = attrs({
    offset,
    "stop-color": stop.color,
    "stop-opacity": stop.opacity !== undefined ? num(stop.opacity) : undefined,
  });

  const smil = renderSMILAnimations(stop.smilAnimations);
  if (smil) {
    return `<stop ${stopAttrs}>\n${smil}\n</stop>`;
  }
  return tag("stop", stopAttrs);
}

// ---------------------------------------------------------------------------
// linearGradient
// ---------------------------------------------------------------------------

function renderLinearGradient(g: LinearGradient): string {
  const a = attrs({
    id: g.id,
    x1: length(g.x1),
    y1: length(g.y1),
    x2: length(g.x2),
    y2: length(g.y2),
    gradientUnits: g.gradientUnits,
    gradientTransform: g.gradientTransform,
    spreadMethod: g.spreadMethod,
    href: g.href,
  });

  const stops = g.stops.map(renderStop).join("\n");
  return blockTag("linearGradient", a, stops);
}

// ---------------------------------------------------------------------------
// radialGradient
// ---------------------------------------------------------------------------

function renderRadialGradient(g: RadialGradient): string {
  const a = attrs({
    id: g.id,
    cx: length(g.cx),
    cy: length(g.cy),
    r: length(g.r),
    fx: length(g.fx),
    fy: length(g.fy),
    fr: length(g.fr),
    gradientUnits: g.gradientUnits,
    gradientTransform: g.gradientTransform,
    spreadMethod: g.spreadMethod,
    href: g.href,
  });

  const stops = g.stops.map(renderStop).join("\n");
  return blockTag("radialGradient", a, stops);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function renderGradient(gradient: Gradient): string {
  switch (gradient.type) {
    case "linearGradient":
      return renderLinearGradient(gradient);
    case "radialGradient":
      return renderRadialGradient(gradient);
  }
}
