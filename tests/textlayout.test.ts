/**
 * Per-text layout audit: ink boxes measured through isolated resvg renders,
 * feeding two checks — named viewport overflow and text-on-text overlap.
 */

import { describe, it, expect } from "vitest";
import { measureTextInk, checkTextLayout, TEXT_MEASURE_CAP } from "../src/eyes/textlayout.js";
import type { SVGConfig } from "../src/schemas/config.js";

function config(partial: Partial<SVGConfig>): SVGConfig {
  return {
    canvas: { width: 400, height: 200, background: "#ffffff" },
    elements: [],
    ...partial,
  } as SVGConfig;
}

const text = (over: Record<string, unknown>) => ({
  type: "text",
  fontFamily: "sans-serif",
  fontSize: 16,
  fill: "#111111",
  ...over,
});

describe("measureTextInk", () => {
  it("measures a plausible ink box for plain text", () => {
    const { measured, skipped } = measureTextInk(
      config({ elements: [text({ x: 100, y: 100, content: "Hello" })] as SVGConfig["elements"] })
    );
    expect(skipped).toBe(0);
    expect(measured).toHaveLength(1);
    const { box } = measured[0];
    // Anchor is start at the baseline: ink starts near x=100 and sits above y=100.
    expect(box.x).toBeGreaterThan(90);
    expect(box.x).toBeLessThan(110);
    expect(box.y).toBeGreaterThan(100 - 20);
    expect(box.y + box.height).toBeLessThanOrEqual(102);
    expect(box.width).toBeGreaterThan(10);
  });

  it("labels tspan-array content with the flattened string", () => {
    const { measured } = measureTextInk(
      config({
        elements: [
          text({ x: 50, y: 50, content: ["Hi ", { text: "there" }] }),
        ] as SVGConfig["elements"],
      })
    );
    expect(measured[0].label).toBe('"Hi there"');
  });

  it("honors a group wrapper's transform", () => {
    const base = text({ x: 0, y: 20, content: "Shifted" });
    const plain = measureTextInk(
      config({ elements: [base] as SVGConfig["elements"] })
    );
    const grouped = measureTextInk(
      config({
        elements: [
          { type: "group", transform: "translate(200, 0)", children: [base] },
        ] as SVGConfig["elements"],
      })
    );
    expect(grouped.measured).toHaveLength(1);
    expect(grouped.measured[0].box.x).toBeCloseTo(plain.measured[0].box.x + 200, 0);
  });

  it("skips empty text instead of guessing", () => {
    const { measured } = measureTextInk(
      config({ elements: [text({ x: 10, y: 10, content: "" })] as SVGConfig["elements"] })
    );
    expect(measured).toHaveLength(0);
  });

  it("fast font path (generic families) measures identically to the full system scan", () => {
    const generic = config({
      elements: [text({ x: 50, y: 60, content: "parity check", fontSize: 18 })] as SVGConfig["elements"],
    });
    // A custom font name anywhere forces the full-scan path for the whole config.
    const forcedSlow = config({
      elements: [
        text({ x: 50, y: 60, content: "parity check", fontSize: 18 }),
        text({ x: 50, y: 160, content: "x", fontFamily: "Liberation Sans" }),
      ] as SVGConfig["elements"],
    });
    const fast = measureTextInk(generic).measured[0].box;
    const slow = measureTextInk(forcedSlow).measured[0].box;
    expect(fast.x).toBeCloseTo(slow.x, 1);
    expect(fast.y).toBeCloseTo(slow.y, 1);
    expect(fast.width).toBeCloseTo(slow.width, 1);
    expect(fast.height).toBeCloseTo(slow.height, 1);
  });

  it("caps the number of isolated renders and reports the rest", () => {
    const many = Array.from({ length: TEXT_MEASURE_CAP + 3 }, (_, i) =>
      text({ x: 10, y: 20 + i * 30, content: `line ${i}` })
    );
    const { measured, skipped } = measureTextInk(
      config({ canvas: { width: 400, height: 2000, background: "#ffffff" }, elements: many as SVGConfig["elements"] })
    );
    expect(measured.length).toBeLessThanOrEqual(TEXT_MEASURE_CAP);
    expect(skipped).toBe(3);
  });
});

describe("checkTextLayout", () => {
  it("stays silent for well-spaced text inside the viewport", () => {
    const warnings = checkTextLayout(
      config({
        elements: [
          text({ x: 20, y: 40, content: "Title" }),
          text({ x: 20, y: 120, content: "Caption" }),
        ] as SVGConfig["elements"],
      })
    );
    expect(warnings).toEqual([]);
  });

  it("names the text that escapes the viewport", () => {
    const warnings = checkTextLayout(
      config({
        elements: [
          text({ x: 380, y: 100, content: "runaway label", fontSize: 20 }),
        ] as SVGConfig["elements"],
      })
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"runaway label"');
    expect(warnings[0]).toContain("past the right edge");
  });

  it("catches two texts printed over each other", () => {
    const warnings = checkTextLayout(
      config({
        elements: [
          text({ x: 100, y: 100, content: "alpha" }),
          text({ x: 102, y: 101, content: "omega" }),
        ] as SVGConfig["elements"],
      })
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("overlaps");
    expect(warnings[0]).toContain('"alpha"');
    expect(warnings[0]).toContain('"omega"');
  });

  it("notes the base-state caveat when an overlapping text is animated", () => {
    const warnings = checkTextLayout(
      config({
        elements: [
          text({ x: 100, y: 100, content: "mover", cssClass: "slide" }),
          text({ x: 102, y: 101, content: "anchor" }),
        ] as SVGConfig["elements"],
        animations: [
          {
            name: "slide",
            duration: "2s",
            keyframes: [
              { offset: 0, properties: { transform: "translate(0px, 0px)" } },
              { offset: 100, properties: { transform: "translate(100px, 0px)" } },
            ],
          },
        ] as SVGConfig["animations"],
      })
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("measured before animations run");
  });

  it("ignores invisible text (opacity 0 / visibility hidden) instead of false-positive overlaps", () => {
    const warnings = checkTextLayout(
      config({
        elements: [
          text({ x: 100, y: 100, content: "visible" }),
          text({ x: 101, y: 101, content: "ghost a", opacity: 0 }),
          text({ x: 102, y: 102, content: "ghost b", visibility: "hidden" }),
        ] as SVGConfig["elements"],
      })
    );
    expect(warnings).toEqual([]);
  });

  it("does not flag texts that merely sit close", () => {
    const warnings = checkTextLayout(
      config({
        elements: [
          text({ x: 20, y: 60, content: "upper" }),
          text({ x: 20, y: 90, content: "lower" }),
        ] as SVGConfig["elements"],
      })
    );
    expect(warnings).toEqual([]);
  });
});
