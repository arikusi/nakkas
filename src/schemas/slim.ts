/**
 * Slim schema for MCP tool registration.
 *
 * This produces a compact JSON Schema (under 2k tokens) that the AI client sees.
 * The full SVGConfigSchema is used in the handler for runtime validation.
 * AI models already know SVG; they don't need every field described in the schema.
 * Detailed docs live in llms.txt and llms-full.txt.
 */

import { z } from "zod";

export const SVGConfigSlimSchema = z.object({
  canvas: z.object({
    width: z.union([z.number(), z.string()]),
    height: z.union([z.number(), z.string()]),
    viewBox: z.string().optional(),
    background: z.string().optional(),
  }),

  defs: z.object({
    gradients: z.array(z.any()).optional(),
    filters: z.array(z.any()).optional(),
    clipPaths: z.array(z.any()).optional(),
    masks: z.array(z.any()).optional(),
    symbols: z.array(z.any()).optional(),
    paths: z.array(z.any()).optional(),
    patterns: z.array(z.any()).optional(),
  }).optional(),

  elements: z.array(z.any()).min(1),

  animations: z.array(z.object({
    name: z.string(),
    duration: z.string(),
    keyframes: z.array(z.object({
      offset: z.union([z.number(), z.string()]),
      properties: z.record(z.string(), z.string()),
    })).min(2),
    timingFunction: z.string().optional(),
    iterationCount: z.union([z.number(), z.string()]).optional(),
    direction: z.string().optional(),
    fillMode: z.string().optional(),
    delay: z.string().optional(),
  })).optional(),
});
