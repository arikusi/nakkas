/**
 * SVG filter schemas.
 *
 * Two modes:
 * 1. Preset filters — AI picks a named preset with parameters. Renderer expands to primitives.
 *    Recommended for common effects (glow, blur, shadow, neon, glitch).
 *
 * 2. Raw filter primitives — full SVG filter primitive graph for custom effects.
 *    Each primitive has a 'result' name and 'in'/'in2' to chain effects.
 *
 * Usage: define filters in defs[], reference on elements as filter='url(#id)'.
 *
 * Filter region tip: the default filter region clips output to element bounds.
 * Use filterRegion to expand it for glow/shadow effects that spill outside.
 *
 * All filter primitives listed here are supported in modern SVG renderers.
 */

import { z } from "zod";
import { ColorSchema } from "./base.js";

// ---------------------------------------------------------------------------
// Preset filters — AI-friendly named effects
// ---------------------------------------------------------------------------

export const FilterPresetSchema = z.object({
  type: z.literal("preset"),
  id: z.string().describe("Unique ID referenced as filter='url(#id)' on elements."),
  preset: z
    .enum([
      "glow",                 // Soft colored halo around the element
      "neon",                 // Intense bright glow, like a neon sign
      "blur",                 // Simple Gaussian blur
      "drop-shadow",          // Offset shadow beneath the element
      "grayscale",            // Desaturate to black and white
      "sepia",                // Warm brownish vintage tone
      "invert",               // Invert all colors
      "saturate",             // Boost or reduce color saturation
      "hue-rotate",           // Shift all hue values by a fixed angle
      "glitch",               // Turbulence displacement with animated seed
      "chromatic-aberration", // RGB channel split for a lens distortion look
      "noise",                // Film grain texture overlay
      "outline",              // Colored outline drawn around the element
      "inner-shadow",         // Shadow rendered inside the element boundary
      "emboss",               // 3D relief effect using directional shading
    ])
    .describe("Named visual effect preset. The renderer expands this to the correct filter primitives."),

  color: ColorSchema.optional().describe(
    "Primary color parameter. " +
      "For glow and neon this is the halo color. " +
      "For drop-shadow this is the shadow color. " +
      "For outline this is the outline stroke color. " +
      "For inner-shadow this is the shadow fill color."
  ),

  stdDeviation: z
    .number()
    .min(0)
    .optional()
    .describe(
      "Blur radius in SVG units. " +
        "For glow and neon use 2 to 10 for subtle, 10 to 30 for dramatic. " +
        "For blur use 3 to 20. " +
        "For drop-shadow use 2 to 8. " +
        "For emboss this controls the depth of the shading. Default is 2."
    ),

  offsetX: z
    .number()
    .optional()
    .describe(
      "Horizontal offset in SVG units. Positive values move right. Used with drop-shadow."
    ),

  offsetY: z
    .number()
    .optional()
    .describe(
      "Vertical offset in SVG units. Positive values move down. Used with drop-shadow."
    ),

  value: z
    .number()
    .optional()
    .describe(
      "Intensity or size parameter whose meaning depends on the preset. " +
        "saturate: 0 is grayscale, 1 is normal, values above 1 boost saturation. " +
        "hue-rotate: rotation in degrees from 0 to 360. " +
        "grayscale and sepia: strength from 0 (no effect) to 1 (full effect). " +
        "chromatic-aberration: channel offset distance in SVG units, default 3. " +
        "noise: grain opacity from 0 to 1, default 0.25. " +
        "outline: outline thickness in SVG units, default 2. " +
        "inner-shadow: shadow opacity from 0 to 1, default 0.5. " +
        "emboss: shading intensity multiplier, default 1.5."
    ),

  expand: z
    .boolean()
    .optional()
    .describe(
      "Expand the filter region to prevent clipping of effects that extend beyond the element boundary. " +
        "Enables an origin of -50% with a size of 200%. " +
        "Defaults to true for glow, neon, drop-shadow and chromatic-aberration. " +
        "Set to false to override and use the tighter SVG spec default region."
    ),
});

// ---------------------------------------------------------------------------
// Raw filter primitives
// ---------------------------------------------------------------------------

/** Common fields shared by all filter primitives */
const FilterPrimitiveBase = {
  result: z
    .string()
    .optional()
    .describe("Name for this primitive's output. Other primitives reference it via 'in' or 'in2'."),
  in: z
    .string()
    .optional()
    .describe(
      "Input source. Built-in: 'SourceGraphic' (element), 'SourceAlpha' (element alpha), " +
      "'BackgroundImage', 'BackgroundAlpha', 'FillPaint', 'StrokePaint'. " +
      "Or: a 'result' name from a previous primitive."
    ),
  x: z.string().optional().describe("Primitive sub-region X offset: '0%' or pixel value"),
  y: z.string().optional().describe("Primitive sub-region Y offset"),
  width: z.string().optional().describe("Primitive sub-region width"),
  height: z.string().optional().describe("Primitive sub-region height"),
};

