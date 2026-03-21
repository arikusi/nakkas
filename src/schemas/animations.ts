/**
 * Animation schemas: CSS @keyframes and SMIL animations.
 *
 * Two animation systems:
 *
 * 1. CSS @keyframes — defined in config.animations[], applied via element.cssClass
 *    - Animates: opacity, fill, stroke, transform, filter, clip-path, font-size, etc.
 *    - Cannot animate SVG path `d` attribute or `points`
 *
 * 2. SMIL — defined inline on each element via element.smilAnimations[]
 *    - Can animate `d` (path morphing), motion along path, gradient stops
 *    - Event-driven begin ('click', 'mouseover') does not work in static SVG contexts (e.g. <img> tag)
 */

import { z } from "zod";
import { TimingFunctionSchema } from "./base.js";

// ---------------------------------------------------------------------------
// CSS @keyframes animations
// ---------------------------------------------------------------------------

/**
 * A single keyframe stop in a CSS @keyframes rule.
 * @example { offset: 0, properties: { opacity: "0", transform: "scale(0)" } }
 * @example { offset: "from", properties: { fill: "#ff0000" } }
 */
export const CSSKeyframeSchema = z.object({
  offset: z
    .union([z.number().min(0).max(100), z.enum(["from", "to"])])
    .describe(
      "Keyframe position: 0-100 (percentage) or 0-1 (fractional), or 'from'/'to'"
    ),
  properties: z
    .record(z.string(), z.string())
    .describe(
      "CSS property → value pairs at this keyframe. Use camelCase or kebab-case keys — both work. " +
      "Examples: { opacity: '0', transform: 'rotate(0deg)', fill: '#ff0000', strokeDashoffset: '500' }"
    ),
});

/**
 * A named CSS animation with keyframes.
 * Reference from an element's cssClass by matching the class name to animationName.
 *
 * The renderer generates:
 * ```css
 * @keyframes {name} { ... }
 * .{cssClass} { animation: {name} {duration} ... }
 * ```
 */
export const CSSAnimationSchema = z.object({
  name: z
    .string()
    .describe(
      "Animation identifier. Elements target this animation by having a matching cssClass. " +
      "Example: name='pulse' → element has cssClass='pulse'"
    ),
  duration: z
    .string()
    .describe("Total animation duration: '2s', '500ms', '1.5s'"),
  timingFunction: TimingFunctionSchema.optional().describe(
    "Easing across the full animation. Can be overridden per-keyframe with 'animation-timing-function'."
  ),
  iterationCount: z
    .union([z.number().int().positive(), z.literal("infinite")])
    .optional()
    .describe("Repeat count: positive integer or 'infinite'. Default: 1"),
  direction: z
    .enum(["normal", "reverse", "alternate", "alternate-reverse"])
    .optional()
    .describe(
      "Playback direction. 'alternate' reverses on even iterations — great for ping-pong loops."
    ),
  fillMode: z
    .enum(["none", "forwards", "backwards", "both"])
    .optional()
    .describe(
      "What styles apply before/after animation: 'forwards' holds end state, " +
      "'backwards' applies first keyframe during delay, 'both' does both."
    ),
  delay: z
    .string()
    .optional()
    .describe("Delay before animation starts: '0s', '1s', '250ms'"),
  keyframes: z
    .array(CSSKeyframeSchema)
    .min(2)
    .describe("Keyframe stops. Must have at least 2 (start and end)."),
});

// ---------------------------------------------------------------------------
// SMIL animations — inline on SVG elements
// ---------------------------------------------------------------------------

/**
 * SMIL <animate> — animates a single SVG attribute over time.
 * The only way to animate the `d` attribute (path morphing).
 *
 * Path morphing requirement: from/to paths must have identical command counts and types.
 * Only coordinate values can differ.
 */
export const SMILAnimateSchema = z.object({
  kind: z.literal("animate").describe("Animates a single SVG presentation attribute"),
  attributeName: z
    .string()
    .describe(
      "SVG attribute to animate. Examples: 'opacity', 'r', 'cx', 'cy', 'fill', " +
      "'stroke-width', 'd' (path morphing), 'stop-color', 'stop-opacity'"
    ),
  from: z.string().optional().describe("Starting value. Use with 'to' for simple two-state animation."),
  to: z.string().optional().describe("Ending value. Use with 'from' for simple two-state animation."),
  values: z
    .string()
    .optional()
    .describe(
      "Semicolon-separated keyframe values: '0;1;0' or '#ff0000;#0000ff;#ff0000'. " +
      "Use instead of from/to for multi-step animation."
    ),
  keyTimes: z
    .string()
    .optional()
    .describe(
      "Semicolon-separated time offsets matching 'values': '0;0.5;1'. " +
      "Required when values has 3+ entries."
    ),
  dur: z.string().describe("Animation duration: '2s', '500ms', '1.5s'"),
  repeatCount: z
    .union([z.number().int().positive(), z.literal("indefinite")])
    .optional()
    .describe("Repeat count: integer or 'indefinite' for looping"),
  begin: z
    .string()
    .optional()
    .describe(
      "When to start: '0s' (immediately), '1s' (delay), 'otherId.end' (after another animation ends). " +
      "Note: 'click' and 'mouseover' do not work when SVG is rendered as a static image (e.g. <img> tag). " +
      "Use '0s' or a delay string for automatic triggering."
    ),
  calcMode: z
    .enum(["discrete", "linear", "paced", "spline"])
    .optional()
    .describe(
      "Interpolation mode. 'discrete' snaps (binary flip). 'linear' interpolates smoothly. " +
      "'paced' uses constant speed. Default: 'linear' (except 'discrete' for non-numeric attributes)."
    ),
  additive: z
    .enum(["sum", "replace"])
    .optional()
    .describe("'sum' adds to base value, 'replace' (default) overrides it"),
  accumulate: z
    .enum(["sum", "none"])
    .optional()
    .describe("'sum' accumulates value across repeats. Useful for continuous motion."),
  fill: z
    .enum(["freeze", "remove"])
    .optional()
    .describe("End behavior: 'freeze' holds final value, 'remove' (default) snaps back to initial"),
});

