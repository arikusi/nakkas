import { describe, it, expect } from "vitest";
import { autoDetectFormat, svgToPng, renderPreview } from "../src/preview.js";

// ---------------------------------------------------------------------------
// Minimal valid SVGs for testing
// ---------------------------------------------------------------------------

const SIMPLE_SVG = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="#ff0000"/>
</svg>`;

const SIMPLE_SVG_UPPERCASE = `<SVG width="50" height="50" xmlns="http://www.w3.org/2000/svg">
  <circle cx="25" cy="25" r="20" fill="blue"/>
</SVG>`;

// PNG magic bytes: \x89 P N G \r \n \x1a \n
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function hasPNGMagicBytes(buf: Buffer): boolean {
  return buf.slice(0, 8).equals(PNG_MAGIC);
}

// ---------------------------------------------------------------------------
// autoDetectFormat
// ---------------------------------------------------------------------------

describe("autoDetectFormat", () => {
  it('detects <svg ...> as "svg"', () => {
    expect(autoDetectFormat('<svg width="100" height="100">')).toBe("svg");
  });

  it('detects <SVG> (uppercase) as "svg"', () => {
    expect(autoDetectFormat("<SVG>")).toBe("svg");
  });

  it('detects <svg> with leading whitespace as "svg"', () => {
    expect(autoDetectFormat("  \n<svg>")).toBe("svg");
  });

  it('detects <html> as "html"', () => {
    expect(autoDetectFormat("<html>")).toBe("html");
  });

  it('detects <!DOCTYPE html> as "html"', () => {
    expect(autoDetectFormat("<!DOCTYPE html><html>")).toBe("html");
  });

  it('detects <!doctype html> (lowercase) as "html"', () => {
    expect(autoDetectFormat("<!doctype html>")).toBe("html");
  });

  it('detects random string as "unknown"', () => {
    expect(autoDetectFormat("hello world")).toBe("unknown");
  });

  it('detects JSON as "unknown"', () => {
    expect(autoDetectFormat('{"key": "value"}')).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// svgToPng
// ---------------------------------------------------------------------------

describe("svgToPng", () => {
  it("returns a Buffer with PNG magic bytes", () => {
    const result = svgToPng(SIMPLE_SVG);
    expect(result).toBeInstanceOf(Buffer);
    expect(hasPNGMagicBytes(result)).toBe(true);
  });

  it("produces non-empty output", () => {
    const result = svgToPng(SIMPLE_SVG);
    expect(result.length).toBeGreaterThan(100);
  });

  it("accepts width option", () => {
    const result = svgToPng(SIMPLE_SVG, 200);
    expect(hasPNGMagicBytes(result)).toBe(true);
    expect(result.length).toBeGreaterThan(100);
  });

  it("throws for uppercase <SVG> root tag (resvg requires valid XML)", () => {
    // resvg parses SVG as XML — uppercase <SVG> is not valid XML
    // auto-detect handles uppercase fine; rendering requires lowercase <svg>
    expect(() => svgToPng(SIMPLE_SVG_UPPERCASE)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// renderPreview
// ---------------------------------------------------------------------------

describe("renderPreview", () => {
  it("renders SVG with auto-detected format", () => {
    const result = renderPreview(SIMPLE_SVG);
    expect(hasPNGMagicBytes(result)).toBe(true);
  });

  it("renders SVG with explicit format: svg", () => {
    const result = renderPreview(SIMPLE_SVG, "svg");
    expect(hasPNGMagicBytes(result)).toBe(true);
  });

  it("renders SVG with explicit width", () => {
    const result = renderPreview(SIMPLE_SVG, "svg", 400);
    expect(hasPNGMagicBytes(result)).toBe(true);
  });

  it("throws for format: html", () => {
    expect(() => renderPreview("<html><body></body></html>", "html")).toThrow(
      "not yet supported"
    );
  });

  it("throws for unknown content without format", () => {
    expect(() => renderPreview("not svg or html")).toThrow(
      "Could not detect content format"
    );
  });

  it("throws with helpful message for unknown content", () => {
    expect(() => renderPreview("random content")).toThrow(
      /format: 'svg'/
    );
  });
});
