/**
 * SVG grouping and instancing elements.
 *
 * GroupSchema — <g> element for grouping with shared attributes.
 * Children can be shapes, text, and use instances.
 * Note: Nested groups not supported in this version (avoids Zod recursive type complexity).
 * Groups can be nested by placing them in config.elements — all groups are top-level.
 *
 * SymbolSchema — <symbol> in defs: a reusable template not rendered directly.
 * UseSchema — <use> to instance a symbol or clone any element by ID.
 *
 * ClipPathSchema — defines a clipping region using shape elements.
 * MaskSchema — defines a luminance mask for transparency effects.
 */

import { z } from "zod";
import { BaseElementSchema } from "./base.js";
import { SMILAnimationSchema } from "./animations.js";
import { ShapeElementSchema } from "./shapes.js";
import { TextElementSchema } from "./text.js";

const smilAnimations = z
  .array(SMILAnimationSchema)
  .optional()
  .describe("SMIL animations on this element");

// ---------------------------------------------------------------------------
// <use> — Instance a symbol or clone any element by ID
// ---------------------------------------------------------------------------

export const UseSchema = BaseElementSchema.extend({
  type: z.literal("use"),
  href: z
    .string()
    .describe(
      "Reference to the element to instance: '#symbolId' or '#anyElementId'. " +
      "The referenced element must be defined in defs (for symbols) or earlier in elements[]."
    ),
  x: z.number().optional().describe("X offset for the instance"),
  y: z.number().optional().describe("Y offset for the instance"),
  width: z
    .number()
    .positive()
    .optional()
    .describe("Width override for <symbol> instances. Symbol's viewBox is scaled to fit."),
  height: z.number().positive().optional().describe("Height override for <symbol> instances."),
  smilAnimations,
});

// ---------------------------------------------------------------------------
// Leaf elements — shapes, text, use (used inside groups)
// ---------------------------------------------------------------------------

export const LeafElementSchema = z.union([ShapeElementSchema, TextElementSchema, UseSchema]);

// ---------------------------------------------------------------------------
// <g> — Group with shared presentation attributes
// ---------------------------------------------------------------------------

export const GroupSchema = BaseElementSchema.extend({
  type: z.literal("group"),
  children: z
    .array(LeafElementSchema)
    .min(1)
    .describe(
      "Child elements inside this group. Can contain shapes, text, and use instances. " +
      "All children inherit the group's fill, stroke, opacity, transform, filter, and other presentation attrs. " +
      "Apply transform to the group to move/rotate/scale all children together. " +
      "Note: groups cannot be nested — use multiple top-level groups with coordinated transforms for layering."
    ),
  smilAnimations,
});

// ---------------------------------------------------------------------------
// <symbol> — Reusable element template (defined in defs, rendered via <use>)
// ---------------------------------------------------------------------------

export const SymbolSchema = z.object({
  id: z.string().describe("Required — referenced by use elements as href='#id'"),
  viewBox: z
    .string()
    .optional()
    .describe(
      "Symbol's internal coordinate system: 'minX minY width height'. " +
      "When a <use> overrides width/height, the symbol scales to fit."
    ),
  preserveAspectRatio: z.string().optional(),
  children: z
    .array(z.union([ShapeElementSchema, TextElementSchema]))
    .min(1)
    .describe("Shape and text elements that make up this symbol"),
  overflow: z
    .enum(["visible", "hidden"])
    .optional()
    .describe("Whether symbol content outside its viewBox is visible. Default: 'hidden'"),
});

// ---------------------------------------------------------------------------
// <clipPath> — Defines a clipping shape
// ---------------------------------------------------------------------------

export const ClipPathSchema = z.object({
  id: z.string().describe("Required — referenced by elements as clipPath='url(#id)'"),
  clipPathUnits: z
    .enum(["userSpaceOnUse", "objectBoundingBox"])
    .optional()
    .describe(
      "'userSpaceOnUse' (default): shape coords are in SVG user space. " +
      "'objectBoundingBox': shape coords are 0–1 relative to the clipped element."
    ),
  children: z
    .array(ShapeElementSchema)
    .min(1)
    .describe(
      "Shapes defining the clipping region. " +
      "Pixels inside the shape are visible, outside are clipped."
    ),
});

// ---------------------------------------------------------------------------
// <mask> — Defines a luminance/alpha mask
// ---------------------------------------------------------------------------

export const MaskSchema = z.object({
  id: z.string().describe("Required — referenced by elements as mask='url(#id)'"),
  maskUnits: z
    .enum(["userSpaceOnUse", "objectBoundingBox"])
    .optional()
    .describe("Coordinate system for mask region. Default: 'objectBoundingBox'"),
  maskContentUnits: z
    .enum(["userSpaceOnUse", "objectBoundingBox"])
    .optional()
    .describe("Coordinate system for mask content. Default: 'userSpaceOnUse'"),
  x: z.string().optional().describe("Mask region X. Default: '-10%'"),
  y: z.string().optional().describe("Mask region Y. Default: '-10%'"),
  width: z.string().optional().describe("Mask region width. Default: '120%'"),
  height: z.string().optional().describe("Mask region height. Default: '120%'"),
  children: z
    .array(z.union([ShapeElementSchema, TextElementSchema]))
    .min(1)
    .describe(
      "Mask content. White pixels = fully visible. Black = fully transparent. Grays = partial transparency. " +
      "Use a radial gradient fill on a circle to create a spotlight/vignette effect."
    ),
});

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type Group = z.infer<typeof GroupSchema>;
export type Use = z.infer<typeof UseSchema>;
export type Symbol = z.infer<typeof SymbolSchema>;
export type ClipPath = z.infer<typeof ClipPathSchema>;
export type Mask = z.infer<typeof MaskSchema>;
export type LeafElement = z.infer<typeof LeafElementSchema>;
