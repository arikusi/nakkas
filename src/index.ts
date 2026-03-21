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
import { SVGConfigSlimSchema } from "./schemas/slim.js";
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
    description: `Render animated SVG from JSON config. AI controls all design parameters.

**Workflow:** render_svg > preview > critique > revise. Iterate at least 3 times before finalizing.

**Element types:** rect, circle, ellipse, line, polyline, polygon, path, image, text, textPath, group, use, radial-group, arc-group, grid-group, scatter-group, path-group, parametric

**Pattern groups** (use for repetitive designs): radial-group (circular), arc-group (arc), grid-group (matrix), scatter-group (random), path-group (along polyline). Each takes count + child element.

**Parametric curves** (fn field): rose, heart, lissajous, spiral, star, superformula, hypotrochoid, wave. Server computes coordinates.

**defs:** gradients (linear/radial, SMIL animated stops), filters (presets: glow, neon, blur, drop-shadow, glitch, chromatic-aberration, noise, outline, inner-shadow, emboss + 5 more), clipPaths, masks, patterns (tile fills).

**Animations:** CSS @keyframes via animations array. Set cssClass on element matching animation name. For transforms add transformBox="fill-box" transformOrigin="center". SMIL via smilAnimations on elements (animate, animateTransform, animateMotion).

**Output:** Pure SVG XML. No JavaScript. CSS @keyframes + SMIL only.`.trim(),
    inputSchema: SVGConfigSlimSchema,
  },
  async (rawConfig) => {
    const start = Date.now();
    try {
      // Validate with full schema for type safety and detailed errors
      const parseResult = SVGConfigSchema.safeParse(rawConfig);
      if (!parseResult.success) {
        const formatted = formatZodError(parseResult.error);
        console.error(`[nakkas] render_svg VALIDATION ERROR\n${formatted}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Config validation failed:\n${formatted}\n\nCommon fixes:\n- Missing required fields (canvas.width/height; rect needs width/height; circle needs r; path needs d)\n- Invalid hex color (must be #rrggbb or #rrggbbaa)\n- Gradient/filter id referenced before being defined in defs\n- Gradient needs at least 2 stops`,
            },
          ],
          isError: true,
        };
      }
      const config = parseResult.data;
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
