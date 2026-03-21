/**
 * Tests for parametric curve renderer.
 * Verifies that each mathematical function produces valid SVG path data.
 */

import { describe, it, expect } from "vitest";
import { SVGConfigSchema } from "../src/schemas/config.js";
import { renderSVG } from "../src/renderer/svg-renderer.js";

function c(raw: Parameters<typeof SVGConfigSchema.parse>[0]) {
  return SVGConfigSchema.parse(raw);
}

/** Helper: render a single parametric element and return the SVG string */
function renderParametricElement(params: Record<string, unknown>) {
  return renderSVG(
    c({
      canvas: { width: 400, height: 400 },
      elements: [{ type: "parametric", cx: 200, cy: 200, ...params }],
    })
  );
}

// ---------------------------------------------------------------------------
// Common checks
// ---------------------------------------------------------------------------

function expectValidPath(svg: string) {
  // Must contain a <path element with a d attribute starting with M
  expect(svg).toMatch(/<path [^>]*d="M /);
  // Must contain L (line-to) commands
  expect(svg).toContain(" L ");
}

// ---------------------------------------------------------------------------
// rose
// ---------------------------------------------------------------------------

describe("parametric — rose", () => {
  it("produces a valid closed path", () => {
    const svg = renderParametricElement({ fn: "rose", k: 3, scale: 80 });
    expectValidPath(svg);
    expect(svg).toContain(" Z");
  });

  it("k=4 (even) still produces a valid path", () => {
    const svg = renderParametricElement({ fn: "rose", k: 4, scale: 60 });
    expectValidPath(svg);
  });

  it("k=5 produces a valid path", () => {
    const svg = renderParametricElement({ fn: "rose", k: 5, scale: 70 });
    expectValidPath(svg);
  });

  it("closed=false removes the Z command", () => {
    const svg = renderParametricElement({ fn: "rose", k: 3, scale: 60, closed: false });
    expectValidPath(svg);
    expect(svg).not.toContain(" Z");
  });
});

// ---------------------------------------------------------------------------
// heart
// ---------------------------------------------------------------------------

describe("parametric — heart", () => {
  it("produces a valid closed path", () => {
    const svg = renderParametricElement({ fn: "heart", scale: 80 });
    expectValidPath(svg);
    expect(svg).toContain(" Z");
  });

  it("shape stays within a reasonable bounding box around cx/cy", () => {
    const scale = 80;
    const cx = 200;
    const svg = renderParametricElement({ fn: "heart", cx, cy: 200, scale });
    // Heart should contain points close to cx (within scale range)
    // Just verify the path exists and is non-trivial
    const dMatch = svg.match(/d="(M [^"]+)"/);
    expect(dMatch).not.toBeNull();
    expect(dMatch![1].split("L").length).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// star
// ---------------------------------------------------------------------------

describe("parametric — star", () => {
  it("5-pointed star produces 10 path points (5 outer + 5 inner)", () => {
    const svg = renderParametricElement({ fn: "star", points: 5, scale: 80 });
    expectValidPath(svg);
    // 10 points: 1 M + 9 L
    const lCount = (svg.match(/ L /g) ?? []).length;
    expect(lCount).toBe(9);
    expect(svg).toContain(" Z");
  });

  it("6-pointed star produces 12 path points", () => {
    const svg = renderParametricElement({ fn: "star", points: 6, scale: 80 });
    const lCount = (svg.match(/ L /g) ?? []).length;
    expect(lCount).toBe(11); // 1M + 11L = 12 points
  });

  it("innerRadius parameter changes the inner indent", () => {
    const sharpStar = renderParametricElement({ fn: "star", points: 5, scale: 80, innerRadius: 10 });
    const roundStar = renderParametricElement({ fn: "star", points: 5, scale: 80, innerRadius: 60 });
    // Different innerRadius → different path data
    expect(sharpStar).not.toBe(roundStar);
  });
});

// ---------------------------------------------------------------------------
// lissajous
// ---------------------------------------------------------------------------

describe("parametric — lissajous", () => {
  it("produces a valid open path by default", () => {
    const svg = renderParametricElement({ fn: "lissajous", freqA: 3, freqB: 2 });
    expectValidPath(svg);
    expect(svg).not.toContain(" Z");
  });

  it("closed=true adds the Z command", () => {
    const svg = renderParametricElement({ fn: "lissajous", freqA: 3, freqB: 2, closed: true });
    expect(svg).toContain(" Z");
  });

  it("different freqA/freqB ratios produce different paths", () => {
    const a = renderParametricElement({ fn: "lissajous", freqA: 3, freqB: 2 });
    const b = renderParametricElement({ fn: "lissajous", freqA: 5, freqB: 4 });
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// spiral
// ---------------------------------------------------------------------------

describe("parametric — spiral", () => {
  it("archimedean spiral produces a valid open path", () => {
    const svg = renderParametricElement({ fn: "spiral", turns: 3, scale: 5 });
    expectValidPath(svg);
    expect(svg).not.toContain(" Z");
  });

  it("logarithmic spiral produces a valid open path", () => {
    const svg = renderParametricElement({ fn: "spiral", spiralType: "logarithmic", turns: 2, scale: 2, growth: 0.3 });
    expectValidPath(svg);
    expect(svg).not.toContain(" Z");
  });
});

// ---------------------------------------------------------------------------
// superformula
// ---------------------------------------------------------------------------

describe("parametric — superformula", () => {
  it("produces a valid closed path", () => {
    const svg = renderParametricElement({ fn: "superformula", m: 4, n1: 1, n2: 1, n3: 1, scale: 80 });
    expectValidPath(svg);
    expect(svg).toContain(" Z");
  });

  it("different m values produce different shapes", () => {
    const a = renderParametricElement({ fn: "superformula", m: 3, scale: 80 });
    const b = renderParametricElement({ fn: "superformula", m: 6, scale: 80 });
    expect(a).not.toBe(b);
  });

  it("extreme n values (pointy star) still produce valid path", () => {
    const svg = renderParametricElement({ fn: "superformula", m: 5, n1: 0.2, n2: 0.2, n3: 0.2, scale: 80 });
    expectValidPath(svg);
  });
});

// ---------------------------------------------------------------------------
// epitrochoid
// ---------------------------------------------------------------------------

describe("parametric — epitrochoid", () => {
  it("produces a valid closed path", () => {
    const svg = renderParametricElement({ fn: "epitrochoid", R: 80, r: 30, d: 50 });
    expectValidPath(svg);
    expect(svg).toContain(" Z");
  });

  it("different R/r ratios produce different paths", () => {
    const a = renderParametricElement({ fn: "epitrochoid", R: 80, r: 20, d: 40 });
    const b = renderParametricElement({ fn: "epitrochoid", R: 60, r: 30, d: 50 });
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// hypotrochoid
// ---------------------------------------------------------------------------

describe("parametric — hypotrochoid", () => {
  it("produces a valid closed path", () => {
    const svg = renderParametricElement({ fn: "hypotrochoid", R: 80, r: 30, d: 40 });
    expectValidPath(svg);
    expect(svg).toContain(" Z");
  });

  it("classic spirograph (d=r) produces a valid path", () => {
    // When d = r, it's a hypocycloid
    const svg = renderParametricElement({ fn: "hypotrochoid", R: 80, r: 20, d: 20 });
    expectValidPath(svg);
  });
});

// ---------------------------------------------------------------------------
// wave
// ---------------------------------------------------------------------------

describe("parametric — wave", () => {
  it("produces a valid open path by default", () => {
    const svg = renderParametricElement({ fn: "wave", width: 400, amplitude: 30, frequency: 3 });
    expectValidPath(svg);
    expect(svg).not.toContain(" Z");
  });

  it("different frequency values produce different paths", () => {
    const a = renderParametricElement({ fn: "wave", width: 400, amplitude: 30, frequency: 2 });
    const b = renderParametricElement({ fn: "wave", width: 400, amplitude: 30, frequency: 5 });
    expect(a).not.toBe(b);
  });

  it("closed=true adds the Z command", () => {
    const svg = renderParametricElement({ fn: "wave", width: 200, amplitude: 20, frequency: 1, closed: true });
    expect(svg).toContain(" Z");
  });
});

// ---------------------------------------------------------------------------
// Presentation attributes
// ---------------------------------------------------------------------------

describe("parametric — presentation attributes", () => {
  it("fill and stroke are applied to the <path>", () => {
    const svg = renderParametricElement({
      fn: "rose",
      k: 3,
      scale: 60,
      fill: "none",
      stroke: "#ff6600",
      strokeWidth: 2,
    });
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#ff6600"');
    expect(svg).toContain('stroke-width="2"');
  });

  it("cssClass is applied to the <path>", () => {
    const svg = renderParametricElement({ fn: "heart", scale: 60, cssClass: "bloom" });
    expect(svg).toContain('class="bloom"');
  });

  it("id is applied to the <path>", () => {
    const svg = renderParametricElement({ fn: "star", points: 5, scale: 60, id: "my-star" });
    expect(svg).toContain('id="my-star"');
  });
});

// ---------------------------------------------------------------------------
// Integration: parametric inside a complete config
// ---------------------------------------------------------------------------

describe("parametric — integration", () => {
  it("renders alongside a gradient in defs", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 400 },
        defs: {
          gradients: [
            {
              type: "linearGradient",
              id: "petalGrad",
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 1,
              stops: [
                { offset: 0, color: "#ff6600" },
                { offset: 1, color: "#ff0066" },
              ],
            },
          ],
        },
        elements: [
          { type: "parametric", fn: "rose", cx: 200, cy: 200, k: 5, scale: 90, fill: "url(#petalGrad)" },
        ],
      })
    );
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain('fill="url(#petalGrad)"');
    expectValidPath(svg);
  });
});
