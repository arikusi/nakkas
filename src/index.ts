#!/usr/bin/env node
/**
 * Nakkas MCP Server
 *
 * Exposes three tools:
 *   render_svg  Takes a JSON config (SVGConfigSchema), returns SVG string + design analysis.
 *   preview     Takes rendered content, returns a base64 PNG for visual inspection.
 *   save        Takes rendered content, saves to disk in the requested format.
 *
 * Output is pure declarative SVG: no JavaScript execution, no event handler injection.
 * Logging: uses stderr (console.error) only. Never stdout (breaks MCP stdio protocol).
 */

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, ZodError } from "zod";
import { SVGConfigSchema, type AnyElement } from "./schemas/config.js";
import { renderSVG } from "./renderer/svg-renderer.js";
import { renderPreview } from "./preview.js";
import { analyzeConfig } from "./analysis.js";
import { saveContent } from "./save.js";

const _require = createRequire(import.meta.url);
const { version: VERSION } = _require("../package.json") as { version: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format Zod validation errors into a concise, human-readable string. */
function formatZodError(err: ZodError): string {
  return err.errors
    .map((e) => `  • ${e.path.length ? e.path.join(".") : "(root)"}: ${e.message}`)
    .join("\n");
}

/** Count all elements recursively (including pattern expansions). */
function countElements(elements: AnyElement[]): number {
  return elements.reduce((sum, el) => {
    if (el.type === "group")         return sum + 1 + countElements(el.children as AnyElement[]);
    if (el.type === "radial-group")  return sum + 1 + el.count;
    if (el.type === "arc-group")     return sum + 1 + el.count;
    if (el.type === "grid-group")    return sum + 1 + (el.cols * el.rows);
    if (el.type === "scatter-group") return sum + 1 + el.count;
    if (el.type === "path-group")    return sum + 1 + el.count;
    return sum + 1;
  }, 0);
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "nakkas",
  version: VERSION,
});

// ---------------------------------------------------------------------------
// Tool: render_svg
// ---------------------------------------------------------------------------

