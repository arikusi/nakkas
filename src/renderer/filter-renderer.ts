/**
 * Filter rendering: preset expansion and raw SVG filter primitive graph.
 *
 * Preset → renderer generates correct primitive chain automatically.
 * Raw → AI provides exact primitive graph; renderer outputs it directly.
 *
 * Filter region default for overflow effects: x="-50%" y="-50%" width="200%" height="200%"
 * This prevents glow/shadow from being clipped at element bounds.
 *
 * All primitives listed here are supported in modern SVG renderers.
 */

import type {
  Filter,
  FilterPreset,
  FilterRaw,
  FilterPrimitive,
} from "../schemas/filters.js";
import { attrs, tag, blockTag, num, indent, escapeXml } from "./utils.js";

// ---------------------------------------------------------------------------
// Filter region helper
// ---------------------------------------------------------------------------

const OVERFLOW_REGION = `x="-50%" y="-50%" width="200%" height="200%"`;
// SVG spec default filter region — slightly larger than the element to prevent edge clipping
const DEFAULT_REGION = `x="-10%" y="-10%" width="120%" height="120%"`;

function filterRegionAttrs(preset: FilterPreset): string {
  const needsOverflow = ["glow", "neon", "drop-shadow", "blur", "glitch", "chromatic-aberration"].includes(preset.preset);
  if (preset.expand === false) return DEFAULT_REGION;
  if (preset.expand === true || needsOverflow) return OVERFLOW_REGION;
  return DEFAULT_REGION;
}

// ---------------------------------------------------------------------------
// Preset expansion
// ---------------------------------------------------------------------------

function expandGlow(p: FilterPreset): string {
  const sd = p.stdDeviation ?? 6;
  if (p.color) {
    // Colored glow: blur alpha, flood color, composite, boost, merge
    return [
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${num(sd)}" result="blur"/>`,
      `<feFlood flood-color="${escapeXml(p.color)}" result="color"/>`,
      `<feComposite in="color" in2="blur" operator="in" result="coloredGlow"/>`,
      `<feComponentTransfer in="coloredGlow" result="boosted">`,
      `  <feFuncA type="linear" slope="2"/>`,
      `</feComponentTransfer>`,
      `<feMerge>`,
      `  <feMergeNode in="boosted"/>`,
      `  <feMergeNode in="boosted"/>`,
      `  <feMergeNode in="SourceGraphic"/>`,
      `</feMerge>`,
    ].join("\n");
  }
  // Natural glow: blur the source, merge behind original
  return [
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${num(sd)}" result="blur"/>`,
    `<feMerge>`,
    `  <feMergeNode in="blur"/>`,
    `  <feMergeNode in="blur"/>`,
    `  <feMergeNode in="SourceGraphic"/>`,
    `</feMerge>`,
  ].join("\n");
}

function expandNeon(p: FilterPreset): string {
  const sd = p.stdDeviation ?? 12;
  const sd2 = sd * 2;
  if (p.color) {
    return [
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${num(sd2)}" result="wideBlur"/>`,
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${num(sd)}" result="midBlur"/>`,
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${num(sd / 2)}" result="tightBlur"/>`,
      `<feFlood flood-color="${escapeXml(p.color)}" result="color"/>`,
      `<feComposite in="color" in2="wideBlur" operator="in" result="wide"/>`,
      `<feComposite in="color" in2="midBlur" operator="in" result="mid"/>`,
      `<feComposite in="color" in2="tightBlur" operator="in" result="tight"/>`,
      `<feComponentTransfer in="tight" result="tightBoosted">`,
      `  <feFuncA type="linear" slope="4"/>`,
      `</feComponentTransfer>`,
      `<feMerge>`,
      `  <feMergeNode in="wide"/>`,
      `  <feMergeNode in="mid"/>`,
      `  <feMergeNode in="tightBoosted"/>`,
      `  <feMergeNode in="SourceGraphic"/>`,
      `</feMerge>`,
    ].join("\n");
  }
  // Colorless neon: boost blur of source
  return [
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${num(sd2)}" result="wideBlur"/>`,
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${num(sd)}" result="midBlur"/>`,
    `<feComponentTransfer in="midBlur" result="boosted">`,
    `  <feFuncR type="linear" slope="3"/>`,
    `  <feFuncG type="linear" slope="3"/>`,
    `  <feFuncB type="linear" slope="3"/>`,
    `</feComponentTransfer>`,
    `<feMerge>`,
    `  <feMergeNode in="wideBlur"/>`,
    `  <feMergeNode in="boosted"/>`,
    `  <feMergeNode in="boosted"/>`,
    `  <feMergeNode in="SourceGraphic"/>`,
    `</feMerge>`,
  ].join("\n");
}

