/**
 * Pattern and generative element schemas.
 *
 * Six element types for repetitive and mathematical designs:
 *
 * radial-group   Places N copies of one child around a full circle.
 * arc-group      Places N copies of one child along a circular arc.
 * grid-group     Places copies of one child in an M by N rectangular grid.
 * scatter-group  Places N copies at deterministic random positions using a seed.
 * path-group     Places N copies evenly along a polyline defined by waypoints.
 * parametric     Generates an SVG path from a mathematical curve function.
 */

import { z } from "zod";
import { BaseElementSchema } from "./base.js";
import { SMILAnimationSchema } from "./animations.js";
import { LeafElementSchema } from "./groups.js";

const smilAnimations = z
  .array(SMILAnimationSchema)
  .optional()
  .describe("SMIL animations attached to this element.");

// ---------------------------------------------------------------------------
// radial-group
// ---------------------------------------------------------------------------

export const RadialGroupSchema = BaseElementSchema.extend({
  type: z.literal("radial-group"),

  cx: z.number().describe("Center X coordinate of the circular arrangement."),

  cy: z.number().describe("Center Y coordinate of the circular arrangement."),

  count: z
    .number()
    .int()
    .min(2)
    .max(72)
    .describe(
      "Number of copies to place around the circle. " +
        "6 produces hexagonal spacing (60 degrees each). " +
        "8 produces octagonal spacing (45 degrees). " +
        "12 produces clock-face spacing (30 degrees)."
    ),

  radius: z
    .number()
    .positive()
    .describe(
      "Distance from center to the anchor point of each child, in SVG units."
    ),

  startAngle: z
    .number()
    .default(-90)
    .describe(
      "Angle in degrees for the first item. " +
        "Use -90 for top (12 o'clock position, default). " +
        "Use 0 for right (3 o'clock). " +
        "Use 90 for bottom."
    ),

  rotateChildren: z
    .boolean()
    .default(true)
    .describe(
      "When true (default), each child rotates to face outward from the center. " +
        "Petals and arrows point away from the center. " +
        "When false, all children keep the same orientation."
    ),

  child: LeafElementSchema.describe(
    "Template element placed at each position. " +
      "Coordinates are relative to the placement point at (0, 0). " +
      "Use cx=0, cy=0 for circles and ellipses. " +
      "Use x=0, y=0 for rects and text. " +
      "Example: {type: 'ellipse', cx: 0, cy: 0, rx: 40, ry: 12} creates an ellipse " +
      "centered at each radial position, facing outward when rotateChildren is true."
  ),

  smilAnimations,
});

// ---------------------------------------------------------------------------
// arc-group
// ---------------------------------------------------------------------------

export const ArcGroupSchema = BaseElementSchema.extend({
  type: z.literal("arc-group"),

  cx: z.number().describe("Center X coordinate of the arc."),

  cy: z.number().describe("Center Y coordinate of the arc."),

  radius: z
    .number()
    .positive()
    .describe("Distance from center to each child's anchor point, in SVG units."),

  count: z
    .number()
    .int()
    .min(1)
    .max(72)
    .describe(
      "Number of copies to place along the arc. " +
        "When count is 1, the child is placed at startAngle."
    ),

  startAngle: z
    .number()
    .describe(
      "Starting angle of the arc in degrees. " +
        "Use -90 for top (12 o'clock). " +
        "Use 0 for right (3 o'clock)."
    ),

  endAngle: z
    .number()
    .describe(
      "Ending angle of the arc in degrees. " +
        "Use startAngle + 360 to produce a full circle equivalent to radial-group. " +
        "Example: startAngle=0, endAngle=180 fills the bottom semicircle."
    ),

  rotateChildren: z
    .boolean()
    .default(true)
    .describe(
      "When true (default), each child rotates to face outward from the center. " +
        "When false, all children keep the same orientation."
    ),

  child: LeafElementSchema.describe(
    "Template element placed at each arc position. " +
      "Coordinates are relative to the placement point at (0, 0)."
  ),

  smilAnimations,
});

// ---------------------------------------------------------------------------
// grid-group
// ---------------------------------------------------------------------------

export const GridGroupSchema = BaseElementSchema.extend({
  type: z.literal("grid-group"),

  x: z
    .number()
    .default(0)
    .describe("X coordinate of the top-left cell anchor in SVG units."),

  y: z
    .number()
    .default(0)
    .describe("Y coordinate of the top-left cell anchor in SVG units."),

  cols: z
    .number()
    .int()
    .min(1)
    .max(200)
    .describe("Number of columns (horizontal count)."),

  rows: z
    .number()
    .int()
    .min(1)
    .max(200)
    .describe("Number of rows (vertical count)."),

  colSpacing: z
    .number()
    .positive()
    .describe("Horizontal distance between cell centers in SVG units."),

  rowSpacing: z
    .number()
    .positive()
    .describe("Vertical distance between cell centers in SVG units."),

  child: LeafElementSchema.describe(
    "Template element placed in every cell. " +
      "Coordinates are relative to the cell origin at (0, 0). " +
      "Example: {type: 'circle', cx: 0, cy: 0, r: 4} draws a circle at each grid position. " +
      "Example: {type: 'text', x: 0, y: 0, content: '0', textAnchor: 'middle'} places text at each cell."
  ),

  smilAnimations,
});

