/**
 * SVG gradient schemas: linearGradient and radialGradient.
 *
 * Gradients are defined in defs and referenced by fill/stroke as 'url(#id)'.
 *
 * Gradient stop colors can be animated with SMIL <animate> on 'stop-color'
 * and 'stop-opacity' attributes — this is one of the few things only SMIL can do.
 *
 * Both gradient types are fully supported in modern SVG renderers.
 */

import { z } from "zod";
import { ColorSchema } from "./base.js";
import { SMILAnimationSchema } from "./animations.js";

// ---------------------------------------------------------------------------
// Gradient stop
// ---------------------------------------------------------------------------

export const GradientStopSchema = z.object({
  offset: z
    .union([z.number().min(0).max(1), z.string()])
    .describe(
      "Stop position along the gradient: 0.0–1.0 (number) or '0%'–'100%' (string). " +
      "0 / '0%' = gradient start, 1 / '100%' = gradient end."
    ),
  color: ColorSchema.describe("Stop color as hex: '#rrggbb' or '#rrggbbaa'"),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Stop opacity: 0.0 (transparent) to 1.0 (opaque). Defaults to 1."),
  smilAnimations: z
    .array(SMILAnimationSchema)
    .optional()
    .describe(
      "SMIL animations on this stop. Animate 'stop-color' for color cycling effects. " +
      "Example: { kind: 'animate', attributeName: 'stop-color', values: '#ff0000;#0000ff;#ff0000', dur: '3s', repeatCount: 'indefinite' }"
    ),
});

// ---------------------------------------------------------------------------
// Shared gradient attributes
// ---------------------------------------------------------------------------

const GradientBaseFields = {
  id: z.string().describe("Required — referenced by elements as fill='url(#id)' or stroke='url(#id)'"),
  gradientUnits: z
    .enum(["userSpaceOnUse", "objectBoundingBox"])
    .optional()
    .describe(
      "'objectBoundingBox' (default): coordinates are 0–1 relative to the element's bounding box. " +
      "'userSpaceOnUse': coordinates are in the SVG coordinate system."
    ),
  gradientTransform: z
    .string()
    .optional()
    .describe("Transform applied to the gradient: 'rotate(45)' for diagonal gradients"),
  spreadMethod: z
    .enum(["pad", "reflect", "repeat"])
    .optional()
    .describe(
      "Behavior outside gradient bounds. " +
      "'pad' (default): extends edge colors. " +
      "'reflect': mirrors gradient. " +
      "'repeat': tiles gradient."
    ),
  stops: z
    .array(GradientStopSchema)
    .min(2)
    .describe("Color stops along the gradient. Minimum 2 stops required."),
  href: z
    .string()
    .optional()
    .describe("Inherit stops and attributes from another gradient: '#otherId'. Useful for reuse."),
};

// ---------------------------------------------------------------------------
// <linearGradient>
// ---------------------------------------------------------------------------

export const LinearGradientSchema = z.object({
  type: z.literal("linearGradient"),
  ...GradientBaseFields,
  x1: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      "Gradient start X. With objectBoundingBox: 0–1 (default 0). " +
      "With userSpaceOnUse: SVG coordinates."
    ),
  y1: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Gradient start Y. Default: 0"),
  x2: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Gradient end X. Default: 1 (→ horizontal gradient by default)"),
  y2: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      "Gradient end Y. Default: 0. " +
      "Set x1=0,y1=0,x2=0,y2=1 for vertical. x1=0,y1=0,x2=1,y2=1 for diagonal."
    ),
});

// ---------------------------------------------------------------------------
// <radialGradient>
// ---------------------------------------------------------------------------

export const RadialGradientSchema = z.object({
  type: z.literal("radialGradient"),
  ...GradientBaseFields,
  cx: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Center X of the outer circle. With objectBoundingBox: default 0.5 (50%)"),
  cy: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Center Y of the outer circle. With objectBoundingBox: default 0.5 (50%)"),
  r: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Radius of the outer circle. With objectBoundingBox: default 0.5 (50%)"),
  fx: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      "Focal point X — where the gradient is brightest/most intense. " +
      "Defaults to cx. Offset from center for an off-center highlight effect."
    ),
  fy: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Focal point Y. Defaults to cy."),
  fr: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Focal circle radius. Default: 0 (point focus). Increase for a ring-shaped highlight."),
});

// ---------------------------------------------------------------------------
// Gradient union
// ---------------------------------------------------------------------------

export const GradientSchema = z.discriminatedUnion("type", [
  LinearGradientSchema,
  RadialGradientSchema,
]);

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type GradientStop = z.infer<typeof GradientStopSchema>;
export type LinearGradient = z.infer<typeof LinearGradientSchema>;
export type RadialGradient = z.infer<typeof RadialGradientSchema>;
export type Gradient = z.infer<typeof GradientSchema>;
