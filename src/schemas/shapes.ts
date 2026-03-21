/**
 * SVG shape element schemas.
 *
 * Each shape extends BaseElementSchema (structural + presentation attrs)
 * and adds shape-specific geometry fields.
 *
 * SMIL animations can be attached inline to any shape via smilAnimations[].
 * CSS animations target shapes via cssClass.
 *
 * Discriminated on the 'type' field — safe to use inside z.discriminatedUnion()
 * as long as the top-level tool inputSchema is z.object() (MCP SDK Issue #1643).
 */

import { z } from "zod";
import { BaseElementSchema, StrokeLinecapSchema, StrokeLinejoinSchema } from "./base.js";
import { SMILAnimationSchema } from "./animations.js";

// Shared field for inline SMIL animations on any shape
const smilAnimations = z
  .array(SMILAnimationSchema)
  .optional()
  .describe(
    "SMIL animations on this element. Use 'animate' kind for attribute transitions (including path morphing), " +
    "'animateTransform' for transforms, 'animateMotion' for path-following movement."
  );

// ---------------------------------------------------------------------------
// <rect> — Rectangle with optional rounded corners
// ---------------------------------------------------------------------------

export const RectSchema = BaseElementSchema.extend({
  type: z.literal("rect"),
  x: z.number().optional().default(0).describe("Left edge X coordinate in SVG user units"),
  y: z.number().optional().default(0).describe("Top edge Y coordinate in SVG user units"),
  width: z.number().positive().describe("Rectangle width in SVG user units"),
  height: z.number().positive().describe("Rectangle height in SVG user units"),
  rx: z
    .number()
    .min(0)
    .optional()
    .describe("Corner radius X — creates rounded corners. Set rx=ry for uniform rounding."),
  ry: z
    .number()
    .min(0)
    .optional()
    .describe("Corner radius Y — defaults to rx when omitted"),
  smilAnimations,
});

// ---------------------------------------------------------------------------
// <circle> — Perfect circle
// ---------------------------------------------------------------------------

export const CircleSchema = BaseElementSchema.extend({
  type: z.literal("circle"),
  cx: z.number().optional().default(0).describe("Center X coordinate"),
  cy: z.number().optional().default(0).describe("Center Y coordinate"),
  r: z.number().positive().describe("Radius in SVG user units"),
  smilAnimations,
});

// ---------------------------------------------------------------------------
// <ellipse> — Ellipse with independent X/Y radii
// ---------------------------------------------------------------------------

export const EllipseSchema = BaseElementSchema.extend({
  type: z.literal("ellipse"),
  cx: z.number().optional().default(0).describe("Center X coordinate"),
  cy: z.number().optional().default(0).describe("Center Y coordinate"),
  rx: z.number().positive().describe("Horizontal radius"),
  ry: z.number().positive().describe("Vertical radius"),
  smilAnimations,
});

// ---------------------------------------------------------------------------
// <line> — Straight line segment
// ---------------------------------------------------------------------------

export const LineSchema = BaseElementSchema.extend({
  type: z.literal("line"),
  x1: z.number().describe("Start point X coordinate"),
  y1: z.number().describe("Start point Y coordinate"),
  x2: z.number().describe("End point X coordinate"),
  y2: z.number().describe("End point Y coordinate"),
  strokeLinecap: StrokeLinecapSchema.optional(),
  smilAnimations,
});

// ---------------------------------------------------------------------------
// <polyline> — Open polygon (series of connected line segments, not closed)
// ---------------------------------------------------------------------------

export const PolylineSchema = BaseElementSchema.extend({
  type: z.literal("polyline"),
  points: z
    .string()
    .describe(
      "Space-separated list of x,y coordinate pairs: '10,20 50,80 90,20'. " +
      "Polyline is open (start and end not connected). Use polygon for closed shapes."
    ),
  strokeLinecap: StrokeLinecapSchema.optional(),
  strokeLinejoin: StrokeLinejoinSchema.optional(),
  smilAnimations,
});

// ---------------------------------------------------------------------------
// <polygon> — Closed polygon (auto-connects last point to first)
// ---------------------------------------------------------------------------

export const PolygonSchema = BaseElementSchema.extend({
  type: z.literal("polygon"),
  points: z
    .string()
    .describe(
      "Space-separated list of x,y coordinate pairs: '50,10 90,90 10,90' (triangle). " +
      "Polygon auto-closes (last point connects to first). " +
      "For morphing animation: keep the same number of points in from/to states."
    ),
  strokeLinejoin: StrokeLinejoinSchema.optional(),
  smilAnimations,
});

// ---------------------------------------------------------------------------
// <path> — Arbitrary path using SVG path commands
// ---------------------------------------------------------------------------

export const PathSchema = BaseElementSchema.extend({
  type: z.literal("path"),
  d: z
    .string()
    .describe(
      "SVG path data using path commands. " +
      "Key commands: M(moveto) L(lineto) H(horizontal) V(vertical) " +
      "C(cubic bezier) Q(quadratic bezier) A(arc) Z(closepath). " +
      "Uppercase = absolute coords, lowercase = relative coords. " +
      "Example circle: 'M 100 50 A 50 50 0 1 1 99.9 50 Z'. " +
      "For SMIL path morphing: from/to paths must have identical command sequence."
    ),
  strokeLinecap: StrokeLinecapSchema.optional(),
  strokeLinejoin: StrokeLinejoinSchema.optional(),
  smilAnimations,
});

// ---------------------------------------------------------------------------
// <image> — Raster or vector image element
// ---------------------------------------------------------------------------

export const ImageSchema = BaseElementSchema.extend({
  type: z.literal("image"),
  href: z
    .string()
    .describe(
      "Image source URL or data:image/... URI for embedded raster images. " +
      "Examples: 'https://example.com/photo.png', 'data:image/png;base64,...'"
    ),
  x: z.number().optional().default(0).describe("Left edge X coordinate in SVG user units"),
  y: z.number().optional().default(0).describe("Top edge Y coordinate in SVG user units"),
  width: z.number().positive().describe("Image display width in SVG user units"),
  height: z.number().positive().describe("Image display height in SVG user units"),
  preserveAspectRatio: z
    .string()
    .optional()
    .describe(
      "How to scale the image: 'xMidYMid meet' (default, fit inside), " +
      "'xMidYMid slice' (cover, may crop), 'none' (stretch to fill)"
    ),
  smilAnimations,
});

// ---------------------------------------------------------------------------
// Shape element union — discriminated by 'type' field
// ---------------------------------------------------------------------------

export const ShapeElementSchema = z.discriminatedUnion("type", [
  RectSchema,
  CircleSchema,
  EllipseSchema,
  LineSchema,
  PolylineSchema,
  PolygonSchema,
  PathSchema,
  ImageSchema,
]);

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type Rect = z.infer<typeof RectSchema>;
export type Circle = z.infer<typeof CircleSchema>;
export type Ellipse = z.infer<typeof EllipseSchema>;
export type Line = z.infer<typeof LineSchema>;
export type Polyline = z.infer<typeof PolylineSchema>;
export type Polygon = z.infer<typeof PolygonSchema>;
export type Path = z.infer<typeof PathSchema>;
export type Image = z.infer<typeof ImageSchema>;
export type ShapeElement = z.infer<typeof ShapeElementSchema>;