function expandBlur(p: FilterPreset): string {
  const sd = p.stdDeviation ?? 5;
  return `<feGaussianBlur in="SourceGraphic" stdDeviation="${num(sd)}"/>`;
}

function expandDropShadow(p: FilterPreset): string {
  const dx = p.offsetX ?? 4;
  const dy = p.offsetY ?? 4;
  const sd = p.stdDeviation ?? 3;
  const color = p.color ?? "#000000";
  return `<feDropShadow dx="${num(dx)}" dy="${num(dy)}" stdDeviation="${num(sd)}" flood-color="${escapeXml(color)}" flood-opacity="0.75"/>`;
}

function expandGrayscale(p: FilterPreset): string {
  const v = p.value ?? 1;
  const sat = num(1 - Math.min(1, Math.max(0, v)));
  return `<feColorMatrix type="saturate" values="${sat}"/>`;
}

function expandSepia(_p: FilterPreset): string {
  // Standard sepia matrix
  return `<feColorMatrix type="matrix" values="0.393 0.769 0.189 0 0  0.349 0.686 0.168 0 0  0.272 0.534 0.131 0 0  0 0 0 1 0"/>`;
}

function expandInvert(_p: FilterPreset): string {
  return [
    `<feComponentTransfer>`,
    `  <feFuncR type="linear" slope="-1" intercept="1"/>`,
    `  <feFuncG type="linear" slope="-1" intercept="1"/>`,
    `  <feFuncB type="linear" slope="-1" intercept="1"/>`,
    `</feComponentTransfer>`,
  ].join("\n");
}

function expandSaturate(p: FilterPreset): string {
  const v = p.value ?? 2;
  return `<feColorMatrix type="saturate" values="${num(v)}"/>`;
}

function expandHueRotate(p: FilterPreset): string {
  const v = p.value ?? 90;
  return `<feColorMatrix type="hueRotate" values="${num(v)}"/>`;
}

function expandGlitch(p: FilterPreset): string {
  const scale = p.stdDeviation ?? 15;
  return [
    `<feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="noise">`,
    `  <animate attributeName="seed" from="0" to="100" dur="0.3s" repeatCount="indefinite" calcMode="discrete"/>`,
    `</feTurbulence>`,
    `<feDisplacementMap in="SourceGraphic" in2="noise" scale="${num(scale)}" xChannelSelector="R" yChannelSelector="G"/>`,
  ].join("\n");
}

function expandChromaticAberration(p: FilterPreset): string {
  const spread = p.value ?? 3;
  return [
    // Isolate red channel, shift left
    `<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" in="SourceGraphic" result="red"/>`,
    `<feOffset in="red" dx="${num(-spread)}" dy="0" result="redShift"/>`,
    // Isolate blue channel, shift right
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" in="SourceGraphic" result="blue"/>`,
    `<feOffset in="blue" dx="${num(spread)}" dy="0" result="blueShift"/>`,
    // Isolate green channel, keep in place
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" in="SourceGraphic" result="green"/>`,
    // Merge using screen blending — stacks RGB channels
    `<feBlend in="redShift" in2="green" mode="screen" result="rg"/>`,
    `<feBlend in="rg" in2="blueShift" mode="screen"/>`,
  ].join("\n");
}

function expandNoise(p: FilterPreset): string {
  const opacity = p.value ?? 0.25;
  return [
    `<feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise"/>`,
    `<feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>`,
    `<feComponentTransfer in="grayNoise" result="fadedNoise">`,
    `  <feFuncA type="linear" slope="${num(opacity)}"/>`,
    `</feComponentTransfer>`,
    `<feBlend in="SourceGraphic" in2="fadedNoise" mode="multiply"/>`,
  ].join("\n");
}

function expandOutline(p: FilterPreset): string {
  const radius = p.value ?? 2;
  const color = p.color ?? "#000000";
  return [
    `<feMorphology in="SourceAlpha" operator="dilate" radius="${num(radius)}" result="expanded"/>`,
    `<feFlood flood-color="${escapeXml(color)}" result="outlineColor"/>`,
    `<feComposite in="outlineColor" in2="expanded" operator="in" result="outline"/>`,
    `<feMerge>`,
    `  <feMergeNode in="outline"/>`,
    `  <feMergeNode in="SourceGraphic"/>`,
    `</feMerge>`,
  ].join("\n");
}

