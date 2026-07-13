/**
 * Marker support: defs.markers presets, markerStart/Mid/End on line,
 * polyline and path, reference integrity, and the gradient-fill extension
 * of the text contrast audit.
 */

import { describe, it, expect } from "vitest";
import { SVGConfigSchema } from "../src/schemas/config.js";
import { renderSVG } from "../src/renderer/svg-renderer.js";
import { drainRenderWarnings } from "../src/renderer/utils.js";
import { checkReferences } from "../src/refcheck.js";
import { checkTextContrast } from "../src/eyes/audit.js";
import { analyzeConfig } from "../src/analysis.js";
import type { SVGConfig } from "../src/schemas/config.js";

function parse(config: unknown): SVGConfig {
  const result = SVGConfigSchema.safeParse(config);
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

const arrowDefs = {
  markers: [{ id: "head", shape: "triangle", color: "#334155" }],
};

describe("marker rendering", () => {
  it("emits a <marker> def with the preset glyph", () => {
    const svg = renderSVG(
      parse({
        canvas: { width: 200, height: 100 },
        defs: arrowDefs,
        elements: [
          { type: "line", x1: 10, y1: 50, x2: 180, y2: 50, stroke: "#334155", strokeWidth: 2, markerEnd: "head" },
        ],
      })
    );
    expect(svg).toContain('<marker id="head"');
    expect(svg).toContain('markerUnits="strokeWidth"');
    expect(svg).toContain('orient="auto"');
    expect(svg).toContain('d="M0,0 L10,5 L0,10 Z"');
    expect(svg).toContain('marker-end="url(#head)"');
  });

  it("normalizes url(#id) references instead of double-wrapping", () => {
    const svg = renderSVG(
      parse({
        canvas: { width: 200, height: 100 },
        defs: arrowDefs,
        elements: [
          { type: "line", x1: 0, y1: 0, x2: 100, y2: 0, stroke: "#000000", markerEnd: "url(#head)" },
        ],
      })
    );
    expect(svg).toContain('marker-end="url(#head)"');
    expect(svg).not.toContain("url(#url(");
  });

  it("supports markerMid on polyline and path", () => {
    const svg = renderSVG(
      parse({
        canvas: { width: 200, height: 200 },
        defs: { markers: [{ id: "dot", shape: "circle", color: "#111111" }] },
        elements: [
          { type: "polyline", points: "10,10 100,50 190,10", stroke: "#111111", fill: "none", markerMid: "dot" },
          { type: "path", d: "M10,100 L100,150 L190,100", stroke: "#111111", fill: "none", markerMid: "dot" },
        ],
      })
    );
    expect(svg.match(/marker-mid="url\(#dot\)"/g)).toHaveLength(2);
    expect(svg).toContain('<circle cx="5" cy="5" r="4"');
  });

  it("honors size and numeric orient", () => {
    const svg = renderSVG(
      parse({
        canvas: { width: 100, height: 100 },
        defs: { markers: [{ id: "m", shape: "diamond", size: 10, orient: 45 }] },
        elements: [
          { type: "line", x1: 0, y1: 0, x2: 50, y2: 50, stroke: "#000000", markerStart: "m" },
        ],
      })
    );
    expect(svg).toContain('markerWidth="10"');
    expect(svg).toContain('orient="45"');
    expect(svg).toContain('fill="#000000"'); // default color
  });

  it("rejects a non-hex marker color", () => {
    const result = SVGConfigSchema.safeParse({
      canvas: { width: 100, height: 100 },
      defs: { markers: [{ id: "m", shape: "arrow", color: "red" }] },
      elements: [{ type: "line", x1: 0, y1: 0, x2: 10, y2: 10, stroke: "#000000" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("marker edge cases", () => {
  it("warns that resvg renders auto-start-reverse unflipped (pixel-verified vs Chromium)", () => {
    drainRenderWarnings();
    renderSVG(
      parse({
        canvas: { width: 100, height: 100 },
        defs: { markers: [{ id: "rev", shape: "triangle", orient: "auto-start-reverse" }] },
        elements: [
          { type: "line", x1: 0, y1: 50, x2: 90, y2: 50, stroke: "#000000", strokeWidth: 2, markerStart: "rev" },
        ],
      })
    );
    const warnings = drainRenderWarnings();
    expect(warnings.some((w) => w.includes("auto-start-reverse"))).toBe(true);
  });

  it("flags markers on a strokeless line", () => {
    const config = parse({
      canvas: { width: 100, height: 100 },
      defs: arrowDefs,
      elements: [{ type: "line", x1: 0, y1: 0, x2: 50, y2: 0, markerEnd: "head" }],
    });
    const warnings = analyzeConfig(config, 500);
    expect(warnings.some((w) => w.includes("has markers but no stroke"))).toBe(true);

    const stroked = parse({
      canvas: { width: 100, height: 100 },
      defs: arrowDefs,
      elements: [{ type: "line", x1: 0, y1: 0, x2: 50, y2: 0, stroke: "#000000", markerEnd: "head" }],
    });
    expect(analyzeConfig(stroked, 500).some((w) => w.includes("markers"))).toBe(false);
  });
});

describe("marker reference integrity", () => {
  it("rejects a dangling marker reference with the field path", () => {
    const errors = checkReferences(
      parse({
        canvas: { width: 100, height: 100 },
        elements: [
          { type: "line", x1: 0, y1: 0, x2: 10, y2: 10, stroke: "#000000", markerEnd: "ghost" },
        ],
      })
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("elements.0.markerEnd");
    expect(errors[0]).toContain('"ghost"');
  });

  it("accepts a valid reference and flags duplicate marker ids", () => {
    const ok = checkReferences(
      parse({
        canvas: { width: 100, height: 100 },
        defs: arrowDefs,
        elements: [
          { type: "line", x1: 0, y1: 0, x2: 10, y2: 10, stroke: "#000000", markerEnd: "head" },
        ],
      })
    );
    expect(ok).toEqual([]);

    const dup = checkReferences(
      parse({
        canvas: { width: 100, height: 100 },
        defs: {
          markers: [
            { id: "head", shape: "triangle" },
            { id: "head", shape: "circle" },
          ],
        },
        elements: [{ type: "rect", width: 10, height: 10, fill: "#000000" }],
      })
    );
    expect(dup.some((e) => e.includes('Duplicate id "head"'))).toBe(true);
  });
});

describe("gradient text contrast", () => {
  const gradientDefs = {
    gradients: [
      {
        type: "linearGradient",
        id: "shine",
        stops: [
          { offset: 0, color: "#fafafa" },
          { offset: 1, color: "#d8d8d8" },
        ],
      },
    ],
  };

  it("reports the worst stop of a low-contrast gradient fill", () => {
    const warnings = checkTextContrast(
      parse({
        canvas: { width: 200, height: 100, background: "#f5f5f5" },
        defs: gradientDefs,
        elements: [
          { type: "text", x: 20, y: 50, content: "ghost title", fontSize: 16, fill: "url(#shine)" },
        ],
      })
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('gradient "shine"');
    expect(warnings[0]).toContain("#fafafa");
  });

  it("stays silent when every stop clears the threshold", () => {
    const warnings = checkTextContrast(
      parse({
        canvas: { width: 200, height: 100, background: "#111111" },
        defs: gradientDefs,
        elements: [
          { type: "text", x: 20, y: 50, content: "bright title", fontSize: 16, fill: "url(#shine)" },
        ],
      })
    );
    expect(warnings).toEqual([]);
  });
});