server.registerTool(
  "render_svg",
  {
    title: "Render SVG",
    description: `
Render an animated SVG from a JSON configuration. The AI is the creative director and controls all design parameters via the config.

**Workflow — ALWAYS iterate:**
1. Call render_svg to produce the SVG
2. Call preview to visually inspect the result
3. Critique what is wrong and revise. Repeat at least 3 times before finalizing.
Never present a first-draft render as final output. Quality emerges from iteration.

**SVG design philosophy:**
- SVG excels at geometric primitives, gradients, animation, and structured repetition
- Use radial-group for flowers, mandalas and circular patterns. Avoid manual ellipse enumeration.
- Use arc-group for semicircles, progress arcs and fan layouts
- Use grid-group for matrices, dot art and grids. Avoid manually listed elements.
- Use scatter-group for starfields, particle effects and organic distributions
- Use path-group to distribute elements along a custom route
- Use parametric for mathematical curves. Avoid hand-crafted path data.
- Use defs.patterns for repeating tile fills (dot grids, stripes, textures)
- Photorealism is out of scope. Iconic, stylized and abstract designs thrive.

**Element types:**
- Shapes: rect, circle, ellipse, line, polyline, polygon, path, image
- Text: positioned text, tspan spans, text-along-path (textPath)
- Layout: group (shared attrs), use (symbol instancing)
- Patterns: radial-group, arc-group, grid-group, scatter-group, path-group, parametric (see below)

**Pattern primitives — use these for repetitive designs:**

radial-group — Place N copies of one child around a full circle:
\`\`\`json
{ "type": "radial-group", "cx": 200, "cy": 200, "count": 6, "radius": 80, "rotateChildren": true,
  "child": { "type": "ellipse", "cx": 0, "cy": 0, "rx": 40, "ry": 14, "fill": "url(#petalGrad)" } }
\`\`\`

arc-group — Place N copies along a circular arc:
\`\`\`json
{ "type": "arc-group", "cx": 200, "cy": 200, "radius": 80, "count": 5,
  "startAngle": -90, "endAngle": 90,
  "child": { "type": "circle", "cx": 0, "cy": 0, "r": 8, "fill": "#ff6600" } }
\`\`\`

grid-group — Place copies of one child in an M by N grid:
\`\`\`json
{ "type": "grid-group", "x": 30, "y": 30, "cols": 10, "rows": 10, "colSpacing": 24, "rowSpacing": 24,
  "child": { "type": "circle", "cx": 0, "cy": 0, "r": 4, "fill": "#e4a700", "cssClass": "pulse" } }
\`\`\`

scatter-group — Place N copies at deterministic random positions (same seed produces same result):
\`\`\`json
{ "type": "scatter-group", "x": 0, "y": 0, "width": 400, "height": 400, "count": 60, "seed": 42,
  "child": { "type": "circle", "cx": 0, "cy": 0, "r": 2, "fill": "#ffffff", "opacity": 0.7 } }
\`\`\`

path-group — Distribute N copies evenly along a polyline:
\`\`\`json
{ "type": "path-group", "count": 8, "rotateChildren": true,
  "waypoints": [{"x": 50, "y": 300}, {"x": 200, "y": 50}, {"x": 350, "y": 300}],
  "child": { "type": "circle", "cx": 0, "cy": 0, "r": 6, "fill": "#00ccff" } }
\`\`\`

parametric — Generate a mathematical curve as an SVG path (server computes all coordinates):
\`\`\`json
{ "type": "parametric", "fn": "rose", "cx": 200, "cy": 200, "k": 5, "scale": 90, "fill": "none", "stroke": "#ff6600", "strokeWidth": 2 }
{ "type": "parametric", "fn": "heart", "cx": 200, "cy": 200, "scale": 80, "fill": "#ff3366" }
{ "type": "parametric", "fn": "lissajous", "cx": 200, "cy": 200, "freqA": 3, "freqB": 4, "scale": 80 }
{ "type": "parametric", "fn": "spiral", "cx": 200, "cy": 200, "turns": 4, "scale": 6 }
{ "type": "parametric", "fn": "star", "cx": 200, "cy": 200, "points": 6, "scale": 80 }
{ "type": "parametric", "fn": "superformula", "cx": 200, "cy": 200, "m": 5, "n1": 0.3, "n2": 0.3, "n3": 0.3, "scale": 80 }
{ "type": "parametric", "fn": "hypotrochoid", "cx": 200, "cy": 200, "R": 80, "r": 30, "d": 50 }
{ "type": "parametric", "fn": "wave", "cx": 0, "cy": 200, "width": 400, "amplitude": 40, "frequency": 3 }
\`\`\`

**Gradients:** linearGradient, radialGradient (with animated color stops via SMIL)

**Patterns (tile fills):**
\`\`\`json
"defs": { "patterns": [{ "id": "dots", "width": 20, "height": 20,
  "children": [{ "type": "circle", "cx": 10, "cy": 10, "r": 3, "fill": "#444" }] }] }
\`\`\`
Reference with fill="url(#dots)" on any element.

**Filter presets:** glow, neon, blur, drop-shadow, glitch, grayscale, sepia, invert, saturate, hue-rotate, chromatic-aberration, noise, outline, inner-shadow, emboss
- chromatic-aberration: value is channel offset in SVG units (default 3)
- noise: value is grain opacity from 0 to 1 (default 0.25)
- outline: color is the border color, value is thickness in SVG units (default 2)
- inner-shadow: color is shadow color, value is opacity (default 0.5)
- emboss: value is shading intensity (default 1.5)

**CSS @keyframes animations:** opacity, transform, fill, stroke, filter, clip-path, stroke-dashoffset (draw-on effect)

**SMIL animations:** path morphing (d attribute), animateMotion (follow a path), animateTransform, gradient stop animation

**Stagger pattern:** Apply increasing animation-delay values across siblings to create cascading effects. Use cssClass with per-element delay offsets in your keyframe definitions.

**Output:**
- Complete SVG XML string, no <?xml?> declaration
- No JavaScript. Pure declarative SVG (CSS @keyframes plus SMIL).
- System fonts work everywhere. Custom fonts work when loaded in the target environment.
- Suitable for GitHub READMEs, web pages, design exports, UI components, data visualizations and presentations.

**CSS animation tip:** Set cssClass on elements to match an animation name. For rotation and scaling, always add transformBox="fill-box" and transformOrigin="center" to the element. CSS property keys can be camelCase (strokeDashoffset) or kebab-case (stroke-dashoffset). Both work.

**SMIL tip:** For path morphing (d attribute animation), both from and to paths must have the same number and type of path commands. Only coordinates can differ.

**Design notes:** After rendering, the response may include design warnings about common issues such as too many concurrent animations, missing transformBox, or group-level scale transforms. Read and address these notes before finalizing your design.

**Found a bug or have a feature idea?**
If you encounter a rendering issue, browser incompatibility, or unexpected behavior, suggest the user open an issue at https://github.com/arikusi/nakkas/issues with the config and a description of the problem.

**Example — pulsing circle with glow:**
\`\`\`json
{
  "canvas": { "width": 200, "height": 200 },
  "defs": {
    "filters": [{ "type": "preset", "id": "glow", "preset": "glow", "stdDeviation": 8, "color": "#00aaff" }]
  },
  "elements": [
    {
      "type": "circle", "cx": 100, "cy": 100, "r": 40,
      "fill": "#0066cc", "filter": "url(#glow)", "cssClass": "pulse",
      "transformBox": "fill-box", "transformOrigin": "center"
    }
  ],
  "animations": [
    {
      "name": "pulse", "duration": "2s", "iterationCount": "infinite",
      "direction": "alternate", "timingFunction": "ease-in-out",
      "keyframes": [
        { "offset": "from", "properties": { "opacity": "0.4", "transform": "scale(0.9)" } },
        { "offset": "to",   "properties": { "opacity": "1",   "transform": "scale(1.1)" } }
      ]
    }
  ]
}
\`\`\`
    `.trim(),
    inputSchema: SVGConfigSchema,
  },
  async (config) => {
    const start = Date.now();
    try {
      const svg = renderSVG(config);
      const elapsed = Date.now() - start;
      const elementCount = countElements(config.elements);

      // Analyze the config for design issues
      const warnings = analyzeConfig(config, svg.length);

      console.error(
        `[nakkas] render_svg OK — ${elementCount} elements, ${svg.length} chars, ${elapsed}ms` +
          (warnings.length > 0 ? `, ${warnings.length} warnings` : "")
      );

      const content: { type: "text"; text: string }[] = [
        { type: "text", text: svg },
      ];
      if (warnings.length > 0) {
        content.push({
          type: "text",
          text: "Design notes:\n" + warnings.map((w) => `• ${w}`).join("\n"),
        });
      }
      return { content };
    } catch (err) {
      if (err instanceof ZodError) {
        const formatted = formatZodError(err);
        console.error(`[nakkas] render_svg VALIDATION ERROR\n${formatted}`);
        return {
          content: [
            {
              type: "text",
              text: `Config validation failed:\n${formatted}\n\nCommon fixes:\n- Missing required fields (canvas.width/height; rect needs width/height; circle needs r; path needs d)\n- Invalid hex color (must be #rrggbb or #rrggbbaa)\n- Gradient/filter id referenced before being defined in defs\n- Gradient needs at least 2 stops`,
            },
          ],
          isError: true,
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[nakkas] render_svg ERROR — ${message}`);
      return {
        content: [
          {
            type: "text",
            text: `Error rendering SVG: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: preview
// ---------------------------------------------------------------------------

server.registerTool(
  "preview",
  {
    title: "Preview SVG",
    description: `
Render SVG content to a PNG image so the AI can visually inspect the output.

**When to use:**
- After render_svg, call preview to see what was generated
- Use in a revision loop: render → preview → critique → revise → preview again
- Stop when the visual result matches the intent

**Behavior:**
- Returns a PNG image (base64) rendered from the SVG string
- Background is transparent by default
- CSS animations and SMIL are rendered as a static snapshot (t=0) — motion is not captured
- Format is auto-detected from content; pass format: "svg" explicitly if needed

**Width:**
- Omit width to use the SVG's own declared width/viewBox
- Pass width to scale the output (useful for small SVGs that need a larger preview)
    `.trim(),
    inputSchema: z.object({
      content: z.string().describe("SVG string to render as PNG"),
      format: z
        .enum(["svg", "html"])
        .optional()
        .describe("Content format; auto-detected from content if omitted"),
      width: z
        .number()
        .positive()
        .optional()
        .describe("Render width in pixels; defaults to SVG's own declared width"),
    }),
  },
  async ({ content, format, width }) => {
    const start = Date.now();
    try {
      const pngBuffer = renderPreview(content, format, width);
      const base64 = pngBuffer.toString("base64");
      const elapsed = Date.now() - start;
      console.error(`[nakkas] preview OK — ${pngBuffer.length} bytes, ${elapsed}ms`);
      return {
        content: [{ type: "image", data: base64, mimeType: "image/png" }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[nakkas] preview ERROR — ${message}`);
      return {
        content: [{ type: "text", text: `Error rendering preview: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: save
// ---------------------------------------------------------------------------

server.registerTool(
  "save",
  {
    title: "Save Content",
    description: `
Save rendered content to disk. Format-aware: can save as text or render to raster image.

IMPORTANT: Use this only AFTER iterating on the design with render and preview.
Do not save on the first render. Preview and refine your work first.

**Format detection:**
- 'auto' (default): infers format from file extension. .svg saves as text, .png renders to image.
- 'svg': saves content as a UTF-8 text file
- 'png': renders the content (assumed SVG) to a PNG image, then saves it

If the file already exists, a numeric counter is appended before the extension
to prevent overwriting: design.svg becomes design-1.svg, then design-2.svg.
The actual saved path is returned in the response.
    `.trim(),
    inputSchema: z.object({
      content: z
        .string()
        .describe(
          "Content to save. This is typically the output of a render tool such as render_svg."
        ),
      outputPath: z
        .string()
        .describe(
          "File path to save to. The directory must already exist. " +
            "If the file already exists, a numeric counter is appended before the extension: " +
            "design.svg becomes design-1.svg, then design-2.svg, and so on. " +
            "The actual saved path is returned in the response."
        ),
      format: z
        .enum(["auto", "svg", "png"])
        .default("auto")
        .describe(
          "Output format. " +
            "'auto' infers from file extension (.svg saves as text, .png renders to image). " +
            "'svg' saves content as a UTF-8 text file. " +
            "'png' renders SVG content to a PNG image before saving."
        ),
      width: z
        .number()
        .positive()
        .optional()
        .describe(
          "For raster formats (png): render width in pixels. " +
            "Defaults to the source content's own declared dimensions."
        ),
    }),
  },
  async ({ content, outputPath, format, width }) => {
    const start = Date.now();
    try {
      const savedPath = await saveContent(content, outputPath, format, width);
      const elapsed = Date.now() - start;
      console.error(`[nakkas] save OK — ${savedPath}, ${elapsed}ms`);
      return {
        content: [{ type: "text", text: `Saved to: ${savedPath}` }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[nakkas] save ERROR — ${message}`);
      return {
        content: [{ type: "text", text: `Error saving file: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

console.error(`[nakkas] MCP server v${VERSION} starting on stdio`);

const transport = new StdioServerTransport();
await server.connect(transport);