/**
 * SMIL <animateTransform> — animates transform attributes.
 * More precise than CSS transform for SVG coordinate-based transforms.
 */
export const SMILAnimateTransformSchema = z.object({
  kind: z.literal("animateTransform"),
  type: z
    .enum(["translate", "scale", "rotate", "skewX", "skewY"])
    .describe("Transform type to animate"),
  from: z
    .string()
    .optional()
    .describe(
      "Starting transform value. For rotate: '0 cx cy' where cx,cy is the rotation center. " +
      "For translate: 'tx ty'. For scale: 'sx sy'."
    ),
  to: z
    .string()
    .optional()
    .describe("Ending transform value. Same format as 'from'."),
  values: z
    .string()
    .optional()
    .describe("Semicolon-separated keyframe values. Alternative to from/to for multi-step."),
  keyTimes: z.string().optional().describe("Semicolon-separated time offsets for 'values' keyframes"),
  dur: z.string().describe("Animation duration: '2s', '500ms'"),
  repeatCount: z
    .union([z.number().int().positive(), z.literal("indefinite")])
    .optional()
    .describe("Repeat count: integer or 'indefinite'"),
  begin: z.string().optional().describe("Start time or sync expression: '0s', 'otherId.end'"),
  additive: z
    .enum(["sum", "replace"])
    .optional()
    .describe("'sum' composes with existing transform, 'replace' overrides"),
  fill: z
    .enum(["freeze", "remove"])
    .optional()
    .describe("End behavior: 'freeze' holds final state, 'remove' returns to initial"),
});

/**
 * SMIL <animateMotion> — moves an element along a path.
 * The element follows the path trajectory automatically.
 */
export const SMILAnimateMotionSchema = z.object({
  kind: z.literal("animateMotion"),
  path: z
    .string()
    .min(1)
    .describe(
      "SVG path data defining the motion trajectory. Same format as <path d='...'> attribute. " +
      "Example: 'M 0 0 C 100 0 100 100 200 100'"
    ),
  dur: z.string().describe("Time to travel the full path: '3s', '1500ms'"),
  repeatCount: z
    .union([z.number().int().positive(), z.literal("indefinite")])
    .optional()
    .describe("Repeat count: integer or 'indefinite' for continuous motion"),
  begin: z.string().optional().describe("Start time: '0s' or delay string"),
  rotate: z
    .union([z.number(), z.enum(["auto", "auto-reverse"])])
    .optional()
    .describe(
      "Element rotation along path. 'auto' rotates to face forward. " +
      "'auto-reverse' rotates 180° from forward. Number sets fixed angle."
    ),
  keyTimes: z.string().optional().describe("Semicolon-separated time offsets for keyPoints"),
  keyPoints: z
    .string()
    .optional()
    .describe("Semicolon-separated path positions (0–1): '0;0.3;0.6;1' controls speed along path"),
  fill: z
    .enum(["freeze", "remove"])
    .optional()
    .describe("End behavior: 'freeze' stays at path end, 'remove' returns to start"),
  calcMode: z
    .enum(["paced", "linear", "spline", "discrete"])
    .optional()
    .describe("Motion interpolation. 'paced' = constant speed (default for animateMotion)"),
});

/**
 * Union of all SMIL animation types.
 * Applied inline on elements via element.smilAnimations[].
 */
export const SMILAnimationSchema = z.discriminatedUnion("kind", [
  SMILAnimateSchema,
  SMILAnimateTransformSchema,
  SMILAnimateMotionSchema,
]);

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type CSSKeyframe = z.infer<typeof CSSKeyframeSchema>;
export type CSSAnimation = z.infer<typeof CSSAnimationSchema>;
export type SMILAnimate = z.infer<typeof SMILAnimateSchema>;
export type SMILAnimateTransform = z.infer<typeof SMILAnimateTransformSchema>;
export type SMILAnimateMotion = z.infer<typeof SMILAnimateMotionSchema>;
export type SMILAnimation = z.infer<typeof SMILAnimationSchema>;
