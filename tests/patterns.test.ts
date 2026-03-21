/**
 * Tests for pattern element renderers:
 * radial-group, arc-group, grid-group, scatter-group, path-group, and SVG pattern defs.
 */

import { describe, it, expect } from "vitest";
import { SVGConfigSchema } from "../src/schemas/config.js";
import { renderSVG } from "../src/renderer/svg-renderer.js";

function c(raw: Parameters<typeof SVGConfigSchema.parse>[0]) {
  return SVGConfigSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// radial-group
// ---------------------------------------------------------------------------

describe("radial-group — basic rendering", () => {
  it("renders a valid SVG containing a <g> wrapper", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "radial-group",
            cx: 200,
            cy: 200,
            count: 6,
            radius: 80,
            child: { type: "circle", cx: 0, cy: 0, r: 10, fill: "#ff0000" },
          },
        ],
      })
    );
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("<g");
  });

  it("generates exactly count child <g> wrappers", () => {
    const count = 6;
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "radial-group",
            cx: 200,
            cy: 200,
            count,
            radius: 80,
            child: { type: "circle", cx: 0, cy: 0, r: 10 },
          },
        ],
      })
    );
    // Each child is wrapped in <g transform="...">; count the translate transforms
    const matches = svg.match(/translate\(/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(count);
  });

  it("places first item at top when startAngle=-90 (default)", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "radial-group",
            cx: 200,
            cy: 200,
            count: 4,
            radius: 80,
            // startAngle defaults to -90 (top)
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
        ],
      })
    );
    // First item at angle -90°: x=200+80*cos(-π/2)=200, y=200+80*sin(-π/2)=120
    expect(svg).toContain("translate(200, 120)");
  });

  it("includes rotate() in transform when rotateChildren=true (default)", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "radial-group",
            cx: 200,
            cy: 200,
            count: 4,
            radius: 60,
            rotateChildren: true,
            child: { type: "ellipse", cx: 0, cy: 0, rx: 20, ry: 8 },
          },
        ],
      })
    );
    expect(svg).toMatch(/translate\([^)]+\) rotate\(/);
  });

  it("omits rotate() in transform when rotateChildren=false", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "radial-group",
            cx: 200,
            cy: 200,
            count: 4,
            radius: 60,
            rotateChildren: false,
            child: { type: "circle", cx: 0, cy: 0, r: 8 },
          },
        ],
      })
    );
    // Has translate but no rotate
    expect(svg).toContain("translate(");
    expect(svg).not.toMatch(/rotate\(/);
  });

  it("works with a text child", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "radial-group",
            cx: 200,
            cy: 200,
            count: 8,
            radius: 70,
            child: { type: "text", content: "●", x: 0, y: 0, fontSize: 12 },
          },
        ],
      })
    );
    expect(svg).toContain("<text");
    // 8 translate wrappers
    const t = svg.match(/translate\(/g);
    expect(t).not.toBeNull();
    expect(t!.length).toBe(8);
  });

  it("applies base presentation attributes to the outer group", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "radial-group",
            cx: 200,
            cy: 200,
            count: 3,
            radius: 60,
            opacity: 0.5,
            child: { type: "circle", cx: 0, cy: 0, r: 10 },
          },
        ],
      })
    );
    expect(svg).toContain('opacity="0.5"');
  });

  it("renders with count=2 (minimum)", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        elements: [
          {
            type: "radial-group",
            cx: 100,
            cy: 100,
            count: 2,
            radius: 40,
            child: { type: "rect", x: -5, y: -5, width: 10, height: 10 },
          },
        ],
      })
    );
    const t = svg.match(/translate\(/g);
    expect(t).not.toBeNull();
    expect(t!.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// grid-group
// ---------------------------------------------------------------------------

describe("grid-group — basic rendering", () => {
  it("renders a valid SVG", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 300, height: 300 },
        elements: [
          {
            type: "grid-group",
            x: 20,
            y: 20,
            cols: 3,
            rows: 3,
            colSpacing: 30,
            rowSpacing: 30,
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
        ],
      })
    );
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("<g");
  });

  it("generates cols × rows child wrappers", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 300, height: 300 },
        elements: [
          {
            type: "grid-group",
            x: 10,
            y: 10,
            cols: 4,
            rows: 3,
            colSpacing: 20,
            rowSpacing: 20,
            child: { type: "circle", cx: 0, cy: 0, r: 4 },
          },
        ],
      })
    );
    const t = svg.match(/translate\(/g);
    expect(t).not.toBeNull();
    expect(t!.length).toBe(12); // 4 × 3
  });

  it("places top-left cell at (x, y)", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 300, height: 300 },
        elements: [
          {
            type: "grid-group",
            x: 50,
            y: 75,
            cols: 2,
            rows: 2,
            colSpacing: 30,
            rowSpacing: 40,
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
        ],
      })
    );
    // First cell: translate(50, 75)
    expect(svg).toContain("translate(50, 75)");
  });

  it("spaces cells correctly using colSpacing and rowSpacing", () => {
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
    // Col 0: translate(10, 10), Col 1: translate(35, 10), Col 2: translate(60, 10)
    expect(svg).toContain("translate(10, 10)");
    expect(svg).toContain("translate(35, 10)");
    expect(svg).toContain("translate(60, 10)");
  });

  it("works with a text child", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 300, height: 300 },
        elements: [
          {
            type: "grid-group",
            x: 20,
            y: 20,
            cols: 2,
            rows: 2,
            colSpacing: 24,
            rowSpacing: 28,
            child: {
              type: "text",
              content: "0",
              x: 0,
              y: 0,
              textAnchor: "middle",
              dominantBaseline: "central",
              fontSize: 14,
            },
          },
        ],
      })
    );
    expect(svg).toContain("<text");
    const t = svg.match(/translate\(/g);
    expect(t).not.toBeNull();
    expect(t!.length).toBe(4);
  });

  it("works with 1×1 grid", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 100, height: 100 },
        elements: [
          {
            type: "grid-group",
            x: 50,
            y: 50,
            cols: 1,
            rows: 1,
            colSpacing: 20,
            rowSpacing: 20,
            child: { type: "circle", cx: 0, cy: 0, r: 8 },
          },
        ],
      })
    );
    expect(svg).toContain("translate(50, 50)");
    const t = svg.match(/translate\(/g);
    expect(t).not.toBeNull();
    expect(t!.length).toBe(1);
  });

  it("applies base presentation attributes to the outer group", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        elements: [
          {
            type: "grid-group",
            x: 10,
            y: 10,
            cols: 2,
            rows: 2,
            colSpacing: 20,
            rowSpacing: 20,
            fill: "#aabbcc",
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
        ],
      })
    );
    expect(svg).toContain('fill="#aabbcc"');
  });
});