export const FeGaussianBlurSchema = z.object({
  primitive: z.literal("feGaussianBlur"),
  ...FilterPrimitiveBase,
  stdDeviation: z
    .union([z.number(), z.string()])
    .describe("Blur radius. Single number for uniform blur, 'x y' for different X/Y blur."),
  edgeMode: z
    .enum(["duplicate", "wrap", "none"])
    .optional()
    .describe("How edge pixels are handled. 'none' = no extension (creates sharp edge at filter boundary)"),
});

export const FeDropShadowSchema = z.object({
  primitive: z.literal("feDropShadow"),
  ...FilterPrimitiveBase,
  dx: z.number().optional().describe("Shadow X offset. Default: 2"),
  dy: z.number().optional().describe("Shadow Y offset. Default: 2"),
  stdDeviation: z.number().optional().describe("Shadow blur radius. Default: 2"),
  floodColor: z.string().optional().describe("Shadow color: hex '#rrggbb'. Default: '#000000'"),
  floodOpacity: z.number().min(0).max(1).optional().describe("Shadow opacity: 0–1. Default: 1"),
});

export const FeColorMatrixSchema = z.object({
  primitive: z.literal("feColorMatrix"),
  ...FilterPrimitiveBase,
  type: z
    .enum(["matrix", "saturate", "hueRotate", "luminanceToAlpha"])
    .describe(
      "'matrix': full 4x5 RGBA transform matrix (20 space-separated values). " +
      "'saturate': 0–1 desaturates, 1 = identity, >1 = oversaturate. " +
      "'hueRotate': rotate hue by degrees (0–360). " +
      "'luminanceToAlpha': convert brightness to alpha."
    ),
  values: z
    .string()
    .optional()
    .describe(
      "For 'matrix': 20 space-separated numbers (4 rows × 5 columns). " +
      "For 'saturate': single 0–3 number. " +
      "For 'hueRotate': degrees. " +
      "For 'luminanceToAlpha': no values needed."
    ),
});

export const FeTurbulenceSchema = z.object({
  primitive: z.literal("feTurbulence"),
  ...FilterPrimitiveBase,
  type: z
    .enum(["turbulence", "fractalNoise"])
    .optional()
    .describe(
      "'turbulence' (default): sharp edges, good for glitch/water distortion. " +
      "'fractalNoise': smoother, good for fog/cloud/texture."
    ),
  baseFrequency: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      "Noise frequency. Lower = larger features (0.01 = big blobs). Higher = finer grain (0.5 = noise). " +
      "Two values for X/Y: '0.05 0.1'"
    ),
  numOctaves: z
    .number()
    .int()
    .min(1)
    .max(8)
    .optional()
    .describe("Detail layers. 1–3 for performance, up to 8 for fine detail."),
  seed: z
    .number()
    .int()
    .optional()
    .describe("Random seed. Animate with SMIL calcMode='discrete' for glitch flicker effect."),
  stitchTiles: z
    .enum(["stitch", "noStitch"])
    .optional()
    .describe("'stitch': tiles seamlessly. 'noStitch': may have seam artifacts."),
});

export const FeDisplacementMapSchema = z.object({
  primitive: z.literal("feDisplacementMap"),
  ...FilterPrimitiveBase,
  in2: z.string().describe("Second input: the displacement map (usually a feTurbulence result)"),
  scale: z.number().describe("Displacement intensity. Larger = more distortion."),
  xChannelSelector: z
    .enum(["R", "G", "B", "A"])
    .optional()
    .describe("Which map channel drives X displacement. Default: 'A'"),
  yChannelSelector: z
    .enum(["R", "G", "B", "A"])
    .optional()
    .describe("Which map channel drives Y displacement. Default: 'A'"),
});

export const FeOffsetSchema = z.object({
  primitive: z.literal("feOffset"),
  ...FilterPrimitiveBase,
  dx: z.number().optional().describe("X offset in SVG user units"),
  dy: z.number().optional().describe("Y offset in SVG user units"),
});

export const FeFloodSchema = z.object({
  primitive: z.literal("feFlood"),
  ...FilterPrimitiveBase,
  floodColor: z.string().describe("Fill color: hex '#rrggbb'"),
  floodOpacity: z.number().min(0).max(1).optional().describe("Fill opacity: 0–1"),
});

export const FeCompositeSchema = z.object({
  primitive: z.literal("feComposite"),
  ...FilterPrimitiveBase,
  in2: z.string().describe("Second input image to composite"),
  operator: z
    .enum(["over", "in", "out", "atop", "xor", "arithmetic"])
    .describe(
      "'over' (default): in over in2. 'in': intersection. 'out': difference. " +
      "'arithmetic': k1*i1*i2 + k2*i1 + k3*i2 + k4."
    ),
  k1: z.number().optional().describe("Coefficient for arithmetic operator"),
  k2: z.number().optional().describe("Coefficient for arithmetic operator"),
  k3: z.number().optional().describe("Coefficient for arithmetic operator"),
  k4: z.number().optional().describe("Coefficient for arithmetic operator"),
});