function expandInnerShadow(p: FilterPreset): string {
  const sd = p.stdDeviation ?? 4;
  const color = p.color ?? "#000000";
  const opacity = p.value ?? 0.5;
  return [
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${num(sd)}" result="blur"/>`,
    `<feComposite in="blur" in2="SourceAlpha" operator="out" result="innerShadow"/>`,
    `<feFlood flood-color="${escapeXml(color)}" flood-opacity="${num(opacity)}" result="shadowColor"/>`,
    `<feComposite in="shadowColor" in2="innerShadow" operator="in" result="coloredShadow"/>`,
    `<feMerge>`,
    `  <feMergeNode in="SourceGraphic"/>`,
    `  <feMergeNode in="coloredShadow"/>`,
    `</feMerge>`,
  ].join("\n");
}

function expandEmboss(p: FilterPreset): string {
  const sd = p.stdDeviation ?? 2;
  const intensity = p.value ?? 1.5;
  const hlOpacity = num(Math.min(1, intensity * 0.6));
  const shOpacity = num(Math.min(1, intensity * 0.4));
  return [
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${num(sd)}" result="blur"/>`,
    `<feOffset in="blur" dx="${num(-sd)}" dy="${num(-sd)}" result="highlight"/>`,
    `<feOffset in="blur" dx="${num(sd)}" dy="${num(sd)}" result="shadow"/>`,
    `<feComposite in="highlight" in2="SourceAlpha" operator="out" result="hl2"/>`,
    `<feComposite in="shadow" in2="SourceAlpha" operator="out" result="sh2"/>`,
    `<feFlood flood-color="#ffffff" flood-opacity="${hlOpacity}" result="hlColor"/>`,
    `<feFlood flood-color="#000000" flood-opacity="${shOpacity}" result="shColor"/>`,
    `<feComposite in="hlColor" in2="hl2" operator="in" result="hlFinal"/>`,
    `<feComposite in="shColor" in2="sh2" operator="in" result="shFinal"/>`,
    `<feMerge>`,
    `  <feMergeNode in="SourceGraphic"/>`,
    `  <feMergeNode in="shFinal"/>`,
    `  <feMergeNode in="hlFinal"/>`,
    `</feMerge>`,
  ].join("\n");
}

function renderPresetFilter(p: FilterPreset): string {
  const region = filterRegionAttrs(p);
  const filterOpen = `<filter ${attrs({ id: p.id })} ${region}>`;

  let primitives: string;
  switch (p.preset) {
    case "glow":                 primitives = expandGlow(p);                break;
    case "neon":                 primitives = expandNeon(p);                break;
    case "blur":                 primitives = expandBlur(p);                break;
    case "drop-shadow":          primitives = expandDropShadow(p);          break;
    case "grayscale":            primitives = expandGrayscale(p);           break;
    case "sepia":                primitives = expandSepia(p);               break;
    case "invert":               primitives = expandInvert(p);              break;
    case "saturate":             primitives = expandSaturate(p);            break;
    case "hue-rotate":           primitives = expandHueRotate(p);           break;
    case "glitch":               primitives = expandGlitch(p);              break;
    case "chromatic-aberration": primitives = expandChromaticAberration(p); break;
    case "noise":                primitives = expandNoise(p);               break;
    case "outline":              primitives = expandOutline(p);             break;
    case "inner-shadow":         primitives = expandInnerShadow(p);         break;
    case "emboss":               primitives = expandEmboss(p);              break;
  }

  const indented = primitives
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
  return `${filterOpen}\n${indented}\n</filter>`;
}

// ---------------------------------------------------------------------------
// Raw filter primitive rendering
// ---------------------------------------------------------------------------

function renderFuncChannel(
  func: { type: string; slope?: number; intercept?: number; amplitude?: number; exponent?: number; offset?: number; tableValues?: string } | undefined,
  tag_name: string
): string {
  if (!func) return "";
  const a = attrs({
    type: func.type,
    slope: func.slope !== undefined ? num(func.slope) : undefined,
    intercept: func.intercept !== undefined ? num(func.intercept) : undefined,
    amplitude: func.amplitude !== undefined ? num(func.amplitude) : undefined,
    exponent: func.exponent !== undefined ? num(func.exponent) : undefined,
    offset: func.offset !== undefined ? num(func.offset) : undefined,
    tableValues: func.tableValues,
  });
  return `<${tag_name} ${a}/>`;
}

