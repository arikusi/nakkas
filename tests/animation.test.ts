/**
 * Animation rendering tests.
 * Tests CSS @keyframes generation and SMIL animation element output.
 */

import { describe, it, expect } from "vitest";
import {
  renderCSSAnimation,
  renderCSSAnimations,
  renderSMILAnimation,
  renderSMILAnimations,
} from "../src/renderer/animation-renderer.js";
import { SVGConfigSchema } from "../src/schemas/config.js";
import { renderSVG } from "../src/renderer/svg-renderer.js";

// ---------------------------------------------------------------------------
// CSS @keyframes
// ---------------------------------------------------------------------------

describe("renderCSSAnimation", () => {
  it("generates @keyframes block with name", () => {
    const result = renderCSSAnimation({
      name: "fade",
      duration: "2s",
      keyframes: [
        { offset: "from", properties: { opacity: "0" } },
        { offset: "to", properties: { opacity: "1" } },
      ],
    });
    expect(result).toContain("@keyframes fade");
    expect(result).toContain("from{opacity:0}");
    expect(result).toContain("to{opacity:1}");
  });

  it("generates percentage keyframe stops", () => {
    const result = renderCSSAnimation({
      name: "pulse",
      duration: "1s",
      keyframes: [
        { offset: 0, properties: { transform: "scale(1)" } },
        { offset: 50, properties: { transform: "scale(1.2)" } },
        { offset: 100, properties: { transform: "scale(1)" } },
      ],
    });
    expect(result).toContain("0%");
    expect(result).toContain("50%");
    expect(result).toContain("100%");
  });

  it("generates class rule with individual animation properties", () => {
    const result = renderCSSAnimation({
      name: "spin",
      duration: "3s",
      keyframes: [
        { offset: "from", properties: { transform: "rotate(0deg)" } },
        { offset: "to", properties: { transform: "rotate(360deg)" } },
      ],
    });
    // Individual properties — more readable and maintainable than shorthand
    expect(result).toContain(".spin{");
    expect(result).toContain("animation-name:spin");
    expect(result).toContain("animation-duration:3s");
    expect(result).toContain("animation-timing-function:ease");
  });

  it("includes iterationCount in animation shorthand", () => {
    const result = renderCSSAnimation({
      name: "loop",
      duration: "2s",
      iterationCount: "infinite",
      keyframes: [
        { offset: "from", properties: { opacity: "0" } },
        { offset: "to", properties: { opacity: "1" } },
      ],
    });
    expect(result).toContain("infinite");
  });

  it("includes direction in animation shorthand", () => {
    const result = renderCSSAnimation({
      name: "bounce",
      duration: "0.5s",
      iterationCount: "infinite",
      direction: "alternate",
      keyframes: [
        { offset: "from", properties: { transform: "translateY(0)" } },
        { offset: "to", properties: { transform: "translateY(-20px)" } },
      ],
    });
    expect(result).toContain("alternate");
  });

  it("uses ease as default timing function", () => {
    const result = renderCSSAnimation({
      name: "test",
      duration: "1s",
      keyframes: [
        { offset: "from", properties: { opacity: "0" } },
        { offset: "to", properties: { opacity: "1" } },
      ],
    });
    expect(result).toContain("ease");
  });

  it("uses provided timing function", () => {
    const result = renderCSSAnimation({
      name: "test",
      duration: "1s",
      timingFunction: "linear",
      keyframes: [
        { offset: "from", properties: { opacity: "0" } },
        { offset: "to", properties: { opacity: "1" } },
      ],
    });
    expect(result).toContain("linear");
  });

  it("handles multiple CSS properties per keyframe", () => {
    const result = renderCSSAnimation({
      name: "combo",
      duration: "1s",
      keyframes: [
        {
          offset: "from",
          properties: { opacity: "0", transform: "scale(0.5)", fill: "#ff0000" },
        },
        { offset: "to", properties: { opacity: "1", transform: "scale(1)", fill: "#0000ff" } },
      ],
    });
    expect(result).toContain("opacity:0");
    expect(result).toContain("transform:scale(0.5)");
    expect(result).toContain("fill:#ff0000");
  });

  it("converts camelCase property names to kebab-case", () => {
    const result = renderCSSAnimation({
      name: "drawOn",
      duration: "2s",
      keyframes: [
        { offset: "from", properties: { strokeDashoffset: "500" } },
        { offset: "to", properties: { strokeDashoffset: "0" } },
      ],
    });
    // camelCase input → kebab-case CSS output
    expect(result).toContain("stroke-dashoffset:500");
    expect(result).toContain("stroke-dashoffset:0");
    expect(result).not.toContain("strokeDashoffset");
  });

  it("passes through already kebab-case property names unchanged", () => {
    const result = renderCSSAnimation({
      name: "fade",
      duration: "1s",
      keyframes: [
        { offset: "from", properties: { "stroke-dashoffset": "500" } },
        { offset: "to", properties: { "stroke-dashoffset": "0" } },
      ],
    });
    expect(result).toContain("stroke-dashoffset:500");
  });

  it("sanitizes </style> injection in CSS values", () => {
    const result = renderCSSAnimation({
      name: "test",
      duration: "1s",
      keyframes: [
        { offset: "from", properties: { opacity: "0</style><rect/><style>" } },
        { offset: "to", properties: { opacity: "1" } },
      ],
    });
    // </style> is stripped to prevent premature tag closure breaking the style block
    expect(result).not.toContain("</style>");
  });

  it("emits individual animation-* properties", () => {
    const result = renderCSSAnimation({
      name: "bounce",
      duration: "0.5s",
      delay: "0.2s",
      iterationCount: "infinite",
      direction: "alternate",
      fillMode: "both",
      keyframes: [
        { offset: "from", properties: { transform: "translateY(0)" } },
        { offset: "to", properties: { transform: "translateY(-20px)" } },
      ],
    });
    expect(result).toContain("animation-name:bounce");
    expect(result).toContain("animation-duration:0.5s");
    expect(result).toContain("animation-delay:0.2s");
    expect(result).toContain("animation-iteration-count:infinite");
    expect(result).toContain("animation-direction:alternate");
    expect(result).toContain("animation-fill-mode:both");
  });
});

