/**
 * SVG canvas / root element configuration.
 *
 * Defines the SVG viewport: coordinate system, dimensions, background.
 * The viewBox establishes the internal coordinate space that all element
 * coordinates are relative to.
 */

import { z } from "zod";

export const CanvasSchema = z.object({
  width: z
    .union([z.number().positive(), z.string()])
    .describe(
      "SVG element width. Number = pixels: 400. String = CSS value: '100%'. " +
      "Use a fixed pixel value (e.g. 800) for predictable layout in static contexts."
    ),
  height: z
    .union([z.number().positive(), z.string()])
    .describe("SVG element height. Match aspect ratio with viewBox for responsive scaling."),
  viewBox: z
    .string()
    .optional()
    .describe(
      "Internal coordinate system: 'minX minY width height'. Example: '0 0 400 300'. " +
      "When viewBox matches width/height, 1 SVG unit = 1 pixel. " +
      "Omit to use pixel coordinates directly (viewBox defaults to 0 0 width height)."
    ),
  preserveAspectRatio: z
    .string()
    .optional()
    .describe(
      "How to scale when container aspect ratio differs from viewBox. " +
      "'xMidYMid meet' (default): letterbox, centered. " +
      "'xMidYMid slice': fill, may crop. " +
      "'none': stretch to fill. " +
      "Format: '{align} {meetOrSlice}' — align is xMin/xMid/xMax combined with YMin/YMid/YMax."
    ),
  background: z
    .string()
    .optional()
    .describe(
      "Canvas background color (hex '#rrggbb') or 'transparent'. " +
      "'transparent' adapts to dark/light mode in any context that supports it. " +
      "Rendered as a full-canvas <rect> behind all other elements."
    ),
  xmlns: z
    .string()
    .optional()
    .default("http://www.w3.org/2000/svg")
    .describe("SVG namespace. Default: 'http://www.w3.org/2000/svg'. Omit to use default."),
});

export type Canvas = z.infer<typeof CanvasSchema>;