// ---------------------------------------------------------------------------
// scatter-group
// ---------------------------------------------------------------------------

export const ScatterGroupSchema = BaseElementSchema.extend({
  type: z.literal("scatter-group"),

  x: z
    .number()
    .default(0)
    .describe("Left edge of the bounding box in SVG units."),

  y: z
    .number()
    .default(0)
    .describe("Top edge of the bounding box in SVG units."),

  width: z
    .number()
    .positive()
    .describe("Width of the bounding box in SVG units."),

  height: z
    .number()
    .positive()
    .describe("Height of the bounding box in SVG units."),

  count: z
    .number()
    .int()
    .min(1)
    .max(500)
    .describe("Number of copies to scatter within the bounding box."),

  seed: z
    .number()
    .int()
    .describe(
      "Integer seed for the random number generator. " +
        "The same seed always produces the same positions. " +
        "Change the seed to get a different arrangement."
    ),

  child: LeafElementSchema.describe(
    "Template element placed at each scatter position. " +
      "Coordinates are relative to the placement point at (0, 0). " +
      "Use cx=0, cy=0 for circles and ellipses."
  ),

  smilAnimations,
});

// ---------------------------------------------------------------------------
// path-group
// ---------------------------------------------------------------------------

export const PathGroupSchema = BaseElementSchema.extend({
  type: z.literal("path-group"),

  waypoints: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .min(2)
    .describe(
      "Sequence of points defining the path. Minimum 2 points. " +
        "Children are distributed evenly along the polyline connecting these points. " +
        "Example: [{x: 50, y: 200}, {x: 200, y: 50}, {x: 350, y: 200}]"
    ),

  count: z
    .number()
    .int()
    .min(1)
    .max(200)
    .describe(
      "Number of copies to place along the path. " +
        "When count is 1, the child is placed at the start of the path."
    ),

  rotateChildren: z
    .boolean()
    .default(true)
    .describe(
      "When true (default), each child rotates to align with the path direction at that point. " +
        "When false, all children keep the same orientation."
    ),

  child: LeafElementSchema.describe(
    "Template element placed at each position along the path. " +
      "Coordinates are relative to the placement point at (0, 0)."
  ),

  smilAnimations,
});

// ---------------------------------------------------------------------------
// parametric
// ---------------------------------------------------------------------------

