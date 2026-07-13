/**
 * SVG marker definitions — arrowheads and line-end decorations.
 *
 * Preset-based like filters: the model picks a shape name and a color, the
 * renderer emits the <marker> geometry. Markers scale with the stroke width
 * of the line they decorate (markerUnits="strokeWidth").
 */

import { z } from "zod";
import { numeric } from "./base.js";

const HexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Marker color must be hex: #rrggbb or #rrggbbaa");

export const MarkerShapeSchema = z.enum([
  "triangle",
  "arrow",
  "circle",
  "square",
  "diamond",
  "bar",
]);

export const MarkerSchema = z.object({
  id: z.string().describe("Marker ID referenced by markerStart/markerMid/markerEnd"),
  shape: MarkerShapeSchema.describe(
    "Marker glyph: 'triangle' (solid arrowhead), 'arrow' (concave arrowhead), " +
      "'circle', 'square', 'diamond' (node dots), 'bar' (crossbar tick)."
  ),
  color: HexColorSchema.optional().describe(
    "Fill color as hex '#rrggbb'. Defaults to #000000; usually set to the line's stroke color."
  ),
  size: numeric(
    z
      .number()
      .positive()
      .optional()
      .describe(
        "Marker box size in stroke-width multiples (markerUnits='strokeWidth'). " +
          "Default 6: a 2px-wide line gets a 12px arrowhead."
      )
  ),
  orient: z
    .union([z.literal("auto"), z.literal("auto-start-reverse"), numeric(z.number())])
    .optional()
    .describe(
      "Rotation: 'auto' (default) follows the line direction, " +
        "'auto-start-reverse' flips start markers to point backward, or a fixed angle in degrees."
    ),
});

export type Marker = z.infer<typeof MarkerSchema>;
export type MarkerShape = z.infer<typeof MarkerShapeSchema>;
