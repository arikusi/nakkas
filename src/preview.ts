/**
 * Nakkas Preview Renderer
 *
 * Renders content (SVG, and future: HTML) to a PNG buffer.
 * Used by the `preview` MCP tool to give AI visual feedback on generated output.
 *
 * Notes:
 * - SVG rendering via @resvg/resvg-js (Rust/NAPI, zero system deps)
 * - Background: transparent by default (no background option = transparent PNG)
 * - CSS animations / SMIL: resvg renders static SVG only — output is a t=0 snapshot
 * - HTML support: scaffolded but not yet implemented (requires playwright)
 */

import { Resvg } from "@resvg/resvg-js";

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

export type PreviewFormat = "svg" | "html" | "unknown";

/** Detect content format by inspecting the leading tag. Case-insensitive. */
export function autoDetectFormat(content: string): PreviewFormat {
  const trimmed = content.trimStart();
  if (/^<svg[\s>]/i.test(trimmed)) return "svg";
  if (/^<!doctype html|^<html[\s>]/i.test(trimmed)) return "html";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render an SVG string to a transparent PNG buffer. */
export function svgToPng(svgString: string, width?: number): Buffer {
  const opts = width ? { fitTo: { mode: "width" as const, value: width } } : {};
  const resvg = new Resvg(svgString, opts);
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render content to a PNG buffer.
 *
 * @param content - SVG string (or future: HTML string)
 * @param format  - Content format; auto-detected from content if omitted
 * @param width   - Optional render width in pixels; uses SVG's own width if omitted
 */
export function renderPreview(
  content: string,
  format?: "svg" | "html",
  width?: number
): Buffer {
  const detected = format ?? autoDetectFormat(content);

  if (detected === "svg") {
    return svgToPng(content, width);
  }

  if (detected === "html") {
    throw new Error(
      "HTML preview is not yet supported. Provide SVG content, or check back for a future update."
    );
  }

  throw new Error(
    "Could not detect content format. Ensure content starts with <svg or <html, " +
      "or explicitly pass format: 'svg'."
  );
}
