/**
 * Regression tests for the model-facing DX repairs (2026-07-07 audit):
 *
 * 1. TYPE_HINTS must only name fields that actually exist in the schemas —
 *    a cheat sheet with wrong field names steers the model into a second
 *    failure right after the first one.
 * 2. The slim registration schema must not strip keys the full schema
 *    accepts (the MCP SDK parses arguments through it BEFORE the handler).
 * 3. Numeric strings ("6", "2.5") must coerce on number fields — CSS habits
 *    produce them constantly.
 * 4. Blocked attribute values must surface as render warnings, not just
 *    stderr lines.
 * 5. Dangling url(#id) / use.href / textPath.pathId references and duplicate
 *    IDs must be caught before rendering.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { SVGConfigSchema } from "../src/schemas/config.js";
import { SVGConfigSlimSchema } from "../src/schemas/slim.js";
import { CanvasSchema } from "../src/schemas/canvas.js";
import { GridGroupSchema, ParametricSchema, ScatterGroupSchema, PathGroupSchema, ArcGroupSchema } from "../src/schemas/patterns.js";
import { TYPE_HINTS } from "../src/validation.js";
import { checkReferences } from "../src/refcheck.js";
import { renderSVG } from "../src/renderer/svg-renderer.js";
import { drainRenderWarnings } from "../src/renderer/utils.js";
import type { SVGConfig } from "../src/schemas/config.js";

// ---------------------------------------------------------------------------
// 1. TYPE_HINTS accuracy
// ---------------------------------------------------------------------------

/** Extract field-name candidates from the {...} part of a hint string. */
function shapeKeys(schema: z.ZodTypeAny): Set<string> {
  const obj = schema as unknown as { shape?: Record<string, unknown> };
  return new Set(Object.keys(obj.shape ?? {}));
}

