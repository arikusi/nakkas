/**
 * Validation error reporting.
 *
 * The element union (AnyElementSchema) is a plain z.union: when an element
 * fails every branch, Zod reports the useless "Invalid input" and buries the
 * real field errors inside unionErrors. This module re-validates each failing
 * element against the schema branch selected by its `type` field, so the AI
 * gets "elements.1.content: Required" instead of "elements.1: Invalid input".
 */

import { z, ZodError, type ZodIssue } from "zod";
import { ShapeElementSchema } from "./schemas/shapes.js";
import { TextElementSchema } from "./schemas/text.js";
import { GroupSchema, UseSchema } from "./schemas/groups.js";
import {
  RadialGroupSchema,
  ArcGroupSchema,
  GridGroupSchema,
  ScatterGroupSchema,
  PathGroupSchema,
  ParametricSchema,
} from "./schemas/patterns.js";

const SHAPE_TYPES = ["rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "image"];

const ELEMENT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  ...Object.fromEntries(SHAPE_TYPES.map((t) => [t, ShapeElementSchema])),
  text: TextElementSchema,
  textPath: TextElementSchema,
  group: GroupSchema,
  use: UseSchema,
  "radial-group": RadialGroupSchema,
  "arc-group": ArcGroupSchema,
  "grid-group": GridGroupSchema,
  "scatter-group": ScatterGroupSchema,
  "path-group": PathGroupSchema,
  parametric: ParametricSchema,
};

/** Field cheat sheets appended when an element of that type fails validation. */
export const TYPE_HINTS: Record<string, string> = {
  text:
    'text fields: {type:"text", content:"..."} — the string goes in "content" (NOT "text"). ' +
    "Optional: x, y, fontSize, fontFamily, fontWeight, fontStyle, textAnchor, dominantBaseline, " +
    "letterSpacing, fill, stroke, opacity, cssClass. content can also be an array of strings and " +
    'tspan objects: ["Hello ", {text:"world", fill:"#ff0000"}]',
  textPath:
    'textPath fields: {type:"textPath", pathId:"idFromDefsPaths", text:"..."}. ' +
    "Optional: startOffset (number or '50%'), method, spacing, plus font fields.",
  group:
    'group fields: {type:"group", children:[...shapes/text/use]}. Nested groups are not allowed ' +
    "as children; place additional groups at the top level of elements[].",
  use: 'use fields: {type:"use", href:"#symbolOrElementId"}. Optional: x, y, width, height.',
  "radial-group":
    'radial-group fields: {type:"radial-group", cx, cy, radius, count, child:{...}}. ' +
    "child is ONE leaf element (shape/text/use) drawn at local origin (use cx=0, cy=0 in the child).",
  "arc-group":
    'arc-group fields: {type:"arc-group", cx, cy, radius, count, startAngle, endAngle, child:{...}}. ' +
    "child is ONE leaf element drawn at local origin.",
  "grid-group":
    'grid-group fields: {type:"grid-group", x, y, cols, rows, colSpacing, rowSpacing, child:{...}}. ' +
    "cols/rows are counts, colSpacing/rowSpacing are distances between cell centers.",
  "scatter-group":
    'scatter-group fields: {type:"scatter-group", x, y, width, height, count, seed, child:{...}}. ' +
    "seed is a required integer; same seed gives same positions.",
  "path-group":
    'path-group fields: {type:"path-group", waypoints, count, child}. ' +
    "waypoints is an array of x/y points, minimum 2; children are spread evenly along the polyline.",
  parametric:
    'parametric fields: {type:"parametric", fn:"rose|heart|lissajous|spiral|star|superformula|epitrochoid|hypotrochoid|wave", ' +
    "cx, cy, scale} plus per-fn params (rose: k; lissajous: freqA/freqB/delta; star: points/innerRadius; " +
    "spiro: R/r/d; spiral: turns/growth; wave: width/amplitude/frequency). Size is set via scale, not size.",
};

const VALID_TYPES = Object.keys(ELEMENT_SCHEMAS).join(", ");

function formatIssue(issue: ZodIssue, pathPrefix: (string | number)[]): string {
  const path = [...pathPrefix, ...issue.path];
  // Zod's default message for union mismatches is a bare "Invalid input",
  // which tells the caller nothing. The field reference below carries the details.
  const message =
    issue.code === "invalid_union"
      ? "value does not match any accepted form for this field"
      : issue.message;
  return `  • ${path.length ? path.join(".") : "(root)"}: ${message}`;
}

/**
 * Format a ZodError from SVGConfigSchema into field-level messages.
 * For "Invalid input" union failures on elements, drills into the branch
 * schema matching the element's `type` and reports its real field errors.
 * Returns the formatted error block plus any type hints that apply.
 */
export function explainConfigError(rawConfig: unknown, error: ZodError): string {
  const lines: string[] = [];
  const hints = new Set<string>();
  const explainedElements = new Set<number>();

  const config = rawConfig as { elements?: unknown[] } | null;

  for (const issue of error.errors) {
    const [head, index] = issue.path;
    const isElementUnionFailure =
      issue.code === "invalid_union" &&
      head === "elements" &&
      typeof index === "number" &&
      issue.path.length === 2;

    if (!isElementUnionFailure || !Array.isArray(config?.elements)) {
      lines.push(formatIssue(issue, []));
      continue;
    }

    if (explainedElements.has(index)) continue;
    explainedElements.add(index);

    const element = config.elements[index] as { type?: unknown } | null;
    const elType = typeof element?.type === "string" ? element.type : undefined;

    if (!elType) {
      lines.push(`  • elements.${index}: missing "type" field. Valid types: ${VALID_TYPES}`);
      continue;
    }

    const branchSchema = ELEMENT_SCHEMAS[elType];
    if (!branchSchema) {
      lines.push(`  • elements.${index}: unknown type "${elType}". Valid types: ${VALID_TYPES}`);
      continue;
    }

    const branchResult = branchSchema.safeParse(element);
    if (branchResult.success) {
      // Element is fine in isolation; the union failed for another reason.
      lines.push(formatIssue(issue, []));
      continue;
    }

    for (const branchIssue of branchResult.error.errors) {
      lines.push(formatIssue(branchIssue, ["elements", index]));
    }
    if (TYPE_HINTS[elType]) hints.add(TYPE_HINTS[elType]);
  }

  let out = lines.join("\n");
  if (hints.size > 0) {
    out += "\n\nField reference for the failing types:\n" + [...hints].map((h) => `- ${h}`).join("\n");
  }
  return out;
}
