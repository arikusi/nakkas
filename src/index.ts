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
import { z } from "zod";
import { SVGConfigSchema, type AnyElement } from "./schemas/config.js";
import { SVGConfigSlimSchema } from "./schemas/slim.js";
import { renderSVG } from "./renderer/svg-renderer.js";
import { drainRenderWarnings, minifySVG } from "./renderer/utils.js";
import { storeArtifact, getArtifact, listArtifactIds } from "./artifacts.js";
import { explainConfigError } from "./validation.js";
import { checkReferences } from "./refcheck.js";
import { renderPreview, svgToPng } from "./preview.js";
import { analyzeConfig } from "./analysis.js";
import { saveContent } from "./save.js";
import { bakeFrame, configTimeline, allInfinite } from "./eyes/sampler.js";
import { buildFilmstrip, type FilmstripFrame } from "./eyes/filmstrip.js";
import { checkContentBounds, checkTextContrast } from "./eyes/audit.js";
import { num } from "./renderer/utils.js";

const _require = createRequire(import.meta.url);
const { version: VERSION } = _require("../package.json") as { version: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

/**
 * Resolve tool input that may arrive as inline content or an artifact id.
 * Returns the content string, or an error message string prefixed with "!".
 */
function resolveContent(content?: string, artifact?: string): { svg: string } | { error: string } {
  if (artifact !== undefined) {
    const stored = getArtifact(artifact);
    if (stored === undefined) {
      const live = listArtifactIds();
      return {
        error:
          `Unknown artifact "${artifact}". ` +
          (live.length > 0
            ? `Live artifacts: ${live.join(", ")}.`
            : "No artifacts are stored — artifacts live only for the server process lifetime.") +
          " Re-render with render_svg to get a fresh artifact id.",
      };
    }
    return { svg: stored };
  }
  if (content !== undefined) return { svg: content };
  return { error: "Provide either 'artifact' (id from render_svg) or 'content' (SVG string)." };
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

**Workflow:** render_svg returns a PNG preview of the result plus an artifact id — critique the image, revise the config, render again. Iterate at least 3 times before finalizing. The SVG text stays on the server: pass the artifact id to save (and to preview for a different width). Add output:{svg:true} only if you actually need the SVG text in the conversation.

**output options (response shape, not content):** {"svg":false,"preview":true,"previewWidth":800,"minify":false,"frames":4} — all optional. minify:true collapses whitespace in the stored/saved SVG. frames:N (2-10) replaces the static preview with one filmstrip image sampling the CSS animations at N times — use it to verify motion (rotation direction, timing, easing) since a single preview only shows t=0. SMIL is not sampled.

**Element types:** rect, circle, ellipse, line, polyline, polygon, path, image, text, textPath, group, use, radial-group, arc-group, grid-group, scatter-group, path-group, parametric

**Pattern groups** (use for repetitive designs): radial-group (circular: cx, cy, radius, count), arc-group (arc: cx, cy, radius, count, startAngle, endAngle), grid-group (matrix: cols, rows, colSpacing, rowSpacing), scatter-group (random: width, height, count, seed), path-group (along polyline: waypoints, count). Each takes ONE "child" element. The child is drawn at the local origin and, with rotateChildren true (the default), rotates so local +x points outward from the center: draw spokes, rays and petals long along the x axis, never the y axis, or they render as a chord ring.

**Parametric curves** (fn field): rose, heart, lissajous, spiral, star, superformula, epitrochoid, hypotrochoid, wave. Size via "scale" field. Server computes coordinates.

**defs:** gradients (linear/radial, SMIL animated stops), filters (presets: glow, neon, blur, drop-shadow, glitch, chromatic-aberration, noise, outline, inner-shadow, emboss + 5 more), clipPaths, masks, patterns (tile fills).

**Animations:** CSS @keyframes via animations array. Set cssClass on element matching animation name. For transforms add transformBox="fill-box" transformOrigin="center". SMIL via smilAnimations on elements (animate, animateTransform, animateMotion).

**Design guide (what makes output look good):** Pick one spacing unit (e.g. 8) and use multiples of it for every gap and margin; keep content clear of the canvas edges by at least 5% of the smaller dimension (the bbox audit reports overflow in px). Use at most 3 font sizes per design with clear jumps (e.g. 12/16/24). Body-size text needs 4.5:1 contrast against its background, 3:1 from 24px up (the contrast audit checks plain hex pairs). Motion: ease-out for entrances, ease-in-out for back-and-forth loops, linear only for continuous rotation or travel; 0.8-3s durations read well for UI-scale loops.

**Critical format rules:**
- Gradient type must be "linearGradient" or "radialGradient" (not "linear"/"radial"). Each needs id, stops (array with offset 0-1, color).
- Filter type must be "preset" with a "preset" field: {"type":"preset","id":"myGlow","preset":"glow","stdDeviation":8,"color":"#ff00ff"}
- Keyframe offset: use "from"/"to" or percentage number 0-100 (not "0%"/"100%").
- Gradient stop and filter colors: hex only (#rrggbb or #rrggbbaa). Element fill/stroke accept '#rrggbb', 'none', or 'url(#id)' (hex is safest).
- Every element needs "type" field. circle needs r, rect needs width+height, path needs d.

**Field names that differ from raw SVG:**
- text: string goes in "content" (not "text"): {"type":"text","x":100,"y":50,"content":"Hello","fontSize":24,"textAnchor":"middle"}
- textPath: {"type":"textPath","pathId":"idFromDefsPaths","text":"..."} — here the field IS "text".
- group: {"type":"group","children":[...]} — children are shapes/text/use only, no nested groups.
- Pattern groups take ONE "child" element drawn at local origin (child uses cx=0/cy=0); set rotateChildren:false to keep text upright.

**Output:** Pure SVG XML. No JavaScript. CSS @keyframes + SMIL only.`.trim(),
    inputSchema: SVGConfigSlimSchema,
  },
  async (rawConfig) => {
    const start = Date.now();
    try {
      // Validate with full schema for type safety and detailed errors
      const parseResult = SVGConfigSchema.safeParse(rawConfig);
      if (!parseResult.success) {
        const formatted = explainConfigError(rawConfig, parseResult.error);
        console.error(`[nakkas] render_svg VALIDATION ERROR\n${formatted}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Config validation failed:\n${formatted}\n\nCommon fixes:\n- Gradient type must be "linearGradient" or "radialGradient" (not "linear"/"radial")\n- Filter needs type:"preset" with preset field: {"type":"preset","id":"x","preset":"glow","stdDeviation":8,"color":"#ff00ff"}\n- Keyframe offset: "from"/"to" or number 0-100 (not "0%"/"100%")\n- Gradient stop and filter colors must be hex (#rrggbb or #rrggbbaa); fill/stroke accept '#rrggbb', 'none', or 'url(#id)'\n- Every element needs "type". circle needs r, rect needs width+height, path needs d\n- Gradient needs at least 2 stops with offset (0-1) and color`,
            },
          ],
          isError: true,
        };
      }
      const config = parseResult.data;

      // Schema-valid configs can still be internally broken: dangling
      // url(#id) references and duplicate IDs render wrong output with no
      // visible cause. Catch them here, before a wasted preview round-trip.
      const refErrors = checkReferences(config);
      if (refErrors.length > 0) {
        const formatted = refErrors.map((e) => `  • ${e}`).join("\n");
        console.error(`[nakkas] render_svg REFERENCE ERROR\n${formatted}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Config has broken references:\n${formatted}\n\nEvery url(#id), use.href and textPath.pathId must point at an id defined in defs or on an element, and all IDs must be unique.`,
            },
          ],
          isError: true,
        };
      }

      const out = config.output ?? {};

      drainRenderWarnings(); // discard leftovers from any earlier failed render
      let svg = renderSVG(config);
      if (out.minify) svg = minifySVG(svg);
      const renderWarnings = drainRenderWarnings();
      const elapsed = Date.now() - start;
      const elementCount = countElements(config.elements);

      // Analyze the config for design issues, then audit the rendered result
      // (bounding box overflow needs the rasterizer's layout knowledge)
      const warnings = [
        ...renderWarnings,
        ...analyzeConfig(config, svg.length),
        ...checkContentBounds(svg, config),
        ...checkTextContrast(config),
      ];

      const artifactId = storeArtifact(svg);
      const content: ContentBlock[] = [];

      // SVG text only on request — the artifact id covers preview and save.
      if (out.svg) {
        content.push({ type: "text", text: svg });
      }

      let frameLine: string | undefined;
      if (out.frames !== undefined && (config.animations?.length ?? 0) === 0) {
        warnings.push("output.frames was requested but the config has no CSS animations; returning the single static preview.");
      }

      if (out.frames !== undefined && (config.animations?.length ?? 0) > 0) {
        // Animation filmstrip: sample the keyframe math at N times and
        // compose one labeled strip image.
        try {
          const n = out.frames;
          const timeline = configTimeline(config);
          const loop = allInfinite(config);
          // Looping animations: t=T equals t=0, so stop one step short.
          const times = Array.from({ length: n }, (_, i) =>
            (timeline * i) / (loop ? n : n - 1)
          );

          const canvasW = typeof config.canvas.width === "number" ? config.canvas.width : 400;
          const canvasH = typeof config.canvas.height === "number" ? config.canvas.height : 300;
          const frameW = Math.min(out.previewWidth ?? canvasW, Math.floor(1600 / n));
          const frameH = Math.round((frameW * canvasH) / canvasW);

          const frames: FilmstripFrame[] = [];
          const frameNotes = new Set<string>();
          for (const t of times) {
            const baked = bakeFrame(config, t);
            baked.notes.forEach((note) => frameNotes.add(note));
            const frameSvg = renderSVG(baked.config);
            frames.push({ png: svgToPng(frameSvg, frameW), label: `t=${num(t, 2)}s` });
          }
          drainRenderWarnings(); // frame renders may repeat the main render's warnings

          const strip = buildFilmstrip(frames, frameW, frameH);
          content.push({ type: "image", data: strip.toString("base64"), mimeType: "image/png" });
          frameLine = `Filmstrip: ${n} frames across ${num(timeline, 2)}s (${times.map((t) => `${num(t, 2)}s`).join(", ")}).`;
          frameNotes.forEach((note) => warnings.push(note));
        } catch (frameErr) {
          const msg = frameErr instanceof Error ? frameErr.message : String(frameErr);
          warnings.push(`Frame sampling failed: ${msg}. Falling back to the static preview.`);
        }
      }

      if (out.preview !== false && !content.some((c) => c.type === "image")) {
        try {
          const png = renderPreview(svg, "svg", out.previewWidth);
          content.push({ type: "image", data: png.toString("base64"), mimeType: "image/png" });
        } catch (previewErr) {
          const msg = previewErr instanceof Error ? previewErr.message : String(previewErr);
          warnings.push(
            `Preview rendering failed: ${msg}. The SVG itself rendered; ` +
              `inspect it with preview({artifact:"${artifactId}"}) or re-render with output:{svg:true}.`
          );
        }
      }

      const summary: string[] = [
        `Rendered OK: artifact "${artifactId}" — ${svg.length} chars, ${elementCount} elements.`,
        ...(frameLine ? [frameLine] : []),
        `Use save({artifact:"${artifactId}", outputPath:...}) or preview({artifact:"${artifactId}", width:...}); ` +
          `the SVG text does not need to pass through context.`,
      ];
      if (!out.svg) {
        summary.push(`Need the SVG text itself? Re-render with output:{svg:true}.`);
      }
      if (warnings.length > 0) {
        summary.push("", "Design notes:", ...warnings.map((w) => `• ${w}`));
      }
      content.push({ type: "text", text: summary.join("\n") });

      console.error(
        `[nakkas] render_svg OK — ${artifactId}, ${elementCount} elements, ${svg.length} chars, ${elapsed}ms` +
          (warnings.length > 0 ? `, ${warnings.length} warnings` : "")
      );

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
- render_svg already returns a preview image by default; call this tool to re-preview a stored artifact at a different width, or to preview SVG that did not come from render_svg
- Stop iterating when the visual result matches the intent

