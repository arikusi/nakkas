/**
 * SVG text element schemas.
 *
 * Three text types:
 * - TextSchema: Positioned text with inline spans
 * - TspanSchema: Inline text segment (nested inside text)
 * - TextPathSchema: Text that flows along a path curve
 *
 * Font note: system fonts ('Arial', 'monospace', etc.) work everywhere without loading.
 * Custom fonts work when available in the target rendering environment.
 */

import { z } from "zod";
import {
  BaseElementSchema,
  FontFamilySchema,
  FontWeightSchema,
  FontStyleSchema,
  TextAnchorSchema,
  DominantBaselineSchema,
} from "./base.js";
import { SMILAnimationSchema } from "./animations.js";

const smilAnimations = z
  .array(SMILAnimationSchema)
  .optional()
  .describe("SMIL animations on this text element");

// Shared text styling fields (used in both text and tspan)
const TextStylingFields = {
  fontFamily: FontFamilySchema.optional(),
  fontSize: z
    .number()
    .positive()
    .optional()
    .describe("Font size in SVG user units (pixels at 1:1 scale)"),
  fontWeight: FontWeightSchema.optional(),
  fontStyle: FontStyleSchema.optional(),
  letterSpacing: z
    .number()
    .optional()
    .describe("Space between characters in SVG user units. Negative for tighter tracking."),
  textAnchor: TextAnchorSchema.optional(),
  dominantBaseline: DominantBaselineSchema.optional(),
};

// ---------------------------------------------------------------------------
// <tspan> — Inline text segment with independent styling/positioning
// ---------------------------------------------------------------------------

export const TspanSchema = z.object({
  text: z.string().describe("The text content to render"),
  dx: z
    .number()
    .optional()
    .describe("Relative X offset from previous character/tspan in SVG user units"),
  dy: z
    .number()
    .optional()
    .describe("Relative Y offset from previous character/tspan. Use for line breaks."),
  x: z
    .number()
    .optional()
    .describe("Absolute X position — overrides cursor position"),
  y: z
    .number()
    .optional()
    .describe("Absolute Y position — overrides cursor position"),
  rotate: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      "Per-character rotation. Single number rotates all chars: 45. " +
      "Space-separated list rotates individually: '0 10 20 30'"
    ),
  cssClass: z.string().optional().describe("CSS class for targeting this span with animations"),
  style: z.string().optional().describe("Inline CSS style"),
  fill: z.string().optional().describe("Text fill color: hex '#rrggbb' or 'none'"),
  stroke: z.string().optional().describe("Text stroke color"),
  strokeWidth: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  ...TextStylingFields,
});

// ---------------------------------------------------------------------------
// <text> — Positioned text element
// ---------------------------------------------------------------------------

export const TextSchema = BaseElementSchema.extend({
  type: z.literal("text"),
  x: z.number().optional().default(0).describe("X position of text anchor point"),
  y: z.number().optional().default(0).describe("Y position of text anchor point (baseline by default)"),
  content: z
    .union([
      z.string(),
      z.array(z.union([z.string(), TspanSchema])),
    ])
    .describe(
      "Text content. Either a plain string or an array mixing plain strings and tspan objects. " +
      "Use tspans to apply different styles to parts of the text, or for positioning control. " +
      "Example: ['Hello ', { text: 'world', fill: '#ff0000' }, '!']"
    ),
  ...TextStylingFields,
  smilAnimations,
});

// ---------------------------------------------------------------------------
// <textPath> — Text that follows a curved path
// ---------------------------------------------------------------------------

export const TextPathSchema = BaseElementSchema.extend({
  type: z.literal("textPath"),
  pathId: z
    .string()
    .describe(
      "ID of a <path> element defined in defs that the text follows. " +
      "The path must be in defs with a matching id."
    ),
  text: z.string().describe("The text content to render along the path"),
  startOffset: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      "Where along the path text begins. Number = SVG units, string = percentage: '50%' centers text. " +
      "Animate with SMIL for a text-scrolling effect."
    ),
  method: z
    .enum(["align", "stretch"])
    .optional()
    .describe("How glyphs are placed: 'align' keeps glyph shapes (default), 'stretch' warps them"),
  spacing: z
    .enum(["auto", "exact"])
    .optional()
    .describe("Letter spacing: 'auto' uses font metrics, 'exact' uses letterSpacing attribute"),
  x: z.number().optional().describe("X position of the outer <text> wrapper element"),
  y: z.number().optional().describe("Y position of the outer <text> wrapper element"),
  ...TextStylingFields,
  smilAnimations,
});

// ---------------------------------------------------------------------------
// Text element union
// ---------------------------------------------------------------------------

export const TextElementSchema = z.discriminatedUnion("type", [
  TextSchema,
  TextPathSchema,
]);

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type Tspan = z.infer<typeof TspanSchema>;
export type Text = z.infer<typeof TextSchema>;
export type TextPath = z.infer<typeof TextPathSchema>;
export type TextElement = z.infer<typeof TextElementSchema>;
