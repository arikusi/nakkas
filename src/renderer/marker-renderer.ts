/**
 * <marker> rendering — preset arrowhead and line-end glyphs.
 *
 * Every preset lives in a 10x10 viewBox. Arrowheads anchor near their tip
 * (refX 9) so the glyph covers the line end; symmetric glyphs anchor at
 * their center. markerUnits="strokeWidth" scales the marker with the line
 * it decorates.
 */

import type { Marker, MarkerShape } from "../schemas/markers.js";
import { attrs, tag, blockTag, warnRender } from "./utils.js";

const GLYPHS: Record<MarkerShape, { body: (color: string) => string; refX: number }> = {
  triangle: {
    body: (color) => tag("path", attrs({ d: "M0,0 L10,5 L0,10 Z", fill: color })),
    refX: 9,
  },
  arrow: {
    body: (color) => tag("path", attrs({ d: "M0,0 L10,5 L0,10 L3.5,5 Z", fill: color })),
    refX: 9,
  },
  circle: {
    body: (color) => tag("circle", attrs({ cx: 5, cy: 5, r: 4, fill: color })),
    refX: 5,
  },
  square: {
    body: (color) => tag("rect", attrs({ x: 1.5, y: 1.5, width: 7, height: 7, fill: color })),
    refX: 5,
  },
  diamond: {
    body: (color) => tag("path", attrs({ d: "M5,0.5 L9.5,5 L5,9.5 L0.5,5 Z", fill: color })),
    refX: 5,
  },
  bar: {
    body: (color) => tag("rect", attrs({ x: 4, y: 0.5, width: 2, height: 9, fill: color })),
    refX: 5,
  },
};

export function renderMarker(marker: Marker): string {
  const glyph = GLYPHS[marker.shape];
  const size = marker.size ?? 6;
  if (marker.orient === "auto-start-reverse") {
    // Verified 2026-07-13 by pixel-diffing resvg against Chromium: browsers
    // flip the start marker, resvg draws it unflipped. The preview must not
    // lie silently.
    warnRender(
      `Marker "${marker.id}" uses orient "auto-start-reverse": browsers flip the start marker ` +
        `but the preview (resvg) renders it unflipped. For a preview-accurate backward arrow, ` +
        `use a separate marker with a numeric orient instead.`
    );
  }
  const a = attrs({
    id: marker.id,
    viewBox: "0 0 10 10",
    markerWidth: size,
    markerHeight: size,
    refX: glyph.refX,
    refY: 5,
    orient: marker.orient ?? "auto",
    markerUnits: "strokeWidth",
  });
  return blockTag("marker", a, glyph.body(marker.color ?? "#000000"));
}

/** Normalize a marker reference ("id" or "url(#id)") to the bare id. */
export function markerRefId(ref: string): string {
  const m = ref.match(/^url\(#(.+)\)$/);
  return m ? m[1] : ref.replace(/^#/, "");
}

/** Render a marker reference attribute value. */
export function markerRefUrl(ref: string): string {
  return `url(#${markerRefId(ref)})`;
}
