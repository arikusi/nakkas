/**
 * Guards on the model-facing render_svg tool description.
 *
 * The description is the only field guidance the model gets (the slim
 * registration schema is deliberately opaque), so load-bearing lines are
 * pinned here: the radial-group +x orientation gotcha (v0.1.7 dogfood
 * finding: spokes drawn long on y render as a chord ring) and the design
 * guide. A size ceiling keeps the description from creeping past its
 * token budget one edit at a time.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "../src/index.ts"), "utf8");

function renderSvgDescription(): string {
  const start = source.indexOf("description: `Render animated SVG");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("`.trim()", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("render_svg tool description", () => {
  const desc = renderSvgDescription();

  it("teaches the pattern-group +x outward orientation", () => {
    expect(desc).toContain("+x points outward");
    expect(desc).toMatch(/long along the x axis/);
  });

  it("carries the design guide", () => {
    expect(desc).toContain("Design guide");
    expect(desc).toContain("spacing unit");
    expect(desc).toContain("4.5:1");
    expect(desc).toContain("ease-out for entrances");
  });

  it("stays inside the token budget (~1100 tokens)", () => {
    // ~3.8 chars per token on this kind of prose; ceiling leaves headroom
    // over the current size but blocks unbounded growth.
    expect(desc.length).toBeLessThan(4300);
  });
});