// ---------------------------------------------------------------------------
// arc-group
// ---------------------------------------------------------------------------

describe("arc-group", () => {
  it("renders count copies along an arc", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "arc-group",
            cx: 200, cy: 200, radius: 80,
            count: 5, startAngle: -90, endAngle: 90,
            child: { type: "circle", cx: 0, cy: 0, r: 6 },
          },
        ],
      })
    );
    const t = svg.match(/translate\(/g);
    expect(t).not.toBeNull();
    expect(t!.length).toBe(5);
  });

  it("count=1 places only at startAngle", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "arc-group",
            cx: 200, cy: 200, radius: 80,
            count: 1, startAngle: 0, endAngle: 180,
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
        ],
      })
    );
    // angle=0 => x=200+80=280, y=200
    expect(svg).toContain("translate(280, 200)");
  });

  it("full 360 arc behaves like radial-group", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "arc-group",
            cx: 200, cy: 200, radius: 60,
            count: 4, startAngle: 0, endAngle: 360,
            rotateChildren: false,
            child: { type: "rect", x: -5, y: -5, width: 10, height: 10 },
          },
        ],
      })
    );
    // 4 elements at 0, 120, 240, 360(=0) — endpoints inclusive
    const t = svg.match(/translate\(/g);
    expect(t!.length).toBe(4);
  });

  it("includes rotate when rotateChildren is true", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "arc-group",
            cx: 200, cy: 200, radius: 60,
            count: 3, startAngle: 0, endAngle: 90,
            rotateChildren: true,
            child: { type: "ellipse", cx: 0, cy: 0, rx: 15, ry: 5 },
          },
        ],
      })
    );
    expect(svg).toMatch(/rotate\(/);
  });

  it("omits rotate when rotateChildren is false", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "arc-group",
            cx: 200, cy: 200, radius: 60,
            count: 3, startAngle: 0, endAngle: 90,
            rotateChildren: false,
            child: { type: "circle", cx: 0, cy: 0, r: 4 },
          },
        ],
      })
    );
    expect(svg).not.toMatch(/rotate\(/);
  });
});

// ---------------------------------------------------------------------------
// scatter-group
// ---------------------------------------------------------------------------

