/**
 * Smoke tests: core rendering pipeline end-to-end.
 * All tests call renderSVG() with a validated SVGConfig.
 */

import { describe, it, expect } from "vitest";
import { SVGConfigSchema } from "../src/schemas/config.js";
import { renderSVG } from "../src/renderer/svg-renderer.js";

/** Parse raw config through Zod so defaults are applied and types align. */
function c(raw: Parameters<typeof SVGConfigSchema.parse>[0]) {
  return SVGConfigSchema.parse(raw);
}

describe("renderSVG — output structure", () => {
  it("returns a string that opens and closes with svg tags", () => {
    const svg = renderSVG(
      c({ canvas: { width: 100, height: 100 }, elements: [{ type: "rect", width: 50, height: 50 }] })
    );
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it("includes xmlns attribute", () => {
    const svg = renderSVG(
      c({ canvas: { width: 100, height: 100 }, elements: [{ type: "circle", cx: 50, cy: 50, r: 30 }] })
    );
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("includes width and height from canvas", () => {
    const svg = renderSVG(
      c({ canvas: { width: 800, height: 400 }, elements: [{ type: "rect", width: 10, height: 10 }] })
    );
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="400"');
  });

  it("includes viewBox when provided", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 800, height: 400, viewBox: "0 0 400 200" },
        elements: [{ type: "rect", width: 10, height: 10 }],
      })
    );
    expect(svg).toContain('viewBox="0 0 400 200"');
  });
});

describe("renderSVG — shapes", () => {
  it("renders rect with geometry attributes", () => {
    const svg = renderSVG(
      c({ canvas: { width: 200, height: 200 }, elements: [{ type: "rect", x: 10, y: 20, width: 80, height: 40 }] })
    );
    expect(svg).toContain("<rect");
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="20"');
    expect(svg).toContain('width="80"');
    expect(svg).toContain('height="40"');
  });

  it("renders rect rx for rounded corners", () => {
    const svg = renderSVG(
      c({ canvas: { width: 200, height: 200 }, elements: [{ type: "rect", width: 100, height: 50, rx: 8 }] })
    );
    expect(svg).toContain('rx="8"');
  });

  it("renders circle with cx/cy/r", () => {
    const svg = renderSVG(
      c({ canvas: { width: 200, height: 200 }, elements: [{ type: "circle", cx: 100, cy: 100, r: 40 }] })
    );
    expect(svg).toContain("<circle");
    expect(svg).toContain('cx="100"');
    expect(svg).toContain('cy="100"');
    expect(svg).toContain('r="40"');
  });

  it("renders ellipse", () => {
    const svg = renderSVG(
      c({ canvas: { width: 200, height: 200 }, elements: [{ type: "ellipse", cx: 100, cy: 100, rx: 60, ry: 30 }] })
    );
    expect(svg).toContain("<ellipse");
    expect(svg).toContain('rx="60"');
    expect(svg).toContain('ry="30"');
  });

  it("renders line", () => {
    const svg = renderSVG(
      c({ canvas: { width: 200, height: 200 }, elements: [{ type: "line", x1: 0, y1: 0, x2: 100, y2: 100 }] })
    );
    expect(svg).toContain("<line");
    expect(svg).toContain('x1="0"');
    expect(svg).toContain('x2="100"');
  });

  it("renders path with d attribute", () => {
    const svg = renderSVG(
      c({ canvas: { width: 200, height: 200 }, elements: [{ type: "path", d: "M 10 10 L 100 100 Z" }] })
    );
    expect(svg).toContain("<path");
    expect(svg).toContain('d="M 10 10 L 100 100 Z"');
  });

  it("renders polygon with points", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        elements: [{ type: "polygon", points: "50,10 90,90 10,90" }],
      })
    );
    expect(svg).toContain("<polygon");
    expect(svg).toContain('points="50,10 90,90 10,90"');
  });

  it("renders presentation attributes", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        elements: [{ type: "rect", width: 100, height: 50, fill: "#ff0000", stroke: "#000000", strokeWidth: 2, opacity: 0.8 }],
      })
    );
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('opacity="0.8"');
  });

  it("renders transformBox and transformOrigin as style attribute", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        elements: [{ type: "circle", cx: 100, cy: 100, r: 40, transformBox: "fill-box", transformOrigin: "center" }],
      })
    );
    expect(svg).toContain("transform-box:fill-box");
    expect(svg).toContain("transform-origin:center");
  });
});