export const ParametricSchema = BaseElementSchema.extend({
  type: z.literal("parametric"),

  fn: z
    .enum([
      "rose",
      "lissajous",
      "spiral",
      "heart",
      "star",
      "superformula",
      "epitrochoid",
      "hypotrochoid",
      "wave",
    ])
    .describe(
      "Mathematical curve function to generate as an SVG path. " +
        "rose: rhodonea petal curves. " +
        "lissajous: harmonic oscillation figures. " +
        "spiral: archimedean or logarithmic spiral. " +
        "heart: classic heart shape. " +
        "star: regular star polygon. " +
        "superformula: Gielis formula that generalizes many natural shapes. " +
        "epitrochoid: outer spirograph curve. " +
        "hypotrochoid: inner spirograph curve. " +
        "wave: sine wave path."
    ),

  cx: z.number().default(0).describe("Center X of the generated shape."),

  cy: z.number().default(0).describe("Center Y of the generated shape."),

  scale: z
    .number()
    .positive()
    .optional()
    .describe(
      "Overall size in SVG units. " +
        "For rose this is the petal length from center. " +
        "For heart and star this is the outer radius. " +
        "For superformula this is the overall size. " +
        "Default is 80 for most shapes."
    ),

  // rose
  k: z
    .number()
    .optional()
    .describe(
      "rose: petal count multiplier. " +
        "k=3 produces 3 petals, k=4 produces 8 petals, k=5 produces 5 petals, k=7 produces 7 petals. " +
        "Even values of k produce 2k petals. Odd values produce k petals. " +
        "Fractional values such as 3/2 create complex multi-loop patterns. Default is 3."
    ),

  // lissajous
  freqA: z
    .number()
    .optional()
    .describe(
      "lissajous: X-axis frequency. " +
        "The ratio freqA to freqB determines shape complexity. " +
        "freqA=3 with freqB=2 gives a figure-8 shape. " +
        "freqA=3 with freqB=4 gives a complex knot. Default is 3."
    ),

  freqB: z
    .number()
    .optional()
    .describe("lissajous: Y-axis frequency. Default is 2."),

  delta: z
    .number()
    .optional()
    .describe(
      "lissajous: phase shift in radians between X and Y oscillations. " +
        "0 produces a degenerate diagonal line. " +
        "pi/4 gives an asymmetric shape. " +
        "pi/2 gives an ellipse-like shape (default)."
    ),

  scaleX: z
    .number()
    .positive()
    .optional()
    .describe(
      "lissajous: X amplitude in SVG units. Overrides the scale field for the X axis."
    ),

  scaleY: z
    .number()
    .positive()
    .optional()
    .describe(
      "lissajous: Y amplitude in SVG units. Overrides the scale field for the Y axis."
    ),

  // spiral
  spiralType: z
    .enum(["archimedean", "logarithmic"])
    .optional()
    .describe(
      "spiral: 'archimedean' produces evenly spaced rings like a watch spring (default). " +
        "'logarithmic' produces exponentially expanding rings like a nautilus shell."
    ),

  turns: z
    .number()
    .positive()
    .optional()
    .describe("spiral: number of full 360-degree rotations. Default is 3."),

  growth: z
    .number()
    .optional()
    .describe(
      "logarithmic spiral: growth rate. " +
        "Higher values produce a more open spiral. " +
        "Lower values produce a tighter coil. Default is 0.2."
    ),

  // star
  points: z
    .number()
    .int()
    .min(3)
    .max(20)
    .optional()
    .describe(
      "star: number of points. 5 gives a classic star. 6 gives a Star of David shape. Default is 5."
    ),

  innerRadius: z
    .number()
    .positive()
    .optional()
    .describe(
      "star: inner radius in SVG units controlling the indent between points. " +
        "Default is 40 percent of scale. Smaller values produce sharper, more pointed stars."
    ),

  // superformula
  m: z
    .number()
    .optional()
    .describe(
      "superformula: rotational symmetry controlling the number of lobes or sides. " +
        "m=4 gives a square-like shape, m=3 gives a triangle-like shape, m=8 gives an octagonal shape. Default is 4."
    ),

  n1: z
    .number()
    .optional()
    .describe(
      "superformula: primary exponent controlling overall convexity. " +
        "Values below 1 produce star-like pointy shapes. " +
        "Value of 1 produces a smooth circle-like shape. " +
        "Values above 1 produce rounded polygons. Default is 1."
    ),

  n2: z
    .number()
    .optional()
    .describe("superformula: secondary exponent. Default is 1."),

  n3: z
    .number()
    .optional()
    .describe("superformula: tertiary exponent. Default is 1."),

  // epitrochoid / hypotrochoid
  R: z
    .number()
    .positive()
    .optional()
    .describe(
      "epitrochoid and hypotrochoid: outer fixed circle radius. Default is 80."
    ),

  r: z
    .number()
    .positive()
    .optional()
    .describe(
      "epitrochoid and hypotrochoid: rolling circle radius. " +
        "The ratio R to r controls the number of loops. Default is 30."
    ),

  d: z
    .number()
    .positive()
    .optional()
    .describe(
      "epitrochoid and hypotrochoid: pen distance from the rolling circle center. " +
        "Values less than r produce inner loops. " +
        "Value equal to r produces a classic cycloid. " +
        "Values greater than r produce outer loops. Default is 50."
    ),

  // wave
  width: z
    .number()
    .positive()
    .optional()
    .describe(
      "wave: total horizontal span of the wave path in SVG units. Default is 400."
    ),

  amplitude: z
    .number()
    .optional()
    .describe(
      "wave: vertical height of each crest and trough in SVG units. Default is 30."
    ),

  frequency: z
    .number()
    .optional()
    .describe(
      "wave: number of complete wave cycles across the width. Default is 2."
    ),

  phase: z
    .number()
    .optional()
    .describe(
      "wave: phase shift in radians, shifting the wave horizontally. Default is 0."
    ),

  // general
  steps: z
    .number()
    .int()
    .min(10)
    .max(2000)
    .optional()
    .describe(
      "Number of path sample points. Higher values produce smoother curves but larger SVG output. " +
        "Default is 360 for rose, heart, star and superformula. " +
        "Default is 500 for lissajous, spiral, epitrochoid and hypotrochoid. " +
        "Default is 200 for wave. " +
        "When using path morphing animations, keep steps equal between source and target shapes."
    ),

  closed: z
    .boolean()
    .optional()
    .describe(
      "Whether to close the path with Z, connecting the last point back to the first. " +
        "Defaults to true for rose, heart, star, superformula, epitrochoid and hypotrochoid. " +
        "Defaults to false for spiral, lissajous and wave."
    ),

  smilAnimations,
});

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type RadialGroup = z.infer<typeof RadialGroupSchema>;
export type ArcGroup = z.infer<typeof ArcGroupSchema>;
export type GridGroup = z.infer<typeof GridGroupSchema>;
export type ScatterGroup = z.infer<typeof ScatterGroupSchema>;
export type PathGroup = z.infer<typeof PathGroupSchema>;
export type Parametric = z.infer<typeof ParametricSchema>;
