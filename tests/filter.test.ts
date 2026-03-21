/**
 * Filter rendering tests.
 * Verify preset expansion and raw filter primitive output.
 */

import { describe, it, expect } from "vitest";
import { renderFilter } from "../src/renderer/filter-renderer.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function preset(preset: string, extra: Record<string, unknown> = {}) {
  return renderFilter({ type: "preset", id: "test", preset: preset as never, ...extra });
}

// ---------------------------------------------------------------------------
// Preset: glow
// ---------------------------------------------------------------------------

describe("filter preset: glow", () => {
  it("contains feGaussianBlur", () => {
    expect(preset("glow")).toContain("feGaussianBlur");
  });

  it("contains feMerge with SourceGraphic as last layer", () => {
    const result = preset("glow");
    expect(result).toContain("feMerge");
    expect(result).toContain("SourceGraphic");
  });

  it("uses custom stdDeviation", () => {
    const result = preset("glow", { stdDeviation: 15 });
    expect(result).toContain('stdDeviation="15"');
  });

  it("uses feFlood and feComposite when color is provided", () => {
    const result = preset("glow", { color: "#ff00ff" });
    expect(result).toContain("feFlood");
    expect(result).toContain("feComposite");
    expect(result).toContain('flood-color="#ff00ff"');
  });

  it("includes overflow filter region", () => {
    const result = preset("glow");
    expect(result).toContain('x="-50%"');
    expect(result).toContain('width="200%"');
  });

  it("has filter id", () => {
    const result = renderFilter({ type: "preset", id: "myGlow", preset: "glow" });
    expect(result).toContain('id="myGlow"');
  });
});

// ---------------------------------------------------------------------------
// Preset: neon
// ---------------------------------------------------------------------------

