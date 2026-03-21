/**
 * Schema validation tests.
 * Verify that Zod schemas accept valid configs and reject invalid ones.
 */

import { describe, it, expect } from "vitest";
import { SVGConfigSchema } from "../src/schemas/config.js";
import { ColorSchema, PaintSchema } from "../src/schemas/base.js";
import { GradientStopSchema } from "../src/schemas/gradients.js";
import { FilterPresetSchema } from "../src/schemas/filters.js";
import { CSSAnimationSchema } from "../src/schemas/animations.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Minimal valid config
// ---------------------------------------------------------------------------

const MINIMAL_CONFIG = {
  canvas: { width: 200, height: 100 },
  elements: [{ type: "rect", width: 50, height: 30 }],
};

describe("SVGConfigSchema — valid inputs", () => {
  it("accepts minimal config", () => {
    expect(() => SVGConfigSchema.parse(MINIMAL_CONFIG)).not.toThrow();
  });

  it("applies default x=0, y=0 to rect", () => {
    const config = SVGConfigSchema.parse(MINIMAL_CONFIG);
    const rect = config.elements[0] as z.infer<typeof SVGConfigSchema>["elements"][0];
    // x defaults to 0 after parsing
    expect((rect as { x?: number }).x).toBe(0);
  });

  it("accepts all shape types", () => {
    const shapes = [
      { type: "rect", width: 10, height: 10 },
      { type: "circle", cx: 50, cy: 50, r: 20 },
      { type: "ellipse", cx: 50, cy: 50, rx: 30, ry: 20 },
      { type: "line", x1: 0, y1: 0, x2: 50, y2: 50 },
      { type: "polyline", points: "0,0 50,50 100,0" },
      { type: "polygon", points: "50,10 90,90 10,90" },
      { type: "path", d: "M 0 0 L 100 100" },
    ];
    for (const shape of shapes) {
      expect(
        () => SVGConfigSchema.parse({ canvas: { width: 200, height: 200 }, elements: [shape] })
      ).not.toThrow();
    }
  });

  it("accepts text with string content", () => {
    expect(() =>
      SVGConfigSchema.parse({
        canvas: { width: 200, height: 100 },
        elements: [{ type: "text", x: 10, y: 50, content: "Hello" }],
      })
    ).not.toThrow();
  });

  it("accepts text with tspan array content", () => {
    expect(() =>
      SVGConfigSchema.parse({
        canvas: { width: 200, height: 100 },
        elements: [
          {
            type: "text",
            x: 10,
            y: 50,
            content: ["Hello ", { text: "world", fill: "#ff0000" }],
          },
        ],
      })
    ).not.toThrow();
  });

  it("accepts full defs config", () => {
    expect(() =>
      SVGConfigSchema.parse({
        canvas: { width: 400, height: 200 },
        defs: {
          gradients: [
            {
              type: "linearGradient",
              id: "g1",
              stops: [{ offset: 0, color: "#ff0000" }, { offset: 1, color: "#0000ff" }],
            },
          ],
          filters: [{ type: "preset", id: "f1", preset: "glow", stdDeviation: 5 }],
        },
        elements: [{ type: "rect", width: 400, height: 200, fill: "url(#g1)" }],
      })
    ).not.toThrow();
  });

  it("accepts group with children", () => {
    expect(() =>
      SVGConfigSchema.parse({
        canvas: { width: 200, height: 200 },
        elements: [
          {
            type: "group",
            children: [{ type: "circle", cx: 100, cy: 100, r: 40 }],
          },
        ],
      })
    ).not.toThrow();
  });

  it("accepts canvas with percentage width", () => {
    expect(() =>
      SVGConfigSchema.parse({
        canvas: { width: "100%", height: 200 },
        elements: [{ type: "rect", width: 100, height: 50 }],
      })
    ).not.toThrow();
  });
});

