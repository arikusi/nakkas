/**
 * Tests for the design analysis feedback mechanism.
 * Each rule in analyzeConfig is tested independently.
 */

import { describe, it, expect } from "vitest";
import { analyzeConfig } from "../src/analysis.js";
import { SVGConfigSchema } from "../src/schemas/config.js";

function c(raw: Parameters<typeof SVGConfigSchema.parse>[0]) {
  return SVGConfigSchema.parse(raw);
}

const base = { canvas: { width: 400, height: 400 } };

// ---------------------------------------------------------------------------
// Rule 1: too many concurrent animations
// ---------------------------------------------------------------------------

describe("analysis: animation count", () => {
  it("no warning when animations <= 4", () => {
    const config = c({
      ...base,
      elements: [{ type: "circle", r: 10 }],
      animations: [
        { name: "a1", duration: "2s", keyframes: [{ offset: "from", properties: { opacity: "0" } }, { offset: "to", properties: { opacity: "1" } }] },
        { name: "a2", duration: "2s", keyframes: [{ offset: "from", properties: { opacity: "0" } }, { offset: "to", properties: { opacity: "1" } }] },
      ],
    });
    const w = analyzeConfig(config, 1000);
    expect(w.find((m) => m.includes("concurrent"))).toBeUndefined();
  });

  it("warns when animations > 4", () => {
    const anim = (n: string) => ({
      name: n,
      duration: "2s",
      keyframes: [
        { offset: "from" as const, properties: { opacity: "0" } },
        { offset: "to" as const, properties: { opacity: "1" } },
      ],
    });
    const config = c({
      ...base,
      elements: [{ type: "circle", r: 10 }],
      animations: [anim("a1"), anim("a2"), anim("a3"), anim("a4"), anim("a5")],
    });
    const w = analyzeConfig(config, 1000);
    expect(w.find((m) => m.includes("concurrent"))).toBeDefined();
    expect(w.find((m) => m.includes("5"))).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 2: group-level scale animation
// ---------------------------------------------------------------------------

describe("analysis: group scale animation", () => {
  it("warns when radial-group has scale animation", () => {
    const config = c({
      ...base,
      elements: [
        {
          type: "radial-group",
          cx: 200, cy: 200, count: 6, radius: 80,
          cssClass: "bloom",
          child: { type: "circle", cx: 0, cy: 0, r: 10 },
        },
      ],
      animations: [
        {
          name: "bloom",
          duration: "2s",
          keyframes: [
            { offset: "from", properties: { transform: "scale(0.8)" } },
            { offset: "to", properties: { transform: "scale(1.2)" } },
          ],
        },
      ],
    });
    const w = analyzeConfig(config, 1000);
    expect(w.find((m) => m.includes("scale") && m.includes("group"))).toBeDefined();
  });

  it("no warning when radial-group has non-scale animation", () => {
    const config = c({
      ...base,
      elements: [
        {
          type: "radial-group",
          cx: 200, cy: 200, count: 4, radius: 60,
          cssClass: "fade",
          child: { type: "circle", cx: 0, cy: 0, r: 8 },
        },
      ],
      animations: [
        {
          name: "fade",
          duration: "2s",
          keyframes: [
            { offset: "from", properties: { opacity: "0.3" } },
            { offset: "to", properties: { opacity: "1" } },
          ],
        },
      ],
    });
    const w = analyzeConfig(config, 1000);
    expect(w.find((m) => m.includes("scale") && m.includes("group"))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 3: missing transformBox
// ---------------------------------------------------------------------------

describe("analysis: missing transformBox", () => {
  it("warns when animated element with scale lacks transformBox", () => {
    const config = c({
      ...base,
      elements: [
        { type: "circle", cx: 100, cy: 100, r: 30, cssClass: "pulse" },
      ],
      animations: [
        {
          name: "pulse",
          duration: "2s",
          keyframes: [
            { offset: "from", properties: { transform: "scale(0.9)" } },
            { offset: "to", properties: { transform: "scale(1.1)" } },
          ],
        },
      ],
    });
    const w = analyzeConfig(config, 1000);
    expect(w.find((m) => m.includes("transformBox"))).toBeDefined();
  });

  it("no warning when transformBox is present", () => {
    const config = c({
      ...base,
      elements: [
        {
          type: "circle", cx: 100, cy: 100, r: 30, cssClass: "pulse",
          transformBox: "fill-box", transformOrigin: "center",
        },
      ],
      animations: [
        {
          name: "pulse",
          duration: "2s",
          keyframes: [
            { offset: "from", properties: { transform: "scale(0.9)" } },
            { offset: "to", properties: { transform: "scale(1.1)" } },
          ],
        },
      ],
    });
    const w = analyzeConfig(config, 1000);
    expect(w.find((m) => m.includes("transformBox"))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 4: SVG size warning
// ---------------------------------------------------------------------------

describe("analysis: SVG size", () => {
  it("warns when SVG is larger than 50KB", () => {
    const config = c({ ...base, elements: [{ type: "circle", r: 10 }] });
    const w = analyzeConfig(config, 60000);
    expect(w.find((m) => m.includes("kb"))).toBeDefined();
  });

  it("no warning for small SVGs", () => {
    const config = c({ ...base, elements: [{ type: "circle", r: 10 }] });
    const w = analyzeConfig(config, 5000);
    expect(w.find((m) => m.includes("kb"))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 5: high element count
// ---------------------------------------------------------------------------

describe("analysis: element count", () => {
  it("warns when grid-group produces > 200 elements", () => {
    const config = c({
      ...base,
      elements: [
        {
          type: "grid-group",
          x: 0, y: 0, cols: 15, rows: 15,
          colSpacing: 20, rowSpacing: 20,
          child: { type: "circle", cx: 0, cy: 0, r: 3 },
        },
      ],
    });
    const w = analyzeConfig(config, 1000);
    expect(w.find((m) => m.includes("element count"))).toBeDefined();
  });

  it("no warning for moderate element counts", () => {
    const config = c({
      ...base,
      elements: [
        {
          type: "grid-group",
          x: 0, y: 0, cols: 5, rows: 5,
          colSpacing: 20, rowSpacing: 20,
          child: { type: "circle", cx: 0, cy: 0, r: 3 },
        },
      ],
    });
    const w = analyzeConfig(config, 1000);
    expect(w.find((m) => m.includes("element count"))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 6: shared cssClass
// ---------------------------------------------------------------------------

describe("analysis: shared cssClass", () => {
  it("warns when cssClass is shared by more than 5 elements", () => {
    const elements = Array.from({ length: 8 }, () => ({
      type: "circle" as const,
      cx: 0, cy: 0, r: 5,
      cssClass: "shared",
    }));
    const config = c({
      ...base,
      elements,
      animations: [
        {
          name: "shared",
          duration: "1s",
          keyframes: [
            { offset: "from", properties: { opacity: "0" } },
            { offset: "to", properties: { opacity: "1" } },
          ],
        },
      ],
    });
    const w = analyzeConfig(config, 1000);
    expect(w.find((m) => m.includes("shared by 8"))).toBeDefined();
  });

  it("no warning when cssClass count <= 5", () => {
    const elements = Array.from({ length: 4 }, () => ({
      type: "circle" as const,
      cx: 0, cy: 0, r: 5,
      cssClass: "few",
    }));
    const config = c({ ...base, elements });
    const w = analyzeConfig(config, 1000);
    expect(w.find((m) => m.includes("shared by"))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Clean config produces no warnings
// ---------------------------------------------------------------------------

describe("analysis: clean config", () => {
  it("produces no warnings for a simple, well-formed config", () => {
    const config = c({
      ...base,
      elements: [
        {
          type: "circle", cx: 200, cy: 200, r: 40,
          cssClass: "pulse",
          transformBox: "fill-box", transformOrigin: "center",
        },
      ],
      animations: [
        {
          name: "pulse",
          duration: "2s",
          keyframes: [
            { offset: "from", properties: { opacity: "0.5", transform: "scale(0.95)" } },
            { offset: "to", properties: { opacity: "1", transform: "scale(1.05)" } },
          ],
        },
      ],
    });
    const w = analyzeConfig(config, 3000);
    expect(w).toHaveLength(0);
  });
});
