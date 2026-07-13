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

import { execFileSync } from "node:child_process";
import { Resvg, type ResvgRenderOptions } from "@resvg/resvg-js";

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

/**
 * Map CSS generic font families to fonts that actually exist per platform.
 * Without this, resvg substitutes an arbitrary system font for "monospace",
 * "sans-serif", etc., and the preview no longer matches what the SVG declares.
 */
function fcMatch(generic: string): string | undefined {
  try {
    const family = execFileSync("fc-match", ["-f", "%{family[0]}", generic], {
      encoding: "utf8",
      timeout: 2000,
    }).trim();
    return family || undefined;
  } catch {
    return undefined;
  }
}

let cachedFontOptions: NonNullable<ResvgRenderOptions["font"]> | undefined;

export function buildFontOptions(): NonNullable<ResvgRenderOptions["font"]> {
  if (cachedFontOptions) return cachedFontOptions;

  let fonts: { serif: string; sans: string; mono: string };
  if (process.platform === "darwin") {
    fonts = { serif: "Times New Roman", sans: "Helvetica", mono: "Menlo" };
  } else if (process.platform === "win32") {
    fonts = { serif: "Times New Roman", sans: "Arial", mono: "Consolas" };
  } else {
    // Linux font sets vary wildly; ask fontconfig how the system itself
    // resolves each generic family instead of hardcoding one distro's fonts.
    fonts = {
      serif: fcMatch("serif") ?? "DejaVu Serif",
      sans: fcMatch("sans-serif") ?? "DejaVu Sans",
      mono: fcMatch("monospace") ?? "DejaVu Sans Mono",
    };
  }

  cachedFontOptions = {
    loadSystemFonts: true,
    defaultFontFamily: fonts.sans,
    serifFamily: fonts.serif,
    sansSerifFamily: fonts.sans,
    monospaceFamily: fonts.mono,
  };
  return cachedFontOptions;
}

let cachedMeasureFontOptions: NonNullable<ResvgRenderOptions["font"]> | null | undefined;

/**
 * Font options for measurement-only renders (bbox audits). loadSystemFonts
 * scans the whole font database on every Resvg construction (~90ms); for
 * measurement the generic families resolve to three known font files, so
 * passing those directly is ~200x faster. Only valid when the SVG uses
 * generic families exclusively — callers must check. Returns null when the
 * files cannot be resolved (non-Linux or no fontconfig); fall back to
 * buildFontOptions() then.
 */
export function buildMeasureFontOptions(): NonNullable<ResvgRenderOptions["font"]> | null {
  if (cachedMeasureFontOptions !== undefined) return cachedMeasureFontOptions;
  if (process.platform !== "linux") {
    cachedMeasureFontOptions = null;
    return null;
  }
  const fontFile = (generic: string): string | undefined => {
    try {
      const file = execFileSync("fc-match", ["-f", "%{file}", generic], {
        encoding: "utf8",
        timeout: 2000,
      }).trim();
      return file || undefined;
    } catch {
      return undefined;
    }
  };
  const files = ["serif", "sans-serif", "monospace"].map(fontFile);
  if (files.some((f) => !f)) {
    cachedMeasureFontOptions = null;
    return null;
  }
  const base = buildFontOptions();
  cachedMeasureFontOptions = {
    loadSystemFonts: false,
    fontFiles: files as string[],
    defaultFontFamily: base.defaultFontFamily,
    serifFamily: base.serifFamily,
    sansSerifFamily: base.sansSerifFamily,
    monospaceFamily: base.monospaceFamily,
  };
  return cachedMeasureFontOptions;
}

/**
 * Replace CSS generic font families with concrete font names before handing
 * the SVG to resvg. resvg-js 2.x ignores its own serifFamily/monospaceFamily
 * options, so "monospace" and friends silently fall back to the default font
 * and the preview stops matching what the SVG declares. Only touches
 * font-family attributes and CSS declarations, never text content.
 */
export function resolveGenericFamilies(svg: string, fonts = buildFontOptions()): string {
  const map: Record<string, string> = {
    "sans-serif": fonts.sansSerifFamily ?? "sans-serif",
    serif: fonts.serifFamily ?? "serif",
    monospace: fonts.monospaceFamily ?? "monospace",
    cursive: fonts.sansSerifFamily ?? "cursive",
    fantasy: fonts.sansSerifFamily ?? "fantasy",
  };
  const generic = /\b(sans-serif|monospace|serif|cursive|fantasy)\b/gi;
  const substitute = (value: string) => value.replace(generic, (k) => map[k.toLowerCase()] ?? k);

  return svg
    .replace(
      /(font-family\s*=\s*)(["'])(.*?)\2/gi,
      (_m, prefix: string, quote: string, value: string) => `${prefix}${quote}${substitute(value)}${quote}`
    )
    .replace(
      /(font-family\s*:\s*)([^;}"'<]+)/gi,
      (_m, prefix: string, value: string) => `${prefix}${substitute(value)}`
    );
}

/** Render an SVG string to a transparent PNG buffer. */
export function svgToPng(svgString: string, width?: number): Buffer {
  const opts: ResvgRenderOptions = { font: buildFontOptions() };
  if (width) opts.fitTo = { mode: "width", value: width };
  const resvg = new Resvg(resolveGenericFamilies(svgString), opts);
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
