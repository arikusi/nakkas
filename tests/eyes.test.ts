/**
 * Tests for the "eyes" layer: animation frame sampling, filmstrip
 * composition, and post-render design audits (bounding box, contrast).
 */

import { describe, it, expect } from "vitest";
import { SVGConfigSchema, type SVGConfig } from "../src/schemas/config.js";
import type { CSSAnimation } from "../src/schemas/animations.js";
import { renderSVG } from "../src/renderer/svg-renderer.js";
import { svgToPng } from "../src/preview.js";
import { cubicBezier, resolveEasing } from "../src/eyes/easing.js";
import {
  lerpColor,
  lerpTransform,
  lerpValue,
  parseTransformList,
  toSvgTransform,
} from "../src/eyes/interpolate.js";
import {
  parseDuration,
  progressAtTime,
  sampleProperties,
  bakeFrame,
  configTimeline,
  allInfinite,
  resolveOriginCenter,
} from "../src/eyes/sampler.js";
import { buildFilmstrip } from "../src/eyes/filmstrip.js";
import { checkContentBounds, checkTextContrast, contrastRatio } from "../src/eyes/audit.js";

function c(raw: Parameters<typeof SVGConfigSchema.parse>[0]): SVGConfig {
  return SVGConfigSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

describe("easing", () => {
  it("linear is identity", () => {
    const f = resolveEasing("linear");
    expect(f(0)).toBe(0);
    expect(f(0.5)).toBeCloseTo(0.5, 5);
    expect(f(1)).toBe(1);
  });

  it("cubic bezier hits endpoints and is monotonic", () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let prev = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      const v = ease(t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = v;
    }
  });

  it("parses cubic-bezier() strings", () => {
    const f = resolveEasing("cubic-bezier(0.42, 0, 1, 1)");
    // ease-in: slow start
    expect(f(0.25)).toBeLessThan(0.25);
  });

  it("falls back to linear on garbage", () => {
    expect(resolveEasing("wobble")(0.3)).toBeCloseTo(0.3, 5);
  });
});

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

