/**
 * Browser ground truth for the frame sampler.
 *
 * Randomized (seeded) translateX animations are frozen inside a real
 * headless Chromium via the negative animation-delay trick and read back
 * through getComputedStyle; the same animations are baked with bakeFrame
 * and the rendered transform compared. The 2026-07-09 manual check
 * (scripts/easing-browser-truth.sh) matched to a tenth of a pixel; this
 * test automates it against a whole family of curves.
 *
 * The seed is fixed for deterministic CI; set BROWSER_TRUTH_SEED to fuzz
 * new cases locally. Continuous easings only — steps() lands exactly on
 * discontinuities where "which side" is a spec edge case, not a sampler
 * bug. Skips (with a warning) when no Chromium binary is available.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bakeFrame } from "../src/eyes/sampler.js";
import { renderSVG } from "../src/renderer/svg-renderer.js";
import type { SVGConfig } from "../src/schemas/config.js";

// ---------------------------------------------------------------------------
// Chromium discovery (same order as scripts/easing-browser-truth.sh)
// ---------------------------------------------------------------------------

function findChromium(): string | null {
  // google-chrome-stable first: on CI runners "chromium" can resolve to a
  // snap wrapper that fails headless without extra setup.
  const candidates = ["google-chrome-stable", "google-chrome", "chromium"];
  for (const name of candidates) {
    try {
      const p = execFileSync("which", [name], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (p) return p;
    } catch {
      // keep looking
    }
  }
  try {
    const found = execFileSync(
      "find",
      [join(process.env.HOME ?? "", ".cache/ms-playwright"), "-path", "*chrome-linux*/chrome", "-type", "f"],
      { encoding: "utf8" }
    )
      .split("\n")
      .filter(Boolean)[0];
    if (found && existsSync(found)) return found;
  } catch {
    // no playwright cache
  }
  return null;
}

const chromium = findChromium();

// ---------------------------------------------------------------------------
// Seeded random cases
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Case {
  easing: string;
  duration: number; // seconds
  distance: number; // px
  midOffset: number | null; // extra keyframe at this % (or none)
  midX: number;
  sampleT: number; // seconds
}

const SEED = Number(process.env.BROWSER_TRUTH_SEED ?? 20260713);
const CASE_COUNT = 12;

function buildCases(seed: number): Case[] {
  const rnd = mulberry32(seed);
  const namedEasings = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"];
  const cases: Case[] = [];
  for (let i = 0; i < CASE_COUNT; i++) {
    const useBezier = rnd() < 0.5;
    const easing = useBezier
      ? `cubic-bezier(${(rnd()).toFixed(3)}, ${(rnd() * 3 - 1).toFixed(3)}, ${(rnd()).toFixed(3)}, ${(rnd() * 3 - 1).toFixed(3)})`
      : namedEasings[Math.floor(rnd() * namedEasings.length)];
    const duration = 1 + Math.round(rnd() * 40) / 10; // 1.0 - 5.0s
    const cs: Case = {
      easing,
      duration,
      distance: 100 + Math.round(rnd() * 500),
      midOffset: rnd() < 0.4 ? 30 + Math.round(rnd() * 40) : null,
      midX: 50 + Math.round(rnd() * 300),
      sampleT: Math.round(duration * (0.1 + rnd() * 0.8) * 100) / 100,
    };
    cases.push(cs);
  }
  return cases;
}

// ---------------------------------------------------------------------------
// The two sides of the comparison
// ---------------------------------------------------------------------------

