/**
 * GitHub README compatibility tests.
 *
 * GitHub renders SVGs through Camo proxy and sanitizes them as <img> tags.
 * Critical constraints:
 * - No <script> — stripped unconditionally
 * - No event handlers (onclick, onload, etc.) — stripped
 * - No javascript: URIs
 * - No <foreignObject> (stripped)
 * - No external resource URLs
 * - Only system fonts work
 * - SMIL begin="click" silently ignored (SVG in <img> = no user interaction)
 *
 * These tests verify the renderer never emits forbidden constructs,
 * even when input contains adversarial strings.
 */

import { describe, it, expect } from "vitest";
import { SVGConfigSchema } from "../src/schemas/config.js";
import { renderSVG } from "../src/renderer/svg-renderer.js";
import { isSafeValue, escapeXml } from "../src/renderer/utils.js";

function c(raw: Parameters<typeof SVGConfigSchema.parse>[0]) {
  return SVGConfigSchema.parse(raw);
}

const MINIMAL = {
  canvas: { width: 200, height: 100 },
  elements: [{ type: "rect" as const, width: 100, height: 50 }],
};

// ---------------------------------------------------------------------------
// No forbidden elements
// ---------------------------------------------------------------------------

describe("no forbidden SVG elements", () => {
  it("output never contains <script> tag", () => {
    const svg = renderSVG(c(MINIMAL));
    expect(svg).not.toContain("<script");
  });

  it("output never contains <foreignObject>", () => {
    const svg = renderSVG(c(MINIMAL));
    expect(svg).not.toContain("foreignObject");
  });

  it("complex config with all features has no <script>", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 200 },
        defs: {
          gradients: [
            {
              type: "linearGradient",
              id: "g1",
              stops: [{ offset: 0, color: "#ff0000" }, { offset: 1, color: "#0000ff" }],
            },
          ],
          filters: [{ type: "preset", id: "f1", preset: "glow" }],
        },
        animations: [
          {
            name: "fade",
            duration: "2s",
            iterationCount: "infinite",
            keyframes: [
              { offset: "from", properties: { opacity: "0" } },
              { offset: "to", properties: { opacity: "1" } },
            ],
          },
        ],
        elements: [
          {
            type: "rect",
            width: 400,
            height: 200,
            fill: "url(#g1)",
            filter: "url(#f1)",
            cssClass: "fade",
          },
        ],
      })
    );
    expect(svg).not.toContain("<script");
  });
});

// ---------------------------------------------------------------------------
// XSS: user-controlled string escaping
// ---------------------------------------------------------------------------

describe("XSS prevention — text content", () => {
  it("escapes < > in text content", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 100 },
        elements: [{ type: "text", x: 10, y: 50, content: "<b>bold</b>" }],
      })
    );
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("&lt;b&gt;");
  });

  it("escapes & in text content", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 100 },
        elements: [{ type: "text", x: 10, y: 50, content: "A & B" }],
      })
    );
    expect(svg).not.toContain(" & ");
    expect(svg).toContain("&amp;");
  });

  it("escapes quotes in text content", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 100 },
        elements: [{ type: "text", x: 10, y: 50, content: 'Say "hello"' }],
      })
    );
    // " inside text content should be escaped
    expect(svg).not.toMatch(/>Say "hello"</);
    expect(svg).toContain("&quot;");
  });

  it("XSS script injection in text content is escaped", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 100 },
        elements: [{ type: "text", x: 10, y: 50, content: '<script>alert(1)</script>' }],
      })
    );
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
});

// ---------------------------------------------------------------------------
// isSafeValue — security guard
// ---------------------------------------------------------------------------

describe("isSafeValue", () => {
  it("blocks onclick= event handler", () => {
    expect(isSafeValue("onclick=alert(1)")).toBe(false);
  });

  it("blocks onload= event handler", () => {
    expect(isSafeValue("onload=doEvil()")).toBe(false);
  });

  it("blocks onmouseover= event handler", () => {
    expect(isSafeValue("onmouseover=steal()")).toBe(false);
  });

  it("blocks javascript: URI", () => {
    expect(isSafeValue("javascript:alert(1)")).toBe(false);
  });

  it("blocks javascript: URI with leading whitespace", () => {
    expect(isSafeValue("  javascript:alert(1)")).toBe(false);
  });

  it("blocks data URI with script", () => {
    expect(isSafeValue("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBe(false);
  });

  it("allows hex colors", () => {
    expect(isSafeValue("#ff0000")).toBe(true);
  });

  it("allows url() gradient references", () => {
    expect(isSafeValue("url(#gradientId)")).toBe(true);
  });

  it("allows transform strings", () => {
    expect(isSafeValue("rotate(45)")).toBe(true);
    expect(isSafeValue("translate(100, 50)")).toBe(true);
  });

  it("allows normal text content", () => {
    expect(isSafeValue("Hello World")).toBe(true);
  });

  it("allows percentage values", () => {
    expect(isSafeValue("50%")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// escapeXml
// ---------------------------------------------------------------------------

describe("escapeXml", () => {
  it("escapes & to &amp;", () => {
    expect(escapeXml("a & b")).toBe("a &amp; b");
  });

  it("escapes < to &lt;", () => {
    expect(escapeXml("<tag>")).toBe("&lt;tag&gt;");
  });

  it("escapes \" to &quot;", () => {
    expect(escapeXml('"quoted"')).toBe("&quot;quoted&quot;");
  });

  it("escapes ' to &apos;", () => {
    expect(escapeXml("it's")).toBe("it&apos;s");
  });

  it("leaves safe characters unchanged", () => {
    expect(escapeXml("hello world 123")).toBe("hello world 123");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// SVG structure requirements for GitHub
// ---------------------------------------------------------------------------

describe("SVG structure for GitHub README", () => {
  it("root svg tag has xmlns attribute", () => {
    const svg = renderSVG(c(MINIMAL));
    expect(svg).toMatch(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it("output is well-formed (opening tags match closing tags for key elements)", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 200 },
        elements: [
          { type: "group", children: [{ type: "circle", cx: 50, cy: 50, r: 20 }] },
        ],
      })
    );
    expect(svg).toContain("<g");
    expect(svg).toContain("</g>");
    expect(svg).toContain("</svg>");
  });

  it("CSS animation does not use var() (unreliable in GitHub)", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 100 },
        animations: [
          {
            name: "test",
            duration: "1s",
            keyframes: [
              { offset: "from", properties: { opacity: "0" } },
              { offset: "to", properties: { opacity: "1" } },
            ],
          },
        ],
        elements: [{ type: "rect", width: 100, height: 50, cssClass: "test" }],
      })
    );
    // Renderer doesn't inject var() — generated CSS should not contain it
    const styleMatch = svg.match(/<style>([\s\S]*?)<\/style>/);
    if (styleMatch) {
      expect(styleMatch[1]).not.toContain("var(");
    }
  });

  it("SMIL animate does not require click interaction for basic animations", () => {
    // Our schema allows begin="click" (documented as not working in GitHub)
    // but the renderer does NOT inject begin="click" automatically
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        elements: [
          {
            type: "circle",
            cx: 100,
            cy: 100,
            r: 40,
            smilAnimations: [
              { kind: "animate", attributeName: "r", from: "40", to: "60", dur: "2s", repeatCount: "indefinite" },
            ],
          },
        ],
      })
    );
    // The animate should be there, without begin="click"
    expect(svg).toContain("<animate");
    expect(svg).not.toContain('begin="click"');
  });
});