describe("scatter-group", () => {
  it("renders count copies", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "scatter-group",
            x: 0, y: 0, width: 400, height: 400,
            count: 20, seed: 42,
            child: { type: "circle", cx: 0, cy: 0, r: 3 },
          },
        ],
      })
    );
    const t = svg.match(/translate\(/g);
    expect(t).not.toBeNull();
    expect(t!.length).toBe(20);
  });

  it("same seed produces identical output", () => {
    const cfg = {
      canvas: { width: 400, height: 400 },
      elements: [
        {
          type: "scatter-group" as const,
          x: 0, y: 0, width: 400, height: 400,
          count: 10, seed: 123,
          child: { type: "circle" as const, cx: 0, cy: 0, r: 2 },
        },
      ],
    };
    const a = renderSVG(c(cfg));
    const b = renderSVG(c(cfg));
    expect(a).toBe(b);
  });

  it("different seeds produce different output", () => {
    const make = (seed: number) =>
      renderSVG(
        c({
          canvas: { width: 400, height: 400 },
          elements: [
            {
              type: "scatter-group",
              x: 0, y: 0, width: 400, height: 400,
              count: 10, seed,
              child: { type: "circle", cx: 0, cy: 0, r: 2 },
            },
          ],
        })
      );
    expect(make(1)).not.toBe(make(99));
  });

  it("count=1 produces a single element", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 100, height: 100 },
        elements: [
          {
            type: "scatter-group",
            width: 100, height: 100,
            count: 1, seed: 7,
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
        ],
      })
    );
    const t = svg.match(/translate\(/g);
    expect(t!.length).toBe(1);
  });

  it("positions stay within bounding box", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "scatter-group",
            x: 50, y: 50, width: 200, height: 200,
            count: 50, seed: 999,
            child: { type: "circle", cx: 0, cy: 0, r: 1 },
          },
        ],
      })
    );
    // Extract all translate values
    const matches = [...svg.matchAll(/translate\(([^,]+), ([^)]+)\)/g)];
    for (const m of matches) {
      const tx = parseFloat(m[1]);
      const ty = parseFloat(m[2]);
      expect(tx).toBeGreaterThanOrEqual(50);
      expect(tx).toBeLessThanOrEqual(250);
      expect(ty).toBeGreaterThanOrEqual(50);
      expect(ty).toBeLessThanOrEqual(250);
    }
  });
});

// ---------------------------------------------------------------------------
// path-group
// ---------------------------------------------------------------------------

describe("path-group", () => {
  it("renders count copies along a two-point path", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "path-group",
            waypoints: [{ x: 50, y: 200 }, { x: 350, y: 200 }],
            count: 5,
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
        ],
      })
    );
    const t = svg.match(/translate\(/g);
    expect(t!.length).toBe(5);
  });

  it("first element is at the first waypoint", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "path-group",
            waypoints: [{ x: 100, y: 200 }, { x: 300, y: 200 }],
            count: 3,
            rotateChildren: false,
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
        ],
      })
    );
    expect(svg).toContain("translate(100, 200)");
  });

  it("last element is at the last waypoint", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "path-group",
            waypoints: [{ x: 0, y: 0 }, { x: 400, y: 400 }],
            count: 3,
            rotateChildren: false,
            child: { type: "circle", cx: 0, cy: 0, r: 5 },
          },
        ],
      })
    );
    expect(svg).toContain("translate(400, 400)");
  });

  it("includes rotate when rotateChildren is true", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "path-group",
            waypoints: [{ x: 0, y: 0 }, { x: 200, y: 100 }, { x: 400, y: 0 }],
            count: 6,
            rotateChildren: true,
            child: { type: "ellipse", cx: 0, cy: 0, rx: 10, ry: 3 },
          },
        ],
      })
    );
    expect(svg).toMatch(/rotate\(/);
  });

  it("count=1 places at the start", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        elements: [
          {
            type: "path-group",
            waypoints: [{ x: 100, y: 100 }, { x: 300, y: 300 }],
            count: 1,
            rotateChildren: false,
            child: { type: "circle", cx: 0, cy: 0, r: 4 },
          },
        ],
      })
    );
    expect(svg).toContain("translate(100, 100)");
    const t = svg.match(/translate\(/g);
    expect(t!.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SVG <pattern> defs
// ---------------------------------------------------------------------------

describe("defs.patterns", () => {
  it("renders a <pattern> element in defs", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        defs: {
          patterns: [
            {
              id: "dots",
              width: 20,
              height: 20,
              children: [{ type: "circle", cx: 10, cy: 10, r: 3, fill: "#333" }],
            },
          ],
        },
        elements: [{ type: "rect", width: 400, height: 400, fill: "url(#dots)" }],
      })
    );
    expect(svg).toContain("<pattern");
    expect(svg).toContain('id="dots"');
    expect(svg).toContain('width="20"');
    expect(svg).toContain('patternUnits="userSpaceOnUse"');
    expect(svg).toContain("</pattern>");
  });

  it("renders patternTransform when provided", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        defs: {
          patterns: [
            {
              id: "stripes",
              width: 10,
              height: 10,
              patternTransform: "rotate(45)",
              children: [{ type: "line", x1: 0, y1: 0, x2: 10, y2: 0, stroke: "#ccc", strokeWidth: 1 }],
            },
          ],
        },
        elements: [{ type: "rect", width: 200, height: 200, fill: "url(#stripes)" }],
      })
    );
    expect(svg).toContain('patternTransform="rotate(45)"');
  });

  it("renders multiple children inside the pattern tile", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        defs: {
          patterns: [
            {
              id: "grid",
              width: 20,
              height: 20,
              children: [
                { type: "rect", width: 20, height: 20, fill: "#111" },
                { type: "circle", cx: 10, cy: 10, r: 2, fill: "#ff0" },
              ],
            },
          ],
        },
        elements: [{ type: "rect", width: 200, height: 200, fill: "url(#grid)" }],
      })
    );
    expect(svg).toContain("<circle");
    expect(svg).toContain("<rect");
  });
});
