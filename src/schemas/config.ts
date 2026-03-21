/**
 * Main SVGConfig schema — the top-level input for the render_svg tool.
 *
 * Structure:
 *   canvas      SVG viewport and dimensions
 *   defs        Reusable definitions (gradients, filters, clipPaths, masks, symbols, paths, patterns)
 *   elements    Visual elements to render (shapes, text, groups, pattern primitives)
 *   animations  CSS @keyframes definitions (referenced by element cssClass)
 *
 * MCP SDK constraint (Issue #1643): The tool's inputSchema top-level MUST be z.object().
 * All discriminated unions here are nested inside the object, which is safe.
 *
 * AI generation notes:
 *   Define defs (gradients, filters, patterns) before referencing them in elements.
 *   CSS animations: define in animations[], target elements via matching cssClass.
 *   SMIL animations: define inline on each element via smilAnimations[].
 *   All IDs must be unique within the SVG.
 */

import { z } from "zod";
import { CanvasSchema } from "./canvas.js";
import { GradientSchema } from "./gradients.js";
import { FilterSchema } from "./filters.js";
import { CSSAnimationSchema } from "./animations.js";
import { ShapeElementSchema } from "./shapes.js";
import { TextElementSchema } from "./text.js";
import { GroupSchema, UseSchema, SymbolSchema, ClipPathSchema, MaskSchema } from "./groups.js";
import {
  RadialGroupSchema,
  ArcGroupSchema,
  GridGroupSchema,
  ScatterGroupSchema,
  PathGroupSchema,
  ParametricSchema,
} from "./patterns.js";

// ---------------------------------------------------------------------------
// SVG <pattern> — repeating tile fill definition
// ---------------------------------------------------------------------------

export const PatternSchema = z.object({
  id: z
    .string()
    .describe("Unique ID. Reference on any element as fill='url(#id)'."),

  width: z
    .number()
    .positive()
    .describe("Width of one tile in SVG units."),

  height: z
    .number()
    .positive()
    .describe("Height of one tile in SVG units."),

  x: z
    .number()
    .optional()
    .describe("Horizontal offset of the tile origin. Default is 0."),

  y: z
    .number()
    .optional()
    .describe("Vertical offset of the tile origin. Default is 0."),

  patternUnits: z
    .enum(["userSpaceOnUse", "objectBoundingBox"])
    .optional()
    .describe(
      "'userSpaceOnUse' (default): width and height are in SVG canvas units. " +
        "'objectBoundingBox': width and height are 0 to 1 fractions of the filled element's bounds."
    ),

  patternTransform: z
    .string()
    .optional()
    .describe(
      "Transform applied to the entire tile pattern. " +
        "Use 'rotate(45)' to produce a diagonal stripe pattern. " +
        "Use 'scale(2)' to enlarge the tile."
    ),

  children: z
    .array(z.union([ShapeElementSchema, TextElementSchema]))
    .min(1)
    .describe(
      "Shapes and text that make up one tile. " +
        "This content repeats across the filled element. " +
        "Example: a small circle centered in a 20x20 tile produces a polka-dot fill."
    ),
});

// ---------------------------------------------------------------------------
// <defs> — Reusable definitions (not rendered directly)
// ---------------------------------------------------------------------------

export const DefsSchema = z.object({
  gradients: z
    .array(GradientSchema)
    .optional()
    .describe(
      "Gradient definitions. Reference in elements as fill='url(#id)' or stroke='url(#id)'."
    ),
  filters: z
    .array(FilterSchema)
    .optional()
    .describe(
      "Filter effect definitions. Reference on elements as filter='url(#id)'. " +
        "Use 'preset' type for common effects (glow, blur, drop-shadow, neon, glitch)."
    ),
  clipPaths: z
    .array(ClipPathSchema)
    .optional()
    .describe(
      "Clip path definitions. Reference on elements as clipPath='url(#id)'."
    ),
  masks: z
    .array(MaskSchema)
    .optional()
    .describe(
      "Mask definitions. Reference on elements as mask='url(#id)'. " +
        "White pixels are visible, black pixels are transparent. " +
        "A radial gradient mask creates a spotlight or vignette effect."
    ),
  symbols: z
    .array(SymbolSchema)
    .optional()
    .describe(
      "Symbol templates for reuse. Render instances with 'use' element type."
    ),
  paths: z
    .array(
      z.object({
        id: z.string().describe("Path ID referenced by textPath.pathId"),
        d: z.string().describe("SVG path data for the text to follow"),
      })
    )
    .optional()
    .describe(
      "Invisible path definitions for textPath elements. " +
        "Define the curve here, then reference in a text element with type='textPath'."
    ),
  patterns: z
    .array(PatternSchema)
    .optional()
    .describe(
      "SVG pattern tile definitions. Reference on any element as fill='url(#id)'. " +
        "The tile repeats to fill the element's bounding area. " +
        "Useful for dot grids, stripes, textures and repeated motifs."
    ),
});