function nakkasTx(c: Case): number {
  const config: SVGConfig = {
    canvas: { width: 800, height: 100 },
    elements: [
      { type: "rect", x: 0, y: 40, width: 22, height: 22, fill: "#111111", cssClass: "run" },
    ],
    animations: [
      {
        name: "run",
        duration: `${c.duration}s`,
        timingFunction: c.easing,
        iterationCount: 1,
        fillMode: "forwards",
        keyframes: [
          { offset: 0, properties: { transform: "translateX(0px)" } },
          ...(c.midOffset !== null
            ? [{ offset: c.midOffset, properties: { transform: `translateX(${c.midX}px)` } }]
            : []),
          { offset: 100, properties: { transform: `translateX(${c.distance}px)` } },
        ],
      },
    ],
  } as SVGConfig;

  const baked = bakeFrame(config, c.sampleT);
  const svg = renderSVG(baked.config);
  const m = svg.match(/transform="translate\((-?[\d.]+)(?:,\s*(-?[\d.]+))?\)"/);
  if (!m) throw new Error(`no baked translate in case: ${JSON.stringify(c)}\n${svg}`);
  return parseFloat(m[1]);
}

function buildHtml(cases: Case[]): string {
  const styles = cases
    .map((c, i) => {
      const mid =
        c.midOffset !== null
          ? `${c.midOffset}%{transform:translateX(${c.midX}px)}`
          : "";
      return (
        `#e${i}{position:absolute;width:22px;height:22px;` +
        `animation:k${i} ${c.duration}s ${c.easing} forwards;` +
        `animation-delay:-${c.sampleT}s;animation-play-state:paused}` +
        `@keyframes k${i}{0%{transform:translateX(0px)}${mid}100%{transform:translateX(${c.distance}px)}}`
      );
    })
    .join("\n");
  const divs = cases.map((_, i) => `<div id="e${i}"></div>`).join("");
  // The animations are paused with negative delays, so getComputedStyle
  // resolves synchronously — no requestAnimationFrame, which is exactly the
  // kind of timing that virtual-time headless runs get wrong.
  return `<!doctype html><html><head><style>${styles}</style></head><body>${divs}<pre id="out"></pre>
<script>
const vals = [];
for (let i = 0; i < ${cases.length}; i++) {
  const m = getComputedStyle(document.getElementById("e" + i)).transform;
  const tx = m && m !== "none" ? /matrix\\(([^)]+)\\)/.exec(m)[1].split(",")[4].trim() : "0";
  vals.push(Number(tx).toFixed(2));
}
document.getElementById("out").textContent = "BROWSER-TRUTH " + vals.join(" ");
</script></body></html>`;
}

function browserTx(cases: Case[]): number[] {
  const dir = mkdtempSync(join(tmpdir(), "nakkas-truth-"));
  const file = join(dir, "cases.html");
  try {
    writeFileSync(file, buildHtml(cases));
    const dom = execFileSync(
      chromium!,
      ["--headless", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=2000", "--dump-dom", `file://${file}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
    );
    const m = dom.match(/BROWSER-TRUTH ((?:-?[\d.]+ ?)+)/);
    if (!m) {
      throw new Error(
        `browser output missing BROWSER-TRUTH line (binary: ${chromium}); dom tail:\n` +
          dom.slice(-400)
      );
    }
    return m[1].trim().split(/\s+/).map(Number);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// The cross-check
// ---------------------------------------------------------------------------

describe.skipIf(!chromium)("browser-vs-sampler ground truth", () => {
  it(
    `matches Chromium within 1px on ${CASE_COUNT} randomized easing cases (seed ${SEED})`,
    () => {
      const cases = buildCases(SEED);
      const browser = browserTx(cases);
      expect(browser).toHaveLength(cases.length);

      for (let i = 0; i < cases.length; i++) {
        const ours = nakkasTx(cases[i]);
        const theirs = browser[i];
        expect(
          Math.abs(ours - theirs),
          `case ${i} (${JSON.stringify(cases[i])}): sampler=${ours} browser=${theirs}`
        ).toBeLessThan(1);
      }
    },
    // Chromium cold-starts slowly on CI runners; the default 5s is not enough.
    40000
  );
});

if (!chromium) {
  console.warn("[browser-truth] no Chromium found — ground-truth cross-check skipped");
}