describe("interpolation", () => {
  it("lerps hex colors per channel", () => {
    expect(lerpColor("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(lerpColor("#f00", "#00f", 0)).toBe("#ff0000");
  });

  it("lerps matching transform lists with units stripped", () => {
    expect(lerpTransform("rotate(0deg)", "rotate(360deg)", 0.25)).toBe("rotate(90)");
    expect(lerpTransform("translate(0px, 0px) scale(1)", "translate(40px, 20px) scale(2)", 0.5))
      .toBe("translate(20, 10) scale(1.5)");
  });

  it("treats none as identity for the other side's functions", () => {
    expect(lerpTransform("none", "translate(10, 0)", 0.5)).toBe("translate(5, 0)");
  });

  it("returns null on mismatched transform lists", () => {
    expect(lerpTransform("rotate(0deg)", "translate(10px)", 0.5)).toBeNull();
  });

  it("rejects 3d transforms", () => {
    expect(parseTransformList("rotate3d(1,1,1,45deg)")).toBeNull();
  });

  it("rewrites CSS axis shorthands to valid SVG transform syntax", () => {
    // translateX etc. are CSS-only; resvg drops the whole attribute on them
    expect(toSvgTransform("translateX(140px)")).toBe("translate(140, 0)");
    expect(toSvgTransform("translateY(-20px)")).toBe("translate(0, -20)");
    expect(toSvgTransform("scaleX(2)")).toBe("scale(2, 1)");
    expect(toSvgTransform("scaleY(0.5)")).toBe("scale(1, 0.5)");
    expect(toSvgTransform("skewX(10deg)")).toBe("skewX(10)");
    expect(toSvgTransform("rotate(45deg) translateX(10px)")).toBe("rotate(45) translate(10, 0)");
    expect(toSvgTransform("not a transform")).toBeNull();
  });

  it("lerpValue: numbers, colors, discrete fallback", () => {
    expect(lerpValue("0", "1", 0.25)).toBe("0.25");
    expect(lerpValue("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(lerpValue("url(#a)", "url(#b)", 0.4)).toBe("url(#a)");
    expect(lerpValue("url(#a)", "url(#b)", 0.6)).toBe("url(#b)");
  });
});

// ---------------------------------------------------------------------------
// Progress and property sampling
// ---------------------------------------------------------------------------

const spin: CSSAnimation = {
  name: "spin",
  duration: "2s",
  timingFunction: "linear",
  iterationCount: "infinite",
  keyframes: [
    { offset: 0, properties: { transform: "rotate(0deg)" } },
    { offset: 100, properties: { transform: "rotate(360deg)" } },
  ],
};

describe("progressAtTime", () => {
  it("parses durations", () => {
    expect(parseDuration("2s")).toBe(2);
    expect(parseDuration("500ms")).toBe(0.5);
    expect(parseDuration(undefined)).toBe(0);
  });

  it("mid-cycle progress, looping", () => {
    expect(progressAtTime(spin, 0.5)).toBeCloseTo(0.25, 5);
    expect(progressAtTime(spin, 2.5)).toBeCloseTo(0.25, 5); // second cycle
  });

  it("respects delay without backwards fill", () => {
    const delayed: CSSAnimation = { ...spin, delay: "1s" };
    expect(progressAtTime(delayed, 0.5)).toBeNull();
    expect(progressAtTime(delayed, 1.5)).toBeCloseTo(0.25, 5);
  });

  it("finite animation without forwards fill contributes nothing after end", () => {
    const once: CSSAnimation = { ...spin, iterationCount: 1 };
    expect(progressAtTime(once, 3)).toBeNull();
  });

  it("forwards fill holds the end state", () => {
    const held: CSSAnimation = { ...spin, iterationCount: 1, fillMode: "forwards" };
    expect(progressAtTime(held, 5)).toBe(1);
  });

  it("alternate direction reverses odd cycles", () => {
    const alt: CSSAnimation = { ...spin, direction: "alternate" };
    expect(progressAtTime(alt, 0.5)).toBeCloseTo(0.25, 5); // cycle 0, normal
    expect(progressAtTime(alt, 2.5)).toBeCloseTo(0.75, 5); // cycle 1, reversed
  });
});

describe("sampleProperties", () => {
  it("interpolates transform at progress", () => {
    expect(sampleProperties(spin, 0.25).transform).toBe("rotate(90)");
  });

  it("handles multi-stop keyframes with per-segment easing", () => {
    const fade: CSSAnimation = {
      name: "fade",
      duration: "1s",
      timingFunction: "linear",
      keyframes: [
        { offset: 0, properties: { opacity: "0" } },
        { offset: 50, properties: { opacity: "1" } },
        { offset: 100, properties: { opacity: "0" } },
      ],
    };
    expect(sampleProperties(fade, 0.25).opacity).toBe("0.5");
    expect(sampleProperties(fade, 0.75).opacity).toBe("0.5");
  });

  it("normalizes camelCase property names to kebab-case", () => {
    const dash: CSSAnimation = {
      name: "draw",
      duration: "1s",
      timingFunction: "linear",
      keyframes: [
        { offset: 0, properties: { strokeDashoffset: "100" } },
        { offset: 100, properties: { strokeDashoffset: "0" } },
      ],
    };
    expect(sampleProperties(dash, 0.5)["stroke-dashoffset"]).toBe("50");
  });
});

// ---------------------------------------------------------------------------
// Frame baking
// ---------------------------------------------------------------------------

describe("bakeFrame", () => {
  const wheelConfig = c({
    canvas: { width: 200, height: 200 },
    elements: [
      {
        type: "radial-group",
        cx: 100, cy: 100, count: 4, radius: 50,
        cssClass: "spin",
        transformBox: "fill-box",
        transformOrigin: "center",
        child: { type: "rect", x: -25, y: -1, width: 50, height: 2, fill: "#333333" },
      },
    ],
    animations: [
      {
        name: "spin",
        duration: "2s",
        timingFunction: "linear",
        iterationCount: "infinite",
        keyframes: [
          { offset: 0, properties: { transform: "rotate(0deg)" } },
          { offset: 100, properties: { transform: "rotate(360deg)" } },
        ],
      },
    ],
  });

  it("bakes a rotation with derived origin at t=0.5s (90deg)", () => {
    const { config } = bakeFrame(wheelConfig, 0.5);
    const el = config.elements[0] as { transform?: string; cssClass?: string };
    expect(el.transform).toBe("translate(100, 100) rotate(90) translate(-100, -100)");
    expect(el.cssClass).toBeUndefined();
    expect(config.animations).toBeUndefined();
  });

  it("rendered frame has no @keyframes and carries the baked transform", () => {
    const { config } = bakeFrame(wheelConfig, 0.5);
    const svg = renderSVG(config);
    expect(svg).not.toContain("@keyframes");
    expect(svg).toContain('transform="translate(100, 100) rotate(90) translate(-100, -100)"');
  });

  it("does not mutate the source config", () => {
    bakeFrame(wheelConfig, 0.5);
    expect(wheelConfig.animations).toHaveLength(1);
    expect((wheelConfig.elements[0] as { cssClass?: string }).cssClass).toBe("spin");
  });

  it("bakes translateX animations as valid SVG translate()", () => {
    const cfg = c({
      canvas: { width: 700, height: 100 },
      elements: [{ type: "circle", cx: 70, cy: 50, r: 10, fill: "#4a90d9", cssClass: "run" }],
      animations: [
        {
          name: "run",
          duration: "3s",
          timingFunction: "linear",
          iterationCount: 1,
          fillMode: "forwards",
          keyframes: [
            { offset: 0, properties: { transform: "translateX(0px)" } },
            { offset: 100, properties: { transform: "translateX(560px)" } },
          ],
        },
      ],
    });
    const { config } = bakeFrame(cfg, 1.5);
    const el = config.elements[0] as { transform?: string };
    expect(el.transform).toBe("translate(280, 0)");
    // and the rendered attribute survives resvg's transform parser
    const svg = renderSVG(config);
    expect(svg).toContain('transform="translate(280, 0)"');
  });

  it("bakes opacity and color onto config fields", () => {
    const cfg = c({
      canvas: { width: 100, height: 100 },
      elements: [
        { type: "circle", cx: 50, cy: 50, r: 20, fill: "#000000", cssClass: "glow" },
      ],
      animations: [
        {
          name: "glow",
          duration: "2s",
          timingFunction: "linear",
          iterationCount: "infinite",
          keyframes: [
            { offset: 0, properties: { opacity: "0", fill: "#000000" } },
            { offset: 100, properties: { opacity: "1", fill: "#ffffff" } },
          ],
        },
      ],
    });
    const { config } = bakeFrame(cfg, 1);
    const el = config.elements[0] as { opacity?: number; fill?: string };
    expect(el.opacity).toBeCloseTo(0.5, 5);
    expect(el.fill).toBe("#808080");
  });

  it("notes SMIL animations instead of sampling them", () => {
    const cfg = c({
      canvas: { width: 100, height: 100 },
      elements: [
        {
          type: "circle", cx: 50, cy: 50, r: 10,
          smilAnimations: [{ kind: "animate", attributeName: "r", from: "10", to: "30", dur: "1s" }],
        },
      ],
      animations: [spin as never],
    });
    const { notes } = bakeFrame(cfg, 0.5);
    expect(notes.some((n) => n.includes("SMIL"))).toBe(true);
  });

  it("timeline helpers", () => {
    expect(configTimeline(wheelConfig)).toBe(2);
    expect(allInfinite(wheelConfig)).toBe(true);
  });

  it("resolves origins for common element shapes", () => {
    expect(resolveOriginCenter({ type: "circle", cx: 10, cy: 20, r: 5 } as never)).toEqual({ x: 10, y: 20 });
    expect(resolveOriginCenter({ type: "rect", x: 0, y: 0, width: 10, height: 20 } as never)).toEqual({ x: 5, y: 10 });
    expect(
      resolveOriginCenter({ type: "grid-group", x: 10, y: 10, cols: 3, rows: 3, colSpacing: 10, rowSpacing: 10 } as never)
    ).toEqual({ x: 20, y: 20 });
  });
});

// ---------------------------------------------------------------------------
// Filmstrip
// ---------------------------------------------------------------------------

describe("filmstrip", () => {
  it("composes N frames into one PNG", () => {
    const frame = svgToPng('<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="#cc0000"/></svg>');
    const strip = buildFilmstrip(
      [
        { png: frame, label: "t=0s" },
        { png: frame, label: "t=1s" },
        { png: frame, label: "t=2s" },
      ],
      50,
      50
    );
    expect(strip[0]).toBe(0x89); // PNG magic
    expect(strip.length).toBeGreaterThan(frame.length);
  });
});

// ---------------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------------

describe("checkContentBounds", () => {
  it("warns when content extends past the viewport", () => {
    const cfg = c({
      canvas: { width: 100, height: 100, viewBox: "0 0 100 100" },
      elements: [{ type: "circle", cx: 120, cy: 50, r: 30, fill: "#ff0000" }],
    });
    const warnings = checkContentBounds(renderSVG(cfg), cfg);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("right edge");
    expect(warnings[0]).toContain("clipped");
  });

  it("stays quiet when content fits", () => {
    const cfg = c({
      canvas: { width: 100, height: 100 },
      elements: [{ type: "circle", cx: 50, cy: 50, r: 30, fill: "#ff0000" }],
    });
    expect(checkContentBounds(renderSVG(cfg), cfg)).toEqual([]);
  });
});

describe("checkTextContrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("warns on low-contrast text against the background", () => {
    const cfg = c({
      canvas: { width: 200, height: 100, background: "#f0f0f0" },
      elements: [
        { type: "text", x: 100, y: 50, content: "ghost text", fontSize: 14, fill: "#e8e8e8" },
      ],
    });
    const warnings = checkTextContrast(cfg);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("ghost text");
    expect(warnings[0]).toContain("contrast");
  });

  it("stays quiet on readable text; gradient fills are judged by their worst stop", () => {
    const ok = c({
      canvas: { width: 200, height: 100, background: "#ffffff" },
      elements: [{ type: "text", x: 100, y: 50, content: "clear", fontSize: 14, fill: "#111111" }],
    });
    expect(checkTextContrast(ok)).toEqual([]);

    // Since 0.4.x a gradient fill is no longer skipped: the worst stop
    // against the background is reported (white-on-white here).
    const grad = c({
      canvas: { width: 200, height: 100, background: "#ffffff" },
      defs: { gradients: [{ type: "linearGradient", id: "g", stops: [{ offset: 0, color: "#ffffff" }, { offset: 1, color: "#eeeeee" }] }] },
      elements: [{ type: "text", x: 100, y: 50, content: "grad", fontSize: 14, fill: "url(#g)" }],
    });
    const warnings = checkTextContrast(grad);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('gradient "g"');
  });
});
