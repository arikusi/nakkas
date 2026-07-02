/**
 * Tests for field-level validation error reporting (src/validation.ts).
 *
 * The element union used to surface bare "Invalid input" for any element that
 * failed all branches. explainConfigError must instead name the actual field.
 */

import { describe, it, expect } from "vitest";
import { SVGConfigSchema } from "../src/schemas/config.js";
import { explainConfigError } from "../src/validation.js";

function explain(rawConfig: unknown): string {
  const result = SVGConfigSchema.safeParse(rawConfig);
  if (result.success) throw new Error("expected config to fail validation");
  return explainConfigError(rawConfig, result.error);
}

describe("explainConfigError — element union failures", () => {
  it("names the missing field when text uses 'text' instead of 'content'", () => {
    const msg = explain({
      canvas: { width: 100, height: 100 },
      elements: [{ type: "text", x: 10, y: 20, text: "hello" }],
    });
    expect(msg).toContain("elements.0.content");
    expect(msg).not.toContain("Invalid input");
  });

  it("appends the field cheat sheet for the failing type", () => {
    const msg = explain({
      canvas: { width: 100, height: 100 },
      elements: [{ type: "text", x: 10, y: 20 }],
    });
    expect(msg).toContain('"content"');
    expect(msg).toContain("Field reference");
  });

  it("reports unknown element types with the valid type list", () => {
    const msg = explain({
      canvas: { width: 100, height: 100 },
      elements: [{ type: "star", cx: 0, cy: 0 }],
    });
    expect(msg).toContain('unknown type "star"');
    expect(msg).toContain("parametric");
  });

  it("reports a missing type field explicitly", () => {
    const msg = explain({
      canvas: { width: 100, height: 100 },
      elements: [{ cx: 0, cy: 0, r: 10 }],
    });
    expect(msg).toContain('missing "type"');
  });

  it("drills into shape field errors (circle without r)", () => {
    const msg = explain({
      canvas: { width: 100, height: 100 },
      elements: [{ type: "circle", cx: 50, cy: 50 }],
    });
    expect(msg).toContain("elements.0.r");
  });

  it("keeps the element index for later elements", () => {
    const msg = explain({
      canvas: { width: 100, height: 100 },
      elements: [
        { type: "circle", cx: 50, cy: 50, r: 10 },
        { type: "text", x: 0, y: 0 },
      ],
    });
    expect(msg).toContain("elements.1.content");
  });

  it("still reports non-element errors verbatim", () => {
    const msg = explain({
      canvas: { width: -5, height: 100 },
      elements: [{ type: "circle", cx: 0, cy: 0, r: 10 }],
    });
    expect(msg).toContain("canvas.width");
  });
});
