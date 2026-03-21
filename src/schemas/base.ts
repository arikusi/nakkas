/**
 * Base types shared across all SVG schema modules.
 *
 * Design principles (from RESEARCH.md):
 * - Hex colors only (#rrggbb) — most reliable for LLM generation
 * - Full descriptive field names (not abbreviations)
 * - .describe() on every field — drives LLM tool call accuracy
 * - Enums for all finite sets
 * - Optional fields with sensible defaults where possible
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitive value types
// ---------------------------------------------------------------------------

export const ColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, "Must be hex color: '#rrggbb' or '#rrggbbaa'")
  .describe("CSS hex color: '#rrggbb' or '#rrggbbaa' (with alpha)");

export const PaintSchema = z
  .string()
  .describe(
    "Paint value: hex '#rrggbb', 'none' (transparent), or 'url(#gradientId)' for gradient fill"
  );

/**
 * CSS length value. Use a number for pixels, string for other units.
 * @example 200, "50%", "10em", "100%"
 */
export const LengthSchema = z
  .union([z.number(), z.string()])
  .describe("Pixel count (200) or CSS length string ('50%', '10em', '100%')");

export const TimingFunctionSchema = z
  .string()
  .describe(
    "CSS easing function: 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', or 'cubic-bezier(0.4, 0, 0.2, 1)'"
  );

// ---------------------------------------------------------------------------
// SVG presentation attribute enums
// ---------------------------------------------------------------------------

export const FillRuleSchema = z
  .enum(["nonzero", "evenodd"])
  .describe("SVG fill rule for overlapping paths: 'nonzero' (default) or 'evenodd'");

export const StrokeLinecapSchema = z
  .enum(["butt", "round", "square"])
  .describe("Stroke endpoint shape: 'butt' (flat), 'round', or 'square' (extends past endpoint)");

export const StrokeLinejoinSchema = z
  .enum(["miter", "round", "bevel"])
  .describe("Stroke corner shape: 'miter' (sharp, default), 'round', or 'bevel' (flat)");

export const VisibilitySchema = z
  .enum(["visible", "hidden"])
  .describe("Element visibility. 'hidden' hides but preserves layout space");

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const FontFamilySchema = z
  .string()
  .describe(
    "CSS font-family value. System fonts work everywhere without loading: " +
    "'Arial', 'Helvetica', 'Courier New', 'Georgia', 'Verdana', " +
    "'monospace', 'sans-serif', 'serif'. " +
    "Custom font families also accepted — ensure the font is available in the target environment."
  );

export const FontWeightSchema = z
  .union([
    z.enum(["normal", "bold", "bolder", "lighter"]),
    z.number().int().min(100).max(900).multipleOf(100),
  ])
  .describe("Font weight: 'normal', 'bold', or numeric multiple of 100 (100–900)");

export const FontStyleSchema = z
  .enum(["normal", "italic", "oblique"])
  .describe("Font style: 'normal', 'italic', or 'oblique'");

export const TextAnchorSchema = z
  .enum(["start", "middle", "end"])
  .describe(
    "Horizontal text anchor: 'start' (left-align from x), 'middle' (center on x), 'end' (right-align to x)"
  );

export const DominantBaselineSchema = z
  .enum(["auto", "middle", "central", "hanging", "text-bottom", "text-top"])
  .describe("Vertical text alignment. Use 'middle' + 'central' together to center text on a point");

// ---------------------------------------------------------------------------
// Shared SVG presentation attributes (visual styling)
// Applied to all renderable elements via BaseElementSchema.
// ---------------------------------------------------------------------------

export const PresentationAttrsSchema = z.object({
  fill: PaintSchema.optional().describe(
    "Fill paint: hex '#rrggbb', 'none', or 'url(#gradientId)'. Default: '#000000'"
  ),
  fillOpacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Fill transparency: 0.0 (invisible) to 1.0 (fully opaque)"),
  fillRule: FillRuleSchema.optional(),

  stroke: PaintSchema.optional().describe(
    "Stroke paint: hex '#rrggbb' or 'none'. Set strokeWidth too, default stroke is 'none'."
  ),
  strokeWidth: z
    .number()
    .min(0)
    .optional()
    .describe("Stroke thickness in pixels. Renders on both sides of the path centerline."),
  strokeOpacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Stroke transparency: 0.0 to 1.0"),
  strokeLinecap: StrokeLinecapSchema.optional(),
  strokeLinejoin: StrokeLinejoinSchema.optional(),
  strokeDasharray: z
    .string()
    .optional()
    .describe(
      "Dash pattern: '10 5' (10px dash, 5px gap), '5' (equal dashes and gaps). " +
      "Use with strokeDashoffset for draw-on animation."
    ),
  strokeDashoffset: z
    .number()
    .optional()
    .describe(
      "Offset into the dash pattern. Animate from totalPathLength → 0 for a draw-on effect."
    ),

  opacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Overall element opacity (affects fill + stroke together): 0.0 to 1.0"),
  visibility: VisibilitySchema.optional(),

  filter: z
    .string()
    .optional()
    .describe("Apply a filter defined in defs: 'url(#filterId)'. Filters can add glow, blur, etc."),
  clipPath: z
    .string()
    .optional()
    .describe("Clip to a clipPath shape defined in defs: 'url(#clipPathId)'"),
  mask: z
    .string()
    .optional()
    .describe("Apply a mask defined in defs: 'url(#maskId)'"),

  transform: z
    .string()
    .optional()
    .describe(
      "SVG/CSS transform string: 'rotate(45)' 'translate(100, 50)' 'scale(1.5)' 'rotate(45, 100, 100)'. " +
      "For CSS animation, also set transformBox='fill-box' for correct transform-origin behavior."
    ),
  transformBox: z
    .enum(["fill-box", "view-box", "stroke-box"])
    .optional()
    .describe(
      "Sets the transform reference box. Use 'fill-box' for CSS rotation/scaling animations — " +
      "without this, SVG transforms use the viewport as origin, not the element's own center."
    ),
  transformOrigin: z
    .string()
    .optional()
    .describe(
      "Transform origin for CSS animations: 'center', '50% 50%', '100px 200px'. " +
      "Requires transformBox='fill-box' to work correctly in SVG."
    ),
});

// ---------------------------------------------------------------------------
// Structural / identification attributes
// ---------------------------------------------------------------------------

export const StructuralAttrsSchema = z.object({
  id: z
    .string()
    .optional()
    .describe(
      "Unique element ID. Required when: (1) referenced by filter/gradient/clipPath, " +
      "(2) used as SMIL animation target, (3) instanced via <use> element."
    ),
  cssClass: z
    .string()
    .optional()
    .describe(
      "CSS class(es) applied to this element. Space-separated: 'fade-in glow'. " +
      "CSS keyframe animations defined in the config's 'animations' array target elements by class."
    ),
  style: z
    .string()
    .optional()
    .describe("Inline CSS style string. Overrides class styles. Example: 'font-size:14px;letter-spacing:2px'"),
});

// ---------------------------------------------------------------------------
// Base element schema — extended by all visual elements
// ---------------------------------------------------------------------------

/**
 * Every renderable SVG element inherits from this.
 * Structural attrs (id, class) + all visual presentation attrs.
 */
export const BaseElementSchema = StructuralAttrsSchema.merge(PresentationAttrsSchema);

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type Color = z.infer<typeof ColorSchema>;
export type Paint = z.infer<typeof PaintSchema>;
export type PresentationAttrs = z.infer<typeof PresentationAttrsSchema>;
export type BaseElement = z.infer<typeof BaseElementSchema>;