describe("SVGConfigSchema — invalid inputs", () => {
  it("rejects config with empty elements array", () => {
    expect(() =>
      SVGConfigSchema.parse({ canvas: { width: 200, height: 100 }, elements: [] })
    ).toThrow();
  });

  it("rejects config with missing canvas", () => {
    expect(() =>
      SVGConfigSchema.parse({ elements: [{ type: "rect", width: 50, height: 30 }] })
    ).toThrow();
  });

  it("rejects rect with zero width", () => {
    expect(() =>
      SVGConfigSchema.parse({
        canvas: { width: 200, height: 100 },
        elements: [{ type: "rect", width: 0, height: 50 }],
      })
    ).toThrow();
  });

  it("rejects circle with negative radius", () => {
    expect(() =>
      SVGConfigSchema.parse({
        canvas: { width: 200, height: 200 },
        elements: [{ type: "circle", cx: 100, cy: 100, r: -5 }],
      })
    ).toThrow();
  });

  it("rejects gradient with fewer than 2 stops", () => {
    expect(() =>
      SVGConfigSchema.parse({
        canvas: { width: 200, height: 200 },
        defs: {
          gradients: [
            { type: "linearGradient", id: "g1", stops: [{ offset: 0, color: "#ff0000" }] },
          ],
        },
        elements: [{ type: "rect", width: 100, height: 100 }],
      })
    ).toThrow();
  });
});

describe("ColorSchema", () => {
  it("accepts #rrggbb format", () => {
    expect(() => ColorSchema.parse("#ff0000")).not.toThrow();
    expect(() => ColorSchema.parse("#000000")).not.toThrow();
    expect(() => ColorSchema.parse("#ffffff")).not.toThrow();
    expect(() => ColorSchema.parse("#a1b2c3")).not.toThrow();
  });

  it("accepts #rrggbbaa format (with alpha)", () => {
    expect(() => ColorSchema.parse("#ff000080")).not.toThrow();
    expect(() => ColorSchema.parse("#00000000")).not.toThrow();
  });

  it("rejects named colors", () => {
    expect(() => ColorSchema.parse("red")).toThrow();
    expect(() => ColorSchema.parse("blue")).toThrow();
  });

  it("rejects rgb() format", () => {
    expect(() => ColorSchema.parse("rgb(255, 0, 0)")).toThrow();
  });

  it("rejects short hex", () => {
    expect(() => ColorSchema.parse("#f00")).toThrow();
  });
});

describe("PaintSchema", () => {
  it("accepts hex colors", () => {
    expect(() => PaintSchema.parse("#ff0000")).not.toThrow();
  });

  it("accepts none", () => {
    expect(() => PaintSchema.parse("none")).not.toThrow();
  });

  it("accepts url reference", () => {
    expect(() => PaintSchema.parse("url(#gradientId)")).not.toThrow();
  });
});

describe("CSSAnimationSchema", () => {
  it("rejects animation with fewer than 2 keyframes", () => {
    expect(() =>
      CSSAnimationSchema.parse({
        name: "test",
        duration: "1s",
        keyframes: [{ offset: 0, properties: { opacity: "1" } }],
      })
    ).toThrow();
  });

  it("accepts valid animation", () => {
    expect(() =>
      CSSAnimationSchema.parse({
        name: "fade",
        duration: "2s",
        iterationCount: "infinite",
        keyframes: [
          { offset: "from", properties: { opacity: "0" } },
          { offset: "to", properties: { opacity: "1" } },
        ],
      })
    ).not.toThrow();
  });
});

describe("FilterPresetSchema", () => {
  it("rejects unknown preset name", () => {
    expect(() =>
      FilterPresetSchema.parse({ type: "preset", id: "f1", preset: "invalid-preset" })
    ).toThrow();
  });

  it("accepts all valid preset names", () => {
    const presets = ["glow", "neon", "blur", "drop-shadow", "grayscale", "sepia", "invert", "saturate", "hue-rotate", "glitch"];
    for (const preset of presets) {
      expect(() => FilterPresetSchema.parse({ type: "preset", id: "f1", preset })).not.toThrow();
    }
  });
});

describe("GradientStopSchema", () => {
  it("accepts numeric offset 0-1", () => {
    expect(() => GradientStopSchema.parse({ offset: 0, color: "#ff0000" })).not.toThrow();
    expect(() => GradientStopSchema.parse({ offset: 0.5, color: "#00ff00" })).not.toThrow();
    expect(() => GradientStopSchema.parse({ offset: 1, color: "#0000ff" })).not.toThrow();
  });

  it("accepts string percentage offset", () => {
    expect(() => GradientStopSchema.parse({ offset: "0%", color: "#ff0000" })).not.toThrow();
    expect(() => GradientStopSchema.parse({ offset: "100%", color: "#0000ff" })).not.toThrow();
  });

  it("accepts optional opacity", () => {
    expect(() =>
      GradientStopSchema.parse({ offset: 0.5, color: "#ff0000", opacity: 0.7 })
    ).not.toThrow();
  });
});