**Input:** pass EITHER artifact (id from render_svg, e.g. "art-1" — preferred, no SVG resend) OR content (raw SVG string).

**Behavior:**
- Returns a PNG image (base64) rendered from the SVG
- Background is transparent by default
- CSS animations and SMIL are rendered as a static snapshot (t=0) — motion is not captured

**Width:**
- Omit width to use the SVG's own declared width/viewBox
- Pass width to scale the output (useful for small SVGs that need a larger preview)
    `.trim(),
    inputSchema: z.object({
      artifact: z
        .string()
        .optional()
        .describe('Artifact id returned by render_svg (e.g. "art-1"). Preferred over content.'),
      content: z
        .string()
        .optional()
        .describe("SVG string to render as PNG. Only needed when no artifact id exists."),
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
  async ({ artifact, content, format, width }) => {
    const start = Date.now();
    try {
      const resolved = resolveContent(content, artifact);
      if ("error" in resolved) {
        console.error(`[nakkas] preview INPUT ERROR — ${resolved.error}`);
        return {
          content: [{ type: "text" as const, text: resolved.error }],
          isError: true,
        };
      }
      const pngBuffer = renderPreview(resolved.svg, format, width);
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

IMPORTANT: Use this only AFTER iterating on the design with render_svg's preview images.
Do not save on the first render. Preview and refine your work first.

**Input:** pass EITHER artifact (id from render_svg, e.g. "art-1" — preferred, no SVG resend) OR content (raw string).

**Format detection:**
- 'auto' (default): infers format from file extension. .svg saves as text, .png renders to image.
- 'svg': saves content as a UTF-8 text file
- 'png': renders the content (assumed SVG) to a PNG image, then saves it

If the file already exists, a numeric counter is appended before the extension
to prevent overwriting: design.svg becomes design-1.svg, then design-2.svg.
The actual saved path is returned in the response.
    `.trim(),
    inputSchema: z.object({
      artifact: z
        .string()
        .optional()
        .describe('Artifact id returned by render_svg (e.g. "art-1"). Preferred over content.'),
      content: z
        .string()
        .optional()
        .describe(
          "Raw content to save. Only needed when the content did not come from render_svg."
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
  async ({ artifact, content, outputPath, format, width }) => {
    const start = Date.now();
    try {
      const resolved = resolveContent(content, artifact);
      if ("error" in resolved) {
        console.error(`[nakkas] save INPUT ERROR — ${resolved.error}`);
        return {
          content: [{ type: "text" as const, text: resolved.error }],
          isError: true,
        };
      }
      const savedPath = await saveContent(resolved.svg, outputPath, format, width);
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