describe("renderCSSAnimations", () => {
  it("returns empty string for empty array", () => {
    expect(renderCSSAnimations([])).toBe("");
  });

  it("wraps multiple animations in style block", () => {
    const result = renderCSSAnimations([
      {
        name: "a1",
        duration: "1s",
        keyframes: [
          { offset: "from", properties: { opacity: "0" } },
          { offset: "to", properties: { opacity: "1" } },
        ],
      },
      {
        name: "a2",
        duration: "2s",
        keyframes: [
          { offset: "from", properties: { transform: "scale(1)" } },
          { offset: "to", properties: { transform: "scale(1.5)" } },
        ],
      },
    ]);
    expect(result).toContain("<style>");
    expect(result).toContain("</style>");
    expect(result).toContain("@keyframes a1");
    expect(result).toContain("@keyframes a2");
  });
});

// ---------------------------------------------------------------------------
// SMIL animations
// ---------------------------------------------------------------------------

describe("renderSMILAnimation — animate", () => {
  it("renders animate element with attributeName", () => {
    const result = renderSMILAnimation({
      kind: "animate",
      attributeName: "opacity",
      from: "0",
      to: "1",
      dur: "2s",
    });
    expect(result).toContain("<animate");
    expect(result).toContain('attributeName="opacity"');
    expect(result).toContain('from="0"');
    expect(result).toContain('to="1"');
    expect(result).toContain('dur="2s"');
  });

  it("renders animate with values and keyTimes", () => {
    const result = renderSMILAnimation({
      kind: "animate",
      attributeName: "fill",
      values: "#ff0000;#00ff00;#0000ff;#ff0000",
      keyTimes: "0;0.33;0.66;1",
      dur: "3s",
      repeatCount: "indefinite",
    });
    expect(result).toContain('values="#ff0000;#00ff00;#0000ff;#ff0000"');
    expect(result).toContain('keyTimes="0;0.33;0.66;1"');
    expect(result).toContain('repeatCount="indefinite"');
  });

  it("renders animate with calcMode=discrete for binary flipping", () => {
    const result = renderSMILAnimation({
      kind: "animate",
      attributeName: "opacity",
      values: "1;0",
      keyTimes: "0;0.5",
      dur: "1s",
      repeatCount: "indefinite",
      calcMode: "discrete",
    });
    expect(result).toContain('calcMode="discrete"');
  });

  it("renders animate with fill=freeze", () => {
    const result = renderSMILAnimation({
      kind: "animate",
      attributeName: "opacity",
      from: "0",
      to: "1",
      dur: "1s",
      fill: "freeze",
    });
    expect(result).toContain('fill="freeze"');
  });

  it("renders path morphing animate on d attribute", () => {
    const result = renderSMILAnimation({
      kind: "animate",
      attributeName: "d",
      from: "M 10 50 L 90 50",
      to: "M 10 10 L 90 90",
      dur: "2s",
      repeatCount: "indefinite",
    });
    expect(result).toContain('attributeName="d"');
  });
});