describe("TYPE_HINTS name real schema fields", () => {
  it("grid-group hint uses colSpacing/rowSpacing (not spacingX/spacingY)", () => {
    const hint = TYPE_HINTS["grid-group"];
    const keys = shapeKeys(GridGroupSchema);
    expect(hint).toContain("colSpacing");
    expect(hint).toContain("rowSpacing");
    expect(hint).not.toContain("spacingX");
    expect(keys.has("colSpacing")).toBe(true);
    expect(keys.has("rowSpacing")).toBe(true);
  });

  it("parametric hint uses scale and freqA/freqB (not size/freqX)", () => {
    const hint = TYPE_HINTS["parametric"];
    const keys = shapeKeys(ParametricSchema);
    expect(hint).toContain("scale");
    expect(hint).toContain("freqA");
    expect(hint).not.toContain("freqX");
    expect(keys.has("scale")).toBe(true);
    expect(keys.has("freqA")).toBe(true);
    expect(keys.has("size")).toBe(false);
  });

  it("every field named in the {...} part of a hint exists in its schema", () => {
    const schemas: Record<string, z.ZodTypeAny> = {
      "grid-group": GridGroupSchema,
      "arc-group": ArcGroupSchema,
      "scatter-group": ScatterGroupSchema,
      "path-group": PathGroupSchema,
      parametric: ParametricSchema,
    };
    for (const [type, schema] of Object.entries(schemas)) {
      const hint = TYPE_HINTS[type];
      expect(hint, `missing hint for ${type}`).toBeTruthy();
      const braces = /\{([^}]*)\}/.exec(hint);
      expect(braces, `hint for ${type} has no {...} example`).toBeTruthy();
      const keys = shapeKeys(schema);
      const fields = braces![1]
        .split(",")
        .map((f) => f.split(":")[0].trim())
        .filter((f) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(f));
      for (const field of fields) {
        expect(keys.has(field), `hint for ${type} names "${field}" which is not in the schema`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Slim schema must not strip keys the full schema accepts
// ---------------------------------------------------------------------------

describe("slim schema passthrough", () => {
  it("keeps every canvas field the full CanvasSchema accepts", () => {
    const canvas = {
      width: 400,
      height: 300,
      viewBox: "0 0 400 300",
      preserveAspectRatio: "xMidYMid slice",
      background: "#ffffff",
      xmlns: "http://www.w3.org/2000/svg",
    };
    // sanity: full schema accepts all of these
    expect(CanvasSchema.safeParse(canvas).success).toBe(true);

    const parsed = SVGConfigSlimSchema.parse({ canvas, elements: [] });
    for (const key of Object.keys(canvas)) {
      expect(parsed.canvas, `slim parse dropped canvas.${key}`).toHaveProperty(key);
    }
  });

  it("keeps unknown-to-slim keys on animations and keyframes", () => {
    const parsed = SVGConfigSlimSchema.parse({
      canvas: { width: 10, height: 10 },
      elements: [],
      animations: [
        {
          name: "a",
          duration: "2s",
          keyframes: [{ offset: 0, properties: { opacity: "1" }, futureField: "x" }],
          futureField: "y",
        },
      ],
    });
    const anim = (parsed.animations as Array<Record<string, unknown>>)[0];
    expect(anim.futureField).toBe("y");
    expect((anim.keyframes as Array<Record<string, unknown>>)[0].futureField).toBe("x");
  });
});

// ---------------------------------------------------------------------------
// 3. Numeric string coercion
// ---------------------------------------------------------------------------

describe("numeric string coercion", () => {
  const base = { canvas: { width: 100, height: 100 } };

  it("accepts letterSpacing as a numeric string", () => {
    const result = SVGConfigSchema.safeParse({
      ...base,
      elements: [{ type: "text", content: "hi", letterSpacing: "6" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const el = result.data.elements[0] as { letterSpacing?: number };
      expect(el.letterSpacing).toBe(6);
    }
  });

  it("accepts strokeWidth, fontSize, opacity and coordinates as numeric strings", () => {
    const result = SVGConfigSchema.safeParse({
      ...base,
      elements: [
        { type: "circle", cx: "50", cy: "50", r: "40", strokeWidth: "2.5", opacity: "0.8", stroke: "#000000" },
        { type: "text", content: "t", fontSize: "42" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const circle = result.data.elements[0] as { r?: number; strokeWidth?: number; opacity?: number };
      expect(circle.r).toBe(40);
      expect(circle.strokeWidth).toBe(2.5);
      expect(circle.opacity).toBe(0.8);
    }
  });

  it("coerces integer-constrained fields like radial-group count", () => {
    const result = SVGConfigSchema.safeParse({
      ...base,
      elements: [
        {
          type: "radial-group",
          cx: 0,
          cy: 0,
          radius: "80",
          count: "12",
          child: { type: "circle", cx: 0, cy: 0, r: 3 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("still rejects non-numeric strings on number fields", () => {
    const result = SVGConfigSchema.safeParse({
      ...base,
      elements: [{ type: "circle", cx: 0, cy: 0, r: "big" }],
    });
    expect(result.success).toBe(false);
  });

  it("still enforces range constraints after coercion", () => {
    const result = SVGConfigSchema.safeParse({
      ...base,
      elements: [{ type: "circle", cx: 0, cy: 0, r: 5, opacity: "1.5" }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Blocked attributes surface as render warnings
// ---------------------------------------------------------------------------

describe("render warnings for blocked attributes", () => {
  it("reports a dropped javascript: href instead of failing silently", () => {
    const config = SVGConfigSchema.parse({
      canvas: { width: 100, height: 100 },
      elements: [
        { type: "image", x: 0, y: 0, width: 10, height: 10, href: "javascript:alert(1)" },
      ],
    });
    drainRenderWarnings();
    const svg = renderSVG(config as SVGConfig);
    const warnings = drainRenderWarnings();
    expect(svg).not.toContain("javascript:");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.join(" ")).toContain("OMITTED");
    expect(warnings.join(" ")).toContain("href");
  });

  it("collects nothing for a clean render", () => {
    const config = SVGConfigSchema.parse({
      canvas: { width: 100, height: 100 },
      elements: [{ type: "circle", cx: 50, cy: 50, r: 40, fill: "#ff0000" }],
    });
    drainRenderWarnings();
    renderSVG(config as SVGConfig);
    expect(drainRenderWarnings()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. ID and reference integrity
// ---------------------------------------------------------------------------

describe("checkReferences", () => {
  const canvas = { width: 100, height: 100 };

  function parse(raw: unknown): SVGConfig {
    return SVGConfigSchema.parse(raw) as SVGConfig;
  }

  it("passes a sound config", () => {
    const config = parse({
      canvas,
      defs: {
        gradients: [
          {
            type: "linearGradient",
            id: "g1",
            stops: [
              { offset: 0, color: "#000000" },
              { offset: 1, color: "#ffffff" },
            ],
          },
        ],
      },
      elements: [{ type: "rect", x: 0, y: 0, width: 10, height: 10, fill: "url(#g1)" }],
    });
    expect(checkReferences(config)).toEqual([]);
  });

  it("catches a dangling fill url reference", () => {
    const config = parse({
      canvas,
      elements: [{ type: "rect", x: 0, y: 0, width: 10, height: 10, fill: "url(#missing)" }],
    });
    const errors = checkReferences(config);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("elements.0.fill");
    expect(errors[0]).toContain("missing");
  });

  it("catches dangling filter, clipPath and mask references", () => {
    const config = parse({
      canvas,
      elements: [
        {
          type: "rect",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          filter: "url(#noFilter)",
          clipPath: "url(#noClip)",
          mask: "url(#noMask)",
        },
      ],
    });
    const errors = checkReferences(config);
    expect(errors.some((e) => e.includes("elements.0.filter"))).toBe(true);
    expect(errors.some((e) => e.includes("elements.0.clipPath"))).toBe(true);
    expect(errors.some((e) => e.includes("elements.0.mask"))).toBe(true);
  });

  it("catches a dangling use.href and textPath.pathId", () => {
    const config = parse({
      canvas,
      elements: [
        { type: "use", href: "#ghost" },
        { type: "textPath", pathId: "noPath", text: "hi" },
      ],
    });
    const errors = checkReferences(config);
    expect(errors.some((e) => e.includes("elements.0.href") && e.includes("ghost"))).toBe(true);
    expect(errors.some((e) => e.includes("elements.1.pathId") && e.includes("noPath"))).toBe(true);
  });

  it("accepts use.href pointing at a symbol or an element id", () => {
    const config = parse({
      canvas,
      defs: {
        symbols: [
          { id: "sym", children: [{ type: "circle", cx: 0, cy: 0, r: 5 }] },
        ],
      },
      elements: [
        { type: "circle", id: "dot", cx: 10, cy: 10, r: 2 },
        { type: "use", href: "#sym" },
        { type: "use", href: "#dot" },
      ],
    });
    expect(checkReferences(config)).toEqual([]);
  });

  it("catches duplicate IDs across defs and elements", () => {
    const config = parse({
      canvas,
      defs: {
        gradients: [
          {
            type: "linearGradient",
            id: "dup",
            stops: [
              { offset: 0, color: "#000000" },
              { offset: 1, color: "#ffffff" },
            ],
          },
        ],
      },
      elements: [{ type: "rect", id: "dup", x: 0, y: 0, width: 5, height: 5 }],
    });
    const errors = checkReferences(config);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Duplicate id "dup"');
  });

  it("catches a dangling gradient href", () => {
    const config = parse({
      canvas,
      defs: {
        gradients: [
          {
            type: "linearGradient",
            id: "g1",
            href: "#base",
            stops: [
              { offset: 0, color: "#000000" },
              { offset: 1, color: "#ffffff" },
            ],
          },
        ],
      },
      elements: [{ type: "rect", x: 0, y: 0, width: 5, height: 5, fill: "url(#g1)" }],
    });
    const errors = checkReferences(config);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("defs.gradients.0.href");
  });

  it("checks references inside group children and pattern-group child", () => {
    const config = parse({
      canvas,
      elements: [
        {
          type: "group",
          children: [{ type: "circle", cx: 0, cy: 0, r: 5, fill: "url(#nope)" }],
        },
        {
          type: "radial-group",
          cx: 0,
          cy: 0,
          radius: 20,
          count: 4,
          child: { type: "circle", cx: 0, cy: 0, r: 2, fill: "url(#alsoNope)" },
        },
      ],
    });
    const errors = checkReferences(config);
    expect(errors.some((e) => e.includes("elements.0.children.0.fill"))).toBe(true);
    expect(errors.some((e) => e.includes("elements.1.child.0.fill"))).toBe(true);
  });
});
