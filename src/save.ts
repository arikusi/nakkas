/**
 * Generic file save utility.
 *
 * Handles collision avoidance (auto-incrementing filenames) and format-aware
 * content writing. Not SVG-specific: designed to work with any content format
 * that nakkas renders, now or in the future.
 */

import { writeFile, access } from "node:fs/promises";
import { extname, dirname, basename, join } from "node:path";
import { svgToPng } from "./preview.js";

/**
 * Resolve a safe output path that does not overwrite existing files.
 * If the requested path exists, appends -1, -2, -3, ... before the extension.
 *
 * Example: design.svg becomes design-1.svg, then design-2.svg, and so on.
 */
export async function resolveOutputPath(requested: string): Promise<string> {
  const exists = (p: string) =>
    access(p)
      .then(() => true)
      .catch(() => false);

  if (!(await exists(requested))) return requested;

  const dir = dirname(requested);
  const ext = extname(requested);
  const stem = basename(requested, ext);

  for (let i = 1; ; i++) {
    const candidate = join(dir, `${stem}-${i}${ext}`);
    if (!(await exists(candidate))) return candidate;
  }
}

/** Infer the effective save format from file extension. */
function inferFormat(outputPath: string): "svg" | "png" {
  const ext = extname(outputPath).toLowerCase();
  if (ext === ".png") return "png";
  return "svg"; // default: save as text
}

/**
 * Save content to disk with format-aware handling.
 *
 * @param content   The string content to save (SVG XML, or other text)
 * @param outputPath File path to save to (directory must exist)
 * @param format    "auto" infers from extension, "svg" saves as text, "png" renders to raster
 * @param width     For raster formats: optional render width in pixels
 * @returns The actual saved file path (may differ from requested if collision avoidance kicked in)
 */
export async function saveContent(
  content: string,
  outputPath: string,
  format: "auto" | "svg" | "png",
  width?: number
): Promise<string> {
  const resolved = await resolveOutputPath(outputPath);
  const effectiveFormat = format === "auto" ? inferFormat(resolved) : format;

  if (effectiveFormat === "png") {
    const pngBuffer = svgToPng(content, width);
    await writeFile(resolved, pngBuffer);
  } else {
    await writeFile(resolved, content, "utf-8");
  }

  return resolved;
}