describe("filter preset: neon", () => {
  it("contains multiple feGaussianBlur layers", () => {
    const result = preset("neon");
    const count = (result.match(/feGaussianBlur/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("contains feComponentTransfer for brightness boost (colorless)", () => {
    const result = preset("neon");
    expect(result).toContain("feComponentTransfer");
  });

  it("uses feFlood with color when color is provided", () => {
    const result = preset("neon", { color: "#00ffff" });
    expect(result).toContain("feFlood");
    expect(result).toContain("#00ffff");
  });

  it("includes overflow filter region", () => {
    const result = preset("neon");
    expect(result).toContain('x="-50%"');
  });
});

// ---------------------------------------------------------------------------
// Preset: blur
// ---------------------------------------------------------------------------

describe("filter preset: blur", () => {
  it("is a simple feGaussianBlur", () => {
    const result = preset("blur");
    expect(result).toContain("feGaussianBlur");
  });

  it("does not include complex chaining for simple blur", () => {
    const result = preset("blur");
    expect(result).not.toContain("feMerge");
  });

  it("uses provided stdDeviation", () => {
    const result = preset("blur", { stdDeviation: 10 });
    expect(result).toContain('stdDeviation="10"');
  });
});

// ---------------------------------------------------------------------------
// Preset: drop-shadow
// ---------------------------------------------------------------------------

describe("filter preset: drop-shadow", () => {
  it("uses feDropShadow element", () => {
    const result = preset("drop-shadow");
    expect(result).toContain("feDropShadow");
  });

  it("uses custom offset", () => {
    const result = preset("drop-shadow", { offsetX: 6, offsetY: 8 });
    expect(result).toContain('dx="6"');
    expect(result).toContain('dy="8"');
  });

  it("uses custom color", () => {
    const result = preset("drop-shadow", { color: "#336699" });
    expect(result).toContain("#336699");
  });
});

// ---------------------------------------------------------------------------
// Preset: grayscale
// ---------------------------------------------------------------------------

describe("filter preset: grayscale", () => {
  it("uses feColorMatrix with saturate type", () => {
    const result = preset("grayscale");
    expect(result).toContain("feColorMatrix");
    expect(result).toContain('type="saturate"');
    expect(result).toContain('values="0"');
  });

  it("does not use overflow region", () => {
    const result = preset("grayscale");
    expect(result).not.toContain('x="-50%"');
  });
});

// ---------------------------------------------------------------------------
// Preset: sepia
// ---------------------------------------------------------------------------

describe("filter preset: sepia", () => {
  it("uses feColorMatrix with matrix type", () => {
    const result = preset("sepia");
    expect(result).toContain("feColorMatrix");
    expect(result).toContain('type="matrix"');
  });

  it("contains sepia matrix values", () => {
    const result = preset("sepia");
    expect(result).toContain("0.393");
  });
});

// ---------------------------------------------------------------------------
// Preset: invert
// ---------------------------------------------------------------------------

describe("filter preset: invert", () => {
  it("uses feComponentTransfer with linear slope=-1", () => {
    const result = preset("invert");
    expect(result).toContain("feComponentTransfer");
    expect(result).toContain('slope="-1"');
    expect(result).toContain('intercept="1"');
  });
});

// ---------------------------------------------------------------------------
// Preset: saturate
// ---------------------------------------------------------------------------

describe("filter preset: saturate", () => {
  it("uses feColorMatrix saturate type", () => {
    const result = preset("saturate");
    expect(result).toContain("feColorMatrix");
    expect(result).toContain('type="saturate"');
  });

  it("uses provided value", () => {
    const result = preset("saturate", { value: 3 });
    expect(result).toContain('values="3"');
  });
});

// ---------------------------------------------------------------------------
// Preset: hue-rotate
// ---------------------------------------------------------------------------

describe("filter preset: hue-rotate", () => {
  it("uses feColorMatrix hueRotate type", () => {
    const result = preset("hue-rotate");
    expect(result).toContain("feColorMatrix");
    expect(result).toContain('type="hueRotate"');
  });

  it("uses provided degrees value", () => {
    const result = preset("hue-rotate", { value: 180 });
    expect(result).toContain('values="180"');
  });
});

// ---------------------------------------------------------------------------
// Preset: glitch
// ---------------------------------------------------------------------------

describe("filter preset: glitch", () => {
  it("contains feTurbulence", () => {
    const result = preset("glitch");
    expect(result).toContain("feTurbulence");
  });

  it("contains feDisplacementMap", () => {
    const result = preset("glitch");
    expect(result).toContain("feDisplacementMap");
  });

  it("animates turbulence seed for dynamic glitch", () => {
    const result = preset("glitch");
    expect(result).toContain("<animate");
    expect(result).toContain('attributeName="seed"');
    expect(result).toContain('calcMode="discrete"');
  });
});

// ---------------------------------------------------------------------------
// Raw filter
// ---------------------------------------------------------------------------

describe("raw filter", () => {
  it("renders provided primitives in order", () => {
    const result = renderFilter({
      type: "raw",
      id: "rawF",
      primitives: [
        { primitive: "feGaussianBlur", stdDeviation: 5, result: "blur" },
        { primitive: "feOffset", dx: 4, dy: 4, result: "shifted" },
        {
          primitive: "feMerge",
          nodes: ["shifted", "SourceGraphic"],
        },
      ],
    });
    expect(result).toContain("feGaussianBlur");
    expect(result).toContain("feOffset");
    expect(result).toContain("feMerge");
    // Order matters: blur before offset before merge
    const blurIdx = result.indexOf("feGaussianBlur");
    const offsetIdx = result.indexOf("feOffset");
    const mergeIdx = result.indexOf("feMerge");
    expect(blurIdx).toBeLessThan(offsetIdx);
    expect(offsetIdx).toBeLessThan(mergeIdx);
  });

  it("uses custom filter region", () => {
    const result = renderFilter({
      type: "raw",
      id: "rawF",
      filterRegion: { x: "-20%", y: "-20%", width: "140%", height: "140%" },
      primitives: [{ primitive: "feGaussianBlur", stdDeviation: 3 }],
    });
    expect(result).toContain('x="-20%"');
    expect(result).toContain('width="140%"');
  });

  it("renders feColorMatrix primitive", () => {
    const result = renderFilter({
      type: "raw",
      id: "cm",
      primitives: [{ primitive: "feColorMatrix", type: "saturate", values: "0" }],
    });
    expect(result).toContain("feColorMatrix");
    expect(result).toContain('type="saturate"');
  });

  it("renders feMerge with mergeNode children", () => {
    const result = renderFilter({
      type: "raw",
      id: "merge",
      primitives: [
        { primitive: "feGaussianBlur", stdDeviation: 5, result: "b" },
        { primitive: "feMerge", nodes: ["b", "SourceGraphic"] },
      ],
    });
    expect(result).toContain("<feMerge");
    expect(result).toContain('<feMergeNode in="b"');
    expect(result).toContain('<feMergeNode in="SourceGraphic"');
  });

  it("renders feComponentTransfer with funcA for alpha boost", () => {
    const result = renderFilter({
      type: "raw",
      id: "boost",
      primitives: [
        {
          primitive: "feComponentTransfer",
          funcA: { type: "linear", slope: 3 },
        },
      ],
    });
    expect(result).toContain("feComponentTransfer");
    expect(result).toContain("feFuncA");
    expect(result).toContain('slope="3"');
  });
});

// ---------------------------------------------------------------------------
// Filter region
// ---------------------------------------------------------------------------

describe("filter region defaults", () => {
  it("overflow presets use the large region (-50%/-50%/200%/200%)", () => {
    const result = preset("glow");
    expect(result).toContain('x="-50%"');
    expect(result).toContain('y="-50%"');
    expect(result).toContain('width="200%"');
    expect(result).toContain('height="200%"');
  });

  it("non-overflow presets use SVG spec default region (-10%/-10%/120%/120%)", () => {
    const result = preset("grayscale");
    expect(result).toContain('x="-10%"');
    expect(result).toContain('y="-10%"');
    expect(result).toContain('width="120%"');
    expect(result).toContain('height="120%"');
  });

  it("non-overflow presets with expand=true use the large region", () => {
    const result = preset("grayscale", { expand: true });
    expect(result).toContain('x="-50%"');
    expect(result).toContain('width="200%"');
  });

  it("any preset with expand=false uses the spec default region", () => {
    const result = preset("glow", { expand: false });
    expect(result).toContain('x="-10%"');
    expect(result).toContain('width="120%"');
  });
});

// ---------------------------------------------------------------------------
// Security: injection prevention
// ---------------------------------------------------------------------------

describe("filter security", () => {
  it("escapes XML injection chars in filter id", () => {
    const r = renderFilter({
      type: "preset",
      id: 'x"><script>bad</script><filter id="y',
      preset: "blur",
    });
    expect(r).not.toContain("<script>");
    expect(r).toContain("&lt;script&gt;");
  });

  it("escapes feMerge node in values", () => {
    const r = renderFilter({
      type: "raw",
      id: "x",
      primitives: [
        { primitive: "feGaussianBlur", stdDeviation: 3, result: "b" },
        { primitive: "feMerge", nodes: ['b"/<script>bad</script>', "SourceGraphic"] },
      ],
    });
    expect(r).not.toContain("<script>");
    expect(r).toContain("&lt;script&gt;");
  });
});

// ---------------------------------------------------------------------------
// Preset: chromatic-aberration
// ---------------------------------------------------------------------------

describe("filter preset: chromatic-aberration", () => {
  it("contains feColorMatrix for RGB channel isolation", () => {
    const result = preset("chromatic-aberration");
    expect(result).toContain("feColorMatrix");
  });

  it("contains feOffset for channel shifting", () => {
    const result = preset("chromatic-aberration");
    expect(result).toContain("feOffset");
  });

  it("contains feBlend for channel merging", () => {
    const result = preset("chromatic-aberration");
    expect(result).toContain("feBlend");
  });

  it("uses screen blending mode", () => {
    const result = preset("chromatic-aberration");
    expect(result).toContain('mode="screen"');
  });

  it("uses overflow filter region (channels spill outside bounds)", () => {
    const result = preset("chromatic-aberration");
    expect(result).toContain('x="-50%"');
    expect(result).toContain('width="200%"');
  });

  it("applies custom spread via value param", () => {
    const result = preset("chromatic-aberration", { value: 8 });
    // dx should be -8 for red, +8 for blue
    expect(result).toContain('dx="-8"');
    expect(result).toContain('dx="8"');
  });

  it("defaults to spread of 3 when no value", () => {
    const result = preset("chromatic-aberration");
    expect(result).toContain('dx="-3"');
    expect(result).toContain('dx="3"');
  });
});

// ---------------------------------------------------------------------------
// Preset: noise
// ---------------------------------------------------------------------------

describe("filter preset: noise", () => {
  it("contains feTurbulence for noise generation", () => {
    const result = preset("noise");
    expect(result).toContain("feTurbulence");
  });

  it("uses fractalNoise type", () => {
    const result = preset("noise");
    expect(result).toContain('type="fractalNoise"');
  });

  it("contains feBlend to overlay noise on source", () => {
    const result = preset("noise");
    expect(result).toContain("feBlend");
  });

  it("contains feComponentTransfer for opacity control", () => {
    const result = preset("noise");
    expect(result).toContain("feComponentTransfer");
  });

  it("applies custom opacity via value param", () => {
    const result = preset("noise", { value: 0.5 });
    expect(result).toContain('slope="0.5"');
  });

  it("defaults to opacity 0.25 when no value", () => {
    const result = preset("noise");
    expect(result).toContain('slope="0.25"');
  });

  it("uses default filter region (noise stays within element)", () => {
    const result = preset("noise");
    expect(result).toContain('x="-10%"');
    expect(result).toContain('width="120%"');
  });
});

// ---------------------------------------------------------------------------
// Preset: outline
// ---------------------------------------------------------------------------

describe("filter preset: outline", () => {
  it("contains feMorphology with dilate operator", () => {
    const result = preset("outline");
    expect(result).toContain("feMorphology");
    expect(result).toContain('operator="dilate"');
  });

  it("contains feFlood for outline color", () => {
    const result = preset("outline", { color: "#ff0000" });
    expect(result).toContain("feFlood");
    expect(result).toContain('flood-color="#ff0000"');
  });

  it("contains feMerge with SourceGraphic on top", () => {
    const result = preset("outline");
    expect(result).toContain("feMerge");
    expect(result).toContain("SourceGraphic");
  });

  it("applies custom thickness via value param", () => {
    const result = preset("outline", { value: 5 });
    expect(result).toContain('radius="5"');
  });

  it("defaults to thickness of 2", () => {
    const result = preset("outline");
    expect(result).toContain('radius="2"');
  });
});

// ---------------------------------------------------------------------------
// Preset: inner-shadow
// ---------------------------------------------------------------------------

describe("filter preset: inner-shadow", () => {
  it("contains feGaussianBlur", () => {
    const result = preset("inner-shadow");
    expect(result).toContain("feGaussianBlur");
  });

  it("contains feComposite with operator out (inversion for inner)", () => {
    const result = preset("inner-shadow");
    expect(result).toContain('operator="out"');
  });

  it("contains feFlood with shadow color", () => {
    const result = preset("inner-shadow", { color: "#330000" });
    expect(result).toContain('flood-color="#330000"');
  });

  it("applies custom opacity via value param", () => {
    const result = preset("inner-shadow", { value: 0.8 });
    expect(result).toContain('flood-opacity="0.8"');
  });

  it("defaults to opacity 0.5", () => {
    const result = preset("inner-shadow");
    expect(result).toContain('flood-opacity="0.5"');
  });
});

// ---------------------------------------------------------------------------
// Preset: emboss
// ---------------------------------------------------------------------------

describe("filter preset: emboss", () => {
  it("contains feGaussianBlur for depth", () => {
    const result = preset("emboss");
    expect(result).toContain("feGaussianBlur");
  });

  it("contains two feOffset for highlight and shadow", () => {
    const result = preset("emboss");
    const offsets = (result.match(/feOffset/g) || []).length;
    expect(offsets).toBe(2);
  });

  it("contains highlight (white) and shadow (black) feFlood", () => {
    const result = preset("emboss");
    expect(result).toContain('flood-color="#ffffff"');
    expect(result).toContain('flood-color="#000000"');
  });

  it("contains feMerge with three layers", () => {
    const result = preset("emboss");
    const mergeNodes = (result.match(/feMergeNode/g) || []).length;
    expect(mergeNodes).toBe(3);
  });

  it("custom stdDeviation changes offset distance", () => {
    const result = preset("emboss", { stdDeviation: 4 });
    expect(result).toContain('dx="-4"');
    expect(result).toContain('dx="4"');
  });
});
