/**
 * Tests for the save utility (resolveOutputPath, saveContent).
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolveOutputPath, saveContent } from "../src/save.js";
import { readFile, writeFile, unlink, mkdir, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const testDir = join(tmpdir(), "nakkas-save-test");

// Setup and cleanup
async function ensureDir() {
  await mkdir(testDir, { recursive: true });
}

async function cleanFile(path: string) {
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// resolveOutputPath
// ---------------------------------------------------------------------------

describe("resolveOutputPath", () => {
  afterEach(async () => {
    // cleanup test files
    for (let i = 0; i < 5; i++) {
      await cleanFile(join(testDir, `test.svg`));
      await cleanFile(join(testDir, `test-${i}.svg`));
    }
  });

  it("returns the original path when file does not exist", async () => {
    await ensureDir();
    const path = join(testDir, "nonexistent.svg");
    const result = await resolveOutputPath(path);
    expect(result).toBe(path);
  });

  it("appends -1 when file exists", async () => {
    await ensureDir();
    const path = join(testDir, "test.svg");
    await writeFile(path, "<svg/>");
    const result = await resolveOutputPath(path);
    expect(result).toBe(join(testDir, "test-1.svg"));
  });

  it("appends -2 when both original and -1 exist", async () => {
    await ensureDir();
    const path = join(testDir, "test.svg");
    await writeFile(path, "<svg/>");
    await writeFile(join(testDir, "test-1.svg"), "<svg/>");
    const result = await resolveOutputPath(path);
    expect(result).toBe(join(testDir, "test-2.svg"));
  });
});

// ---------------------------------------------------------------------------
// saveContent
// ---------------------------------------------------------------------------

describe("saveContent", () => {
  afterEach(async () => {
    for (const name of ["output.svg", "output-1.svg", "output.png", "output-1.png", "auto.svg", "auto.png"]) {
      await cleanFile(join(testDir, name));
    }
  });

  it("saves SVG as text with format='svg'", async () => {
    await ensureDir();
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle r="10"/></svg>';
    const path = join(testDir, "output.svg");
    const saved = await saveContent(svgContent, path, "svg");
    expect(saved).toBe(path);
    const content = await readFile(saved, "utf-8");
    expect(content).toBe(svgContent);
  });

  it("saves PNG as binary with format='png'", async () => {
    await ensureDir();
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="30" fill="red"/></svg>';
    const path = join(testDir, "output.png");
    const saved = await saveContent(svgContent, path, "png");
    expect(saved).toBe(path);
    const buf = await readFile(saved);
    // PNG magic bytes
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it("auto-detects svg format from .svg extension", async () => {
    await ensureDir();
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50"/></svg>';
    const path = join(testDir, "auto.svg");
    const saved = await saveContent(svgContent, path, "auto");
    const content = await readFile(saved, "utf-8");
    expect(content).toContain("<svg");
  });

  it("auto-detects png format from .png extension", async () => {
    await ensureDir();
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="blue"/></svg>';
    const path = join(testDir, "auto.png");
    const saved = await saveContent(svgContent, path, "auto");
    const buf = await readFile(saved);
    expect(buf[0]).toBe(0x89); // PNG magic byte
  });

  it("uses collision avoidance when file exists", async () => {
    await ensureDir();
    const path = join(testDir, "output.svg");
    await writeFile(path, "existing");
    const saved = await saveContent("<svg/>", path, "svg");
    expect(saved).toBe(join(testDir, "output-1.svg"));
    const content = await readFile(saved, "utf-8");
    expect(content).toBe("<svg/>");
  });
});