describe("renderSMILAnimation — animateTransform", () => {
  it("renders animateTransform with attributeName=transform", () => {
    const result = renderSMILAnimation({
      kind: "animateTransform",
      type: "rotate",
      from: "0 100 100",
      to: "360 100 100",
      dur: "3s",
      repeatCount: "indefinite",
    });
    expect(result).toContain("<animateTransform");
    expect(result).toContain('attributeName="transform"');
    expect(result).toContain('type="rotate"');
    expect(result).toContain('from="0 100 100"');
    expect(result).toContain('to="360 100 100"');
  });

  it("renders translate animateTransform", () => {
    const result = renderSMILAnimation({
      kind: "animateTransform",
      type: "translate",
      from: "0 0",
      to: "100 0",
      dur: "2s",
    });
    expect(result).toContain('type="translate"');
  });
});

describe("renderSMILAnimation — animateMotion", () => {
  it("renders animateMotion with path and dur", () => {
    const result = renderSMILAnimation({
      kind: "animateMotion",
      path: "M 0 0 C 100 0 100 100 200 100",
      dur: "3s",
      repeatCount: "indefinite",
    });
    expect(result).toContain("<animateMotion");
    expect(result).toContain('path="M 0 0 C 100 0 100 100 200 100"');
    expect(result).toContain('dur="3s"');
  });

  it("renders auto rotate for direction-following motion", () => {
    const result = renderSMILAnimation({
      kind: "animateMotion",
      path: "M 0 50 Q 100 0 200 50",
      dur: "4s",
      rotate: "auto",
    });
    expect(result).toContain('rotate="auto"');
  });
});

describe("renderSMILAnimations", () => {
  it("returns empty string for undefined", () => {
    expect(renderSMILAnimations(undefined)).toBe("");
  });

  it("returns empty string for empty array", () => {
    expect(renderSMILAnimations([])).toBe("");
  });

  it("renders multiple SMIL animations", () => {
    const result = renderSMILAnimations([
      { kind: "animate", attributeName: "opacity", from: "0", to: "1", dur: "1s" },
      { kind: "animateTransform", type: "rotate", from: "0", to: "360", dur: "2s" },
    ]);
    expect(result).toContain("<animate");
    expect(result).toContain("<animateTransform");
  });
});

// ---------------------------------------------------------------------------
// Integration: SMIL inside a rendered SVG element
// ---------------------------------------------------------------------------

describe("SMIL inside rendered shapes", () => {
  function c(raw: Parameters<typeof SVGConfigSchema.parse>[0]) {
    return SVGConfigSchema.parse(raw);
  }

  it("SMIL animate is a child element of rect", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        elements: [
          {
            type: "rect",
            width: 100,
            height: 100,
            smilAnimations: [
              { kind: "animate", attributeName: "opacity", from: "1", to: "0.3", dur: "2s", repeatCount: "indefinite", direction: "alternate" },
            ],
          },
        ],
      })
    );
    // SMIL animate should appear inside rect tags
    expect(svg).toMatch(/<rect[^>]*>[\s\S]*<animate[\s\S]*<\/rect>/);
  });

  it("CSS animation appears in style block", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        animations: [
          {
            name: "fadeIn",
            duration: "1s",
            keyframes: [
              { offset: "from", properties: { opacity: "0" } },
              { offset: "to", properties: { opacity: "1" } },
            ],
          },
        ],
        elements: [{ type: "rect", width: 100, height: 100, cssClass: "fadeIn" }],
      })
    );
    expect(svg).toContain("<style>");
    expect(svg).toContain("@keyframes fadeIn");
    expect(svg).toContain('class="fadeIn"');
  });
});

// ---------------------------------------------------------------------------
// Security: CSS injection prevention
// ---------------------------------------------------------------------------

describe("renderCSSAnimation — security", () => {
  it("sanitizes CSS block-breakout chars in animation name", () => {
    const r = renderCSSAnimation({
      name: "x}*{display:none}@keyframes y",
      duration: "1s",
      keyframes: [
        { offset: "from", properties: { opacity: "0" } },
        { offset: "to", properties: { opacity: "1" } },
      ],
    });
    expect(r).not.toContain("display:none");
    expect(r).not.toContain("}*{");
  });

  it("sanitizes CSS block breakout in animation duration", () => {
    const r = renderCSSAnimation({
      name: "safe",
      duration: "1s}*{display:none",
      keyframes: [
        { offset: "from", properties: { opacity: "0" } },
        { offset: "to", properties: { opacity: "1" } },
      ],
    });
    // Braces stripped — the }*{ pattern that would inject a new CSS rule is gone
    expect(r).not.toContain("}*{");
    expect(r).not.toContain("} *{");
  });

  it("prepends underscore to animation name starting with a digit", () => {
    const r = renderCSSAnimation({
      name: "2fast",
      duration: "1s",
      keyframes: [
        { offset: "from", properties: { opacity: "0" } },
        { offset: "to", properties: { opacity: "1" } },
      ],
    });
    // CSS idents cannot start with a digit — must be prefixed with _
    expect(r).toContain("@keyframes _2fast");
    expect(r).toContain("._2fast");
    expect(r).not.toContain("@keyframes 2fast");
  });
});