export const FeBlendSchema = z.object({
  primitive: z.literal("feBlend"),
  ...FilterPrimitiveBase,
  in2: z.string().describe("Second layer to blend"),
  mode: z
    .enum(["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion"])
    .optional()
    .describe("Blend mode. 'screen' brightens (good for glow layers). 'multiply' darkens."),
});

export const FeMergeSchema = z.object({
  primitive: z.literal("feMerge"),
  ...FilterPrimitiveBase,
  nodes: z
    .array(z.string())
    .min(2)
    .describe(
      "List of result names to merge in order (bottom to top). " +
      "Example: ['blurResult', 'SourceGraphic'] — renders blur behind the original."
    ),
});

export const FeComponentTransferSchema = z.object({
  primitive: z.literal("feComponentTransfer"),
  ...FilterPrimitiveBase,
  funcR: z
    .object({
      type: z.enum(["identity", "linear", "gamma", "discrete", "table"]),
      slope: z.number().optional().describe("Linear: output = slope * input + intercept"),
      intercept: z.number().optional(),
      amplitude: z.number().optional().describe("Gamma: output = amplitude * input^exponent + offset"),
      exponent: z.number().optional(),
      offset: z.number().optional(),
      tableValues: z.string().optional().describe("Space-separated lookup table values"),
    })
    .optional()
    .describe("Red channel transfer function"),
  funcG: z
    .object({
      type: z.enum(["identity", "linear", "gamma", "discrete", "table"]),
      slope: z.number().optional(),
      intercept: z.number().optional(),
      amplitude: z.number().optional(),
      exponent: z.number().optional(),
      offset: z.number().optional(),
      tableValues: z.string().optional(),
    })
    .optional()
    .describe("Green channel transfer function"),
  funcB: z
    .object({
      type: z.enum(["identity", "linear", "gamma", "discrete", "table"]),
      slope: z.number().optional(),
      intercept: z.number().optional(),
      amplitude: z.number().optional(),
      exponent: z.number().optional(),
      offset: z.number().optional(),
      tableValues: z.string().optional(),
    })
    .optional()
    .describe("Blue channel transfer function"),
  funcA: z
    .object({
      type: z.enum(["identity", "linear", "gamma", "discrete", "table"]),
      slope: z.number().optional(),
      intercept: z.number().optional(),
      amplitude: z.number().optional(),
      exponent: z.number().optional(),
      offset: z.number().optional(),
      tableValues: z.string().optional(),
    })
    .optional()
    .describe("Alpha channel transfer function. slope > 1 boosts brightness for neon glow effect."),
});

// ---------------------------------------------------------------------------
// Filter primitive union
// ---------------------------------------------------------------------------

export const FilterPrimitiveSchema = z.discriminatedUnion("primitive", [
  FeGaussianBlurSchema,
  FeDropShadowSchema,
  FeColorMatrixSchema,
  FeTurbulenceSchema,
  FeDisplacementMapSchema,
  FeOffsetSchema,
  FeFloodSchema,
  FeCompositeSchema,
  FeBlendSchema,
  FeMergeSchema,
  FeComponentTransferSchema,
]);

// ---------------------------------------------------------------------------
// Raw filter — full primitive graph
// ---------------------------------------------------------------------------

export const FilterRawSchema = z.object({
  type: z.literal("raw"),
  id: z.string().describe("Unique ID — referenced as filter='url(#id)' on elements"),
  filterRegion: z
    .object({
      x: z.string().default("-50%").describe("Filter region X start. '-50%' for effects that overflow bounds."),
      y: z.string().default("-50%").describe("Filter region Y start"),
      width: z.string().default("200%").describe("Filter region width. '200%' gives full overflow room."),
      height: z.string().default("200%").describe("Filter region height"),
    })
    .optional()
    .describe(
      "Filter region bounding box. Expand beyond element bounds for glow/shadow effects. " +
      "Default SVG filter region is tight to the element and will clip overflow."
    ),
  primitives: z
    .array(FilterPrimitiveSchema)
    .min(1)
    .describe(
      "Filter primitive graph. Primitives are applied in order. " +
      "Connect them via 'result' (output name) and 'in' (input name). " +
      "Final primitive without a 'result' becomes the filter output."
    ),
});

// ---------------------------------------------------------------------------
// Filter union (preset or raw)
// ---------------------------------------------------------------------------

export const FilterSchema = z.discriminatedUnion("type", [
  FilterPresetSchema,
  FilterRawSchema,
]);

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export type FilterPreset = z.infer<typeof FilterPresetSchema>;
export type FilterRaw = z.infer<typeof FilterRawSchema>;
export type FilterPrimitive = z.infer<typeof FilterPrimitiveSchema>;
export type Filter = z.infer<typeof FilterSchema>;
