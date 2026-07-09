/**
 * Filmstrip composition: N frame PNGs → one labeled strip PNG.
 *
 * Frames are embedded as data:image/png URIs in a wrapper SVG and rasterized
 * with the same resvg pipeline as everything else — no raster compositing
 * library needed. One image block costs the model far fewer tokens than N.
 */

import { svgToPng } from "../preview.js";

export interface FilmstripFrame {
  png: Buffer;
  label: string;
}

const GAP = 4;
const LABEL_BAND = 20;

/** Compose frames horizontally with a time label under each. */
export function buildFilmstrip(
  frames: FilmstripFrame[],
  frameWidth: number,
  frameHeight: number
): Buffer {
  const totalW = frames.length * frameWidth + (frames.length - 1) * GAP;
  const totalH = frameHeight + LABEL_BAND;

  const cells = frames
    .map((f, i) => {
      const x = i * (frameWidth + GAP);
      const href = `data:image/png;base64,${f.png.toString("base64")}`;
      return [
        `<image x="${x}" y="0" width="${frameWidth}" height="${frameHeight}" href="${href}"/>`,
        `<rect x="${x + 0.5}" y="0.5" width="${frameWidth - 1}" height="${frameHeight - 1}" fill="none" stroke="#00000033" stroke-width="1"/>`,
        `<text x="${x + frameWidth / 2}" y="${frameHeight + 14}" font-family="monospace" font-size="11" fill="#666666" text-anchor="middle">${f.label}</text>`,
      ].join("\n");
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">\n${cells}\n</svg>`;
  return svgToPng(svg);
}
