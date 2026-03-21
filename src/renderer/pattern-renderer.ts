/**
 * Pattern element renderers: radial-group, arc-group, grid-group, scatter-group, path-group.
 *
 * Each renderer generates multiple copies of a child element by wrapping it in
 * <g transform="translate(x, y) [rotate(angle)]"> tags. The child's own coordinates
 * remain relative to its local origin at (0, 0).
 */

import type {
  RadialGroup,
  ArcGroup,
  GridGroup,
  ScatterGroup,
  PathGroup,
} from "../schemas/patterns.js";
import { renderBaseAttrs } from "./base-renderer.js";
import { renderSMILAnimations } from "./animation-renderer.js";
import { renderLeafElement } from "./group-renderer.js";
import { blockTag, num } from "./utils.js";

// ---------------------------------------------------------------------------
// radial-group
// ---------------------------------------------------------------------------

export function renderRadialGroup(el: RadialGroup): string {
  const {
    cx,
    cy,
    count,
    radius,
    startAngle = -90,
    rotateChildren = true,
  } = el;

  const stepAngle = 360 / count;

  const copies = Array.from({ length: count }, (_, i) => {
    const angle = startAngle + i * stepAngle;
    const rad = (angle * Math.PI) / 180;
    const x = cx + radius * Math.cos(rad);
    const y = cy + radius * Math.sin(rad);
    const transform = rotateChildren
      ? `translate(${num(x)}, ${num(y)}) rotate(${num(angle)})`
      : `translate(${num(x)}, ${num(y)})`;
    return blockTag("g", `transform="${transform}"`, renderLeafElement(el.child));
  });

  const baseStr = renderBaseAttrs(el);
  const smil = renderSMILAnimations(el.smilAnimations);
  const content = [...copies, ...(smil ? [smil] : [])].join("\n");
  return blockTag("g", baseStr, content);
}

// ---------------------------------------------------------------------------
// arc-group
// ---------------------------------------------------------------------------

export function renderArcGroup(el: ArcGroup): string {
  const {
    cx,
    cy,
    radius,
    count,
    startAngle,
    endAngle,
    rotateChildren = true,
  } = el;

  // When count is 1, place only at startAngle.
  // When count > 1, distribute endpoints inclusive (count - 1 intervals).
  const span = endAngle - startAngle;
  const stepAngle = count === 1 ? 0 : span / (count - 1);

  const copies = Array.from({ length: count }, (_, i) => {
    const angle = startAngle + i * stepAngle;
    const rad = (angle * Math.PI) / 180;
    const x = cx + radius * Math.cos(rad);
    const y = cy + radius * Math.sin(rad);
    const transform = rotateChildren
      ? `translate(${num(x)}, ${num(y)}) rotate(${num(angle)})`
      : `translate(${num(x)}, ${num(y)})`;
    return blockTag("g", `transform="${transform}"`, renderLeafElement(el.child));
  });

  const baseStr = renderBaseAttrs(el);
  const smil = renderSMILAnimations(el.smilAnimations);
  const content = [...copies, ...(smil ? [smil] : [])].join("\n");
  return blockTag("g", baseStr, content);
}

// ---------------------------------------------------------------------------
// grid-group
// ---------------------------------------------------------------------------

export function renderGridGroup(el: GridGroup): string {
  const { x = 0, y = 0, cols, rows, colSpacing, rowSpacing } = el;

  const cells: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = x + col * colSpacing;
      const ty = y + row * rowSpacing;
      const transform = `translate(${num(tx)}, ${num(ty)})`;
      cells.push(blockTag("g", `transform="${transform}"`, renderLeafElement(el.child)));
    }
  }

  const baseStr = renderBaseAttrs(el);
  const smil = renderSMILAnimations(el.smilAnimations);
  const content = [...cells, ...(smil ? [smil] : [])].join("\n");
  return blockTag("g", baseStr, content);
}

// ---------------------------------------------------------------------------
// scatter-group
// ---------------------------------------------------------------------------

/** Linear Congruential Generator seeded PRNG. Returns values in [0, 1). */
function makeLCG(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function renderScatterGroup(el: ScatterGroup): string {
  const { x = 0, y = 0, width, height, count, seed } = el;
  const rand = makeLCG(seed);

  const copies = Array.from({ length: count }, () => {
    const tx = x + rand() * width;
    const ty = y + rand() * height;
    const transform = `translate(${num(tx)}, ${num(ty)})`;
    return blockTag("g", `transform="${transform}"`, renderLeafElement(el.child));
  });

  const baseStr = renderBaseAttrs(el);
  const smil = renderSMILAnimations(el.smilAnimations);
  const content = [...copies, ...(smil ? [smil] : [])].join("\n");
  return blockTag("g", baseStr, content);
}

// ---------------------------------------------------------------------------
// path-group
// ---------------------------------------------------------------------------

interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  length: number;
  angle: number; // degrees
}

function buildSegments(waypoints: { x: number; y: number }[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[i];
    const p1 = waypoints[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    segments.push({ x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, length, angle });
  }
  return segments;
}

function samplePath(
  segments: Segment[],
  totalLength: number,
  t: number // 0 to 1
): { x: number; y: number; angle: number } {
  if (totalLength === 0) return { x: segments[0].x0, y: segments[0].y0, angle: 0 };
  const target = t * totalLength;
  let traveled = 0;
  for (const seg of segments) {
    if (traveled + seg.length >= target || seg === segments[segments.length - 1]) {
      const local = Math.min(target - traveled, seg.length);
      const frac = seg.length > 0 ? local / seg.length : 0;
      return {
        x: seg.x0 + frac * (seg.x1 - seg.x0),
        y: seg.y0 + frac * (seg.y1 - seg.y0),
        angle: seg.angle,
      };
    }
    traveled += seg.length;
  }
  const last = segments[segments.length - 1];
  return { x: last.x1, y: last.y1, angle: last.angle };
}

export function renderPathGroup(el: PathGroup): string {
  const { waypoints, count, rotateChildren = true } = el;
  const segments = buildSegments(waypoints);
  const totalLength = segments.reduce((s, seg) => s + seg.length, 0);

  const copies = Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const { x, y, angle } = samplePath(segments, totalLength, t);
    const transform = rotateChildren
      ? `translate(${num(x)}, ${num(y)}) rotate(${num(angle)})`
      : `translate(${num(x)}, ${num(y)})`;
    return blockTag("g", `transform="${transform}"`, renderLeafElement(el.child));
  });

  const baseStr = renderBaseAttrs(el);
  const smil = renderSMILAnimations(el.smilAnimations);
  const content = [...copies, ...(smil ? [smil] : [])].join("\n");
  return blockTag("g", baseStr, content);
}