// ---------------------------------------------------------------------------
// Any renderable element (top-level or group children)
// ---------------------------------------------------------------------------

// AnyElement type is defined manually below to avoid TS7056 (inferred type exceeds max length).
// The cast `as unknown as z.ZodType<AnyElement>` bridges the runtime Zod object to this type.
import type {
  RadialGroup,
  ArcGroup,
  GridGroup,
  ScatterGroup,
  PathGroup,
  Parametric,
} from "./patterns.js";
import type { Group, Use, LeafElement } from "./groups.js";
import type { ShapeElement } from "./shapes.js";
import type { TextElement } from "./text.js";

export type AnyElement =
  | ShapeElement
  | TextElement
  | Group
  | Use
  | RadialGroup
  | ArcGroup
  | GridGroup
  | ScatterGroup
  | PathGroup
  | Parametric;

export const AnyElementSchema = z.union([
  ShapeElementSchema,
  TextElementSchema,
  GroupSchema,
  UseSchema,
  RadialGroupSchema,
  ArcGroupSchema,
  GridGroupSchema,
  ScatterGroupSchema,
  PathGroupSchema,
  ParametricSchema,
]) as unknown as z.ZodType<AnyElement>;

// ---------------------------------------------------------------------------
// Root SVGConfig — the complete render specification
// ---------------------------------------------------------------------------

export const SVGConfigSchema = z.object({
  canvas: CanvasSchema.describe("SVG canvas dimensions and coordinate system"),

  defs: DefsSchema.optional().describe(
    "Reusable definitions: gradients, filters, clipPaths, masks, symbols, patterns. " +
      "Must be defined before elements that reference them."
  ),

  elements: z
    .array(AnyElementSchema)
    .min(1)
    .describe(
      "Visual elements to render, in draw order (first = bottom, last = top). " +
        "Types: 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'image', " +
        "'text', 'textPath', 'group', 'use', " +
        "'radial-group', 'arc-group', 'grid-group', 'scatter-group', 'path-group', 'parametric'"
    ),

  animations: z
    .array(CSSAnimationSchema)
    .optional()
    .describe(
      "CSS @keyframes animation definitions. " +
        "Each animation has a 'name'. Elements are animated by setting their cssClass to match this name. " +
        "The renderer generates a <style> block with @keyframes and class rules. " +
        "For SMIL animations (path morphing, motion paths, gradient stop animation), use element.smilAnimations[] instead."
    ),
  // Cast prevents TS7056 "inferred type exceeds maximum length" — deep discriminated union complexity.
  // Using `as unknown as z.ZodType<SVGConfig>` so MCP SDK handler receives correct SVGConfig type.
}) as unknown as z.ZodType<SVGConfig>;

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type Defs = z.infer<typeof DefsSchema>;
// AnyElement is defined above alongside AnyElementSchema to avoid TS7056.
export type Pattern = z.infer<typeof PatternSchema>;

// Manually defined to break the circular z.infer dependency caused by the cast above.
export type SVGConfig = {
  canvas: z.infer<typeof CanvasSchema>;
  defs?: Defs;
  elements: AnyElement[];
  animations?: z.infer<typeof CSSAnimationSchema>[];
};

// Re-export all schemas for convenience
export * from "./canvas.js";
export * from "./gradients.js";
export * from "./filters.js";
export * from "./animations.js";
export * from "./shapes.js";
export * from "./text.js";
export * from "./groups.js";
export * from "./patterns.js";
