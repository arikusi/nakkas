/**
 * Slim schema for MCP tool registration.
 *
 * This produces a compact JSON Schema (under 2k tokens) that the AI client sees.
 * The full SVGConfigSchema is used in the handler for runtime validation.
 * AI models already know SVG; they don't need every field described in the schema.
 * Detailed docs live in llms.txt and llms-full.txt.
 *
 * IMPORTANT: every object here uses .passthrough(). The MCP SDK parses tool
 * arguments through this schema BEFORE the handler runs, and plain z.object()
 * strips unknown keys silently — valid fields like canvas.preserveAspectRatio
 * would vanish without any error before the full schema ever saw them. The
 * full SVGConfigSchema in the handler is the single validation authority;
 * this schema must let everything through untouched.
 */

import { z } from "zod";

export const SVGConfigSlimSchema = z.object({
  canvas: z.object({
    width: z.union([z.number(), z.string()]),
    height: z.union([z.number(), z.string()]),
    viewBox: z.string().optional(),
    background: z.string().optional(),
  }).passthrough(),

  defs: z.object({
    gradients: z.array(z.any()).optional(),
    filters: z.array(z.any()).optional(),
    clipPaths: z.array(z.any()).optional(),
    masks: z.array(z.any()).optional(),
    symbols: z.array(z.any()).optional(),
    paths: z.array(z.any()).optional(),
    patterns: z.array(z.any()).optional(),
  }).passthrough().optional(),

  elements: z.array(z.any()),

  animations: z.array(z.object({
    name: z.string(),
    duration: z.string(),
    keyframes: z.array(z.object({
      offset: z.union([z.number(), z.string()]),
      properties: z.record(z.string(), z.string()),
    }).passthrough()),
    timingFunction: z.string().optional(),
    iterationCount: z.union([z.number(), z.string()]).optional(),
    direction: z.string().optional(),
    fillMode: z.string().optional(),
    delay: z.string().optional(),
  }).passthrough()).optional(),

  output: z.object({
    svg: z.boolean().optional(),
    preview: z.boolean().optional(),
    previewWidth: z.number().optional(),
    minify: z.boolean().optional(),
    frames: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();