describe("renderSVG — canvas background", () => {
  it("renders background rect when background is set", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 200, background: "#111111" },
        elements: [{ type: "rect", width: 10, height: 10 }],
      })
    );
    expect(svg).toContain('fill="#111111"');
    expect(svg).toContain('width="100%"');
  });

  it("renders comment for transparent background", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 200, background: "transparent" },
        elements: [{ type: "rect", width: 10, height: 10 }],
      })
    );
    expect(svg).toContain("transparent background");
  });

  it("escapes injection chars in canvas background value", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 100, height: 100, background: 'red" id="injected' },
        elements: [{ type: "rect", width: 10, height: 10 }],
      })
    );
    // double-quote is escaped to &quot; — injection prevented
    expect(svg).toContain("&quot;");
    expect(svg).not.toContain('id="injected"');
  });
});

describe("renderSVG — defs", () => {
  it("renders gradient inside defs block", () => {
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
        },
        elements: [{ type: "rect", width: 400, height: 200, fill: "url(#g1)" }],
      })
    );
    expect(svg).toContain("<defs>");
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain('id="g1"');
    expect(svg).toContain('fill="url(#g1)"');
  });

  it("renders filter inside defs block", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        defs: { filters: [{ type: "preset", id: "f1", preset: "blur", stdDeviation: 4 }] },
        elements: [{ type: "circle", cx: 100, cy: 100, r: 40, filter: "url(#f1)" }],
      })
    );
    expect(svg).toContain("<filter");
    expect(svg).toContain('id="f1"');
    expect(svg).toContain("feGaussianBlur");
  });

  it("renders hidden path for textPath in defs", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 200 },
        defs: { paths: [{ id: "curve", d: "M 10 80 Q 95 10 180 80" }] },
        elements: [{ type: "textPath", pathId: "curve", text: "Text along path" }],
      })
    );
    expect(svg).toContain('<path id="curve"');
    expect(svg).toContain('fill="none"');
  });
});

describe("renderSVG — text", () => {
  it("renders text element with content", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 100 },
        elements: [{ type: "text", x: 100, y: 50, content: "Hello World" }],
      })
    );
    expect(svg).toContain("<text");
    expect(svg).toContain("Hello World");
  });

  it("escapes special characters in text content", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 100 },
        elements: [{ type: "text", x: 10, y: 50, content: '<script>alert("xss")</script>' }],
      })
    );
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("renders font attributes as SVG attributes", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 300, height: 100 },
        elements: [{ type: "text", x: 10, y: 50, content: "Hi", fontFamily: "monospace", fontSize: 20, fontWeight: "bold" }],
      })
    );
    expect(svg).toContain('font-family="monospace"');
    expect(svg).toContain('font-size="20"');
    expect(svg).toContain('font-weight="bold"');
  });
});

describe("renderSVG — image element", () => {
  it("renders image element with href, width, height", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 300 },
        elements: [{ type: "image", href: "https://example.com/photo.png", x: 10, y: 10, width: 200, height: 150 }],
      })
    );
    expect(svg).toContain("<image");
    expect(svg).toContain('href="https://example.com/photo.png"');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="150"');
  });

  it("renders image with preserveAspectRatio", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 400, height: 300 },
        elements: [{ type: "image", href: "data:image/png;base64,abc123", width: 100, height: 100, preserveAspectRatio: "xMidYMid slice" }],
      })
    );
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
  });
});

describe("renderSVG — groups", () => {
  it("renders group with g tag containing children", () => {
    const svg = renderSVG(
      c({
        canvas: { width: 200, height: 200 },
        elements: [
          {
            type: "group",
            transform: "translate(50, 50)",
            children: [{ type: "circle", cx: 0, cy: 0, r: 20, fill: "#ff0000" }],
          },
        ],
      })
    );
    expect(svg).toContain("<g");
    expect(svg).toContain('transform="translate(50, 50)"');
    expect(svg).toContain("<circle");
    expect(svg).toContain("</g>");
  });
});
