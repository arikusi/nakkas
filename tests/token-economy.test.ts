/**
 * Regression tests for the token-economy layer (v0.2.0):
 *
 *   1. Artifact store — render results held server-side, addressed by id
 *   2. minifySVG — whitespace collapse without breaking the document
 *   3. <use>-based pattern group output — child defined once, instanced N times
 *   4. output options — schema acceptance, coercion, slim passthrough
 *   5. Parametric path data precision capped at 2 decimals
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SVGConfigSchema } from "../src/schemas/config.js";
import { SVGConfigSlimSchema } from "../src/schemas/slim.js";
import { renderSVG } from "../src/renderer/svg-renderer.js";
import { minifySVG } from "../src/renderer/utils.js";
import { svgToPng } from "../src/preview.js";
import {
  storeArtifact,
  getArtifact,
  listArtifactIds,
  clearArtifacts,
} from "../src/artifacts.js";

function c(raw: Parameters<typeof SVGConfigSchema.parse>[0]) {
  return SVGConfigSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Artifact store
// ---------------------------------------------------------------------------

describe("artifact store", () => {
  beforeEach(() => clearArtifacts());

  it("stores and retrieves by id", () => {
    const id = storeArtifact("<svg>a</svg>");
    expect(id).toBe("art-1");
    expect(getArtifact(id)).toBe("<svg>a</svg>");
  });

  it("returns undefined for unknown ids", () => {
    expect(getArtifact("art-99")).toBeUndefined();
  });

  it("issues sequential ids", () => {
    const a = storeArtifact("one");
    const b = storeArtifact("two");
    expect(a).toBe("art-1");
    expect(b).toBe("art-2");
    expect(listArtifactIds()).toEqual(["art-1", "art-2"]);
  });

  it("evicts oldest beyond the cap, keeps newest", () => {
    for (let i = 0; i < 40; i++) storeArtifact(`svg-${i}`);
    const ids = listArtifactIds();
    expect(ids.length).toBe(32);
    expect(ids[0]).toBe("art-9"); // 1..8 evicted
    expect(getArtifact("art-1")).toBeUndefined();
    expect(getArtifact("art-40")).toBe("svg-39");
  });
});

// ---------------------------------------------------------------------------
// minifySVG
// ---------------------------------------------------------------------------

describe("minifySVG", () => {
  const config = c({
    canvas: { width: 200, height: 200, background: "#ffffff" },
    elements: [
      { type: "circle", cx: 100, cy: 100, r: 50, fill: "#ff0000" },
      { type: "text", x: 100, y: 100, content: "hello world", fontSize: 14 },
    ],
    animations: [
      {
        name: "spin",
        duration: "2s",
        keyframes: [
          { offset: 0, properties: { transform: "rotate(0deg)" } },
          { offset: 100, properties: { transform: "rotate(360deg)" } },
        ],
      },
    ],
  });

  it("removes inter-tag newlines and indentation", () => {
    const pretty = renderSVG(config);
    const mini = minifySVG(pretty);
    expect(mini.length).toBeLessThan(pretty.length);
    expect(mini).not.toMatch(/>\s*\n\s*</);
    expect(mini).not.toContain("\n");
  });

  it("preserves text content and structure", () => {
    const mini = minifySVG(renderSVG(config));
    expect(mini).toContain("hello world");
    expect(mini).toMatch(/^<svg /);
    expect(mini).toMatch(/<\/svg>$/);
    expect(mini).toContain("@keyframes");
  });

  it("minified output still rasterizes", () => {
    const png = svgToPng(minifySVG(renderSVG(config)));
    expect(png.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
  });

  it("does not add spaces inside attribute values", () => {
    const mini = minifySVG(renderSVG(config));
    expect(mini).toContain('fill="#ff0000"');
    expect(mini).toContain('cx="100"');
  });
});

// ---------------------------------------------------------------------------
// <use>-based pattern group output
// ---------------------------------------------------------------------------

describe("pattern groups render child once and instance with <use>", () => {
  it("radial-group: one child definition, count <use> tags", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "radial-group",
            cx: 200,
            cy: 200,
            count: 8,
            radius: 80,
            child: { type: "circle", cx: 0, cy: 0, r: 10, fill: "#ff0000" },
          },
        ],
      })
    );
    // The circle markup appears exactly once (inside the local defs)
    expect(svg.match(/<circle/g)!.length).toBe(1);
    // Instanced 8 times via <use>
    expect(svg.match(/<use href="#nkp1"/g)!.length).toBe(8);
    expect(svg).toContain('id="nkp1"');
  });

  it("grid-group: cols x rows <use> tags, one child def", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "grid-group",
            x: 10,
            y: 10,
            cols: 4,
            rows: 3,
            colSpacing: 20,
            rowSpacing: 20,
            child: { type: "rect", x: -5, y: -5, width: 10, height: 10, fill: "#00ff00" },
          },
        ],
      })
    );
    expect(svg.match(/<rect[^/]*fill="#00ff00"/g)!.length).toBe(1);
    expect(svg.match(/<use href="#nkp1"/g)!.length).toBe(12);
  });

  it("each <use> carries its own placement transform", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 300, height: 300 },
        elements: [
          {
            type: "grid-group",
            x: 10,
            y: 10,
            cols: 3,
            rows: 1,
            colSpacing: 25,
            rowSpacing: 25,
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
        ],
      })
    );
    expect(svg).toContain('<use href="#nkp1" transform="translate(10, 10)"/>');
    expect(svg).toContain('<use href="#nkp1" transform="translate(35, 10)"/>');
    expect(svg).toContain('<use href="#nkp1" transform="translate(60, 10)"/>');
  });

  it("multiple pattern groups in one config get distinct def ids", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "radial-group",
            cx: 100, cy: 100, count: 4, radius: 40,
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
          {
            type: "radial-group",
            cx: 300, cy: 300, count: 4, radius: 40,
            child: { type: "rect", x: -3, y: -3, width: 6, height: 6 },
          },
        ],
      })
    );
    expect(svg).toContain('id="nkp1"');
    expect(svg).toContain('id="nkp2"');
    expect(svg.match(/<use href="#nkp1"/g)!.length).toBe(4);
    expect(svg.match(/<use href="#nkp2"/g)!.length).toBe(4);
  });

  it("def id sequence resets per render — same config, same output", () => {
    const cfg = {
      canvas: { width: 200, height: 200 },
      elements: [
        {
          type: "radial-group" as const,
          cx: 100, cy: 100, count: 5, radius: 50,
          child: { type: "circle" as const, cx: 0, cy: 0, r: 4 },
        },
      ],
    };
    const a = renderSVG(c(cfg));
    const b = renderSVG(c(cfg));
    expect(a).toBe(b);
    expect(b).toContain('id="nkp1"');
  });

  it("instanced output rasterizes correctly", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        elements: [
          {
            type: "radial-group",
            cx: 100, cy: 100, count: 6, radius: 60,
            child: { type: "circle", cx: 0, cy: 0, r: 8, fill: "#0000ff" },
          },
        ],
      })
    );
    const png = svgToPng(svg);
    expect(png.length).toBeGreaterThan(200); // non-blank raster
  });

  it("shrinks output for a heavy grid versus duplicated children", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 800, height: 800 },
        elements: [
          {
            type: "grid-group",
            x: 20, y: 20, cols: 12, rows: 12, colSpacing: 60, rowSpacing: 60,
            child: {
              type: "rect",
              x: -20, y: -20, width: 40, height: 40, rx: 6,
              fill: "#334455", stroke: "#aabbcc", strokeWidth: 2, opacity: 0.8,
            },
          },
        ],
      })
    );
    // 144 duplicated rects with those attrs would be ~144 * ~100 chars; the
    // instanced form must land far below that.
    expect(svg.length).toBeLessThan(144 * 100);
    expect(svg.match(/<use /g)!.length).toBe(144);
    expect(svg.match(/<rect/g)!.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// output options schema
// ---------------------------------------------------------------------------

describe("output options", () => {
  it("full schema accepts the output key", () => {
    const parsed = SVGConfigSchema.parse({
      canvas: { width: 100, height: 100 },
      elements: [{ type: "circle", cx: 50, cy: 50, r: 20 }],
      output: { svg: true, preview: false, previewWidth: 640, minify: true },
    });
    expect(parsed.output).toEqual({ svg: true, preview: false, previewWidth: 640, minify: true });
  });

  it("coerces numeric string previewWidth", () => {
    const parsed = SVGConfigSchema.parse({
      canvas: { width: 100, height: 100 },
      elements: [{ type: "circle", cx: 50, cy: 50, r: 20 }],
      output: { previewWidth: "800" },
    });
    expect(parsed.output?.previewWidth).toBe(800);
  });

  it("rejects non-positive previewWidth", () => {
    const result = SVGConfigSchema.safeParse({
      canvas: { width: 100, height: 100 },
      elements: [{ type: "circle", cx: 50, cy: 50, r: 20 }],
      output: { previewWidth: -100 },
    });
    expect(result.success).toBe(false);
  });

  it("slim schema passes output through to the handler", () => {
    const parsed = SVGConfigSlimSchema.parse({
      canvas: { width: 100, height: 100 },
      elements: [{ type: "circle", cx: 50, cy: 50, r: 20 }],
      output: { svg: true, minify: true, futureOption: "kept" },
    });
    expect((parsed.output as Record<string, unknown>).svg).toBe(true);
    expect((parsed.output as Record<string, unknown>).futureOption).toBe("kept");
  });
});

// ---------------------------------------------------------------------------
// Parametric precision
// ---------------------------------------------------------------------------

describe("parametric path data precision", () => {
  it("caps coordinates at 2 decimals", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "parametric",
            fn: "rose",
            cx: 200, cy: 200, k: 5, scale: 150,
            fill: "none", stroke: "#cc0066", strokeWidth: 2,
          },
        ],
      })
    );
    const d = svg.match(/d="([^"]+)"/)![1];
    const coords = d.match(/-?\d+\.\d+/g) ?? [];
    expect(coords.length).toBeGreaterThan(10);
    for (const coord of coords) {
      const decimals = coord.split(".")[1];
      expect(decimals.length).toBeLessThanOrEqual(2);
    }
  });
});