function renderPrimitive(p: FilterPrimitive): string {
  const base = attrs({
    result: p.result,
    in: p.in,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
  });

  switch (p.primitive) {
    case "feGaussianBlur": {
      const a = attrs({
        stdDeviation: typeof p.stdDeviation === "number" ? num(p.stdDeviation) : String(p.stdDeviation),
        edgeMode: p.edgeMode,
      });
      return tag("feGaussianBlur", [a, base].filter(Boolean).join(" "));
    }
    case "feDropShadow": {
      const a = attrs({
        dx: p.dx !== undefined ? num(p.dx) : undefined,
        dy: p.dy !== undefined ? num(p.dy) : undefined,
        stdDeviation: p.stdDeviation !== undefined ? num(p.stdDeviation) : undefined,
        "flood-color": p.floodColor,
        "flood-opacity": p.floodOpacity !== undefined ? num(p.floodOpacity) : undefined,
      });
      return tag("feDropShadow", [a, base].filter(Boolean).join(" "));
    }
    case "feColorMatrix": {
      const a = attrs({ type: p.type, values: p.values });
      return tag("feColorMatrix", [a, base].filter(Boolean).join(" "));
    }
    case "feTurbulence": {
      const a = attrs({
        type: p.type,
        baseFrequency: p.baseFrequency !== undefined ? String(p.baseFrequency) : undefined,
        numOctaves: p.numOctaves,
        seed: p.seed,
        stitchTiles: p.stitchTiles,
      });
      return tag("feTurbulence", [a, base].filter(Boolean).join(" "));
    }
    case "feDisplacementMap": {
      const a = attrs({
        in2: p.in2,
        scale: num(p.scale),
        xChannelSelector: p.xChannelSelector,
        yChannelSelector: p.yChannelSelector,
      });
      return tag("feDisplacementMap", [a, base].filter(Boolean).join(" "));
    }
    case "feOffset": {
      const a = attrs({
        dx: p.dx !== undefined ? num(p.dx) : undefined,
        dy: p.dy !== undefined ? num(p.dy) : undefined,
      });
      return tag("feOffset", [a, base].filter(Boolean).join(" "));
    }
    case "feFlood": {
      const a = attrs({
        "flood-color": p.floodColor,
        "flood-opacity": p.floodOpacity !== undefined ? num(p.floodOpacity) : undefined,
      });
      return tag("feFlood", [a, base].filter(Boolean).join(" "));
    }
    case "feComposite": {
      const a = attrs({
        in2: p.in2,
        operator: p.operator,
        k1: p.k1 !== undefined ? num(p.k1) : undefined,
        k2: p.k2 !== undefined ? num(p.k2) : undefined,
        k3: p.k3 !== undefined ? num(p.k3) : undefined,
        k4: p.k4 !== undefined ? num(p.k4) : undefined,
      });
      return tag("feComposite", [a, base].filter(Boolean).join(" "));
    }
    case "feBlend": {
      const a = attrs({ in2: p.in2, mode: p.mode });
      return tag("feBlend", [a, base].filter(Boolean).join(" "));
    }
    case "feMerge": {
      const nodes = p.nodes.map((n) => `  <feMergeNode in="${escapeXml(n)}"/>`).join("\n");
      return `<feMerge${base ? ` ${base}` : ""}>\n${nodes}\n</feMerge>`;
    }
    case "feComponentTransfer": {
      const children = [
        renderFuncChannel(p.funcR, "feFuncR"),
        renderFuncChannel(p.funcG, "feFuncG"),
        renderFuncChannel(p.funcB, "feFuncB"),
        renderFuncChannel(p.funcA, "feFuncA"),
      ]
        .filter(Boolean)
        .map((l) => `  ${l}`)
        .join("\n");
      return `<feComponentTransfer${base ? ` ${base}` : ""}>\n${children}\n</feComponentTransfer>`;
    }
  }
}

function renderRawFilter(f: FilterRaw): string {
  const region = f.filterRegion ?? { x: "-50%", y: "-50%", width: "200%", height: "200%" };
  const a = attrs({
    id: f.id,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
  });
  const primitives = f.primitives.map(renderPrimitive).map((p) => indent(p)).join("\n");
  return `<filter ${a}>\n${primitives}\n</filter>`;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function renderFilter(filter: Filter): string {
  switch (filter.type) {
    case "preset":
      return renderPresetFilter(filter);
    case "raw":
      return renderRawFilter(filter);
  }
}
