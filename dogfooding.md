# Dogfooding Log

Every significant change ships only after a dogfood run: a design produced through the real MCP stdio layer against the freshly built server, iterated render → preview → critique → revise until it holds up. The test design is tailored to the change under test, so the run proves the feature works, not just that nothing broke. Each entry records the prompt, the number of iterations it took, what the run verified, and where the resulting assets live.

Newest first.

## Unreleased (the eyes) — 2026-07-08, PASS

**Under test:** animation filmstrip sampling (`output.frames`), bounding-box overflow audit, text contrast audit.

**Prompt:** "Render the animated pelican-on-a-bicycle scene with `output:{frames:4}`, then with `output:{frames:6, previewWidth:300}`. Separately render a 200x100 card containing a circle centered off the right edge of the canvas and a caption in deliberately faint gray (#e0e0e0 on #f5f5f5) to trigger both audits."

**Iterations:** 3 verification passes. Pass 1: the 4-frame strip showed cloud drift and wheel-spoke rotation frame to frame, wheels staying centered, confirming the sampled rotations are wrapped in the correct derived transform origin. Pass 2: the broken card produced both audits with exact numbers ("Content extends 70px past the right edge", "Text \"faint\" has 1.21:1 contrast against the #f5f5f5 background (WCAG wants 4.5:1 at 14px)"). Pass 3: the 6-frame strip confirmed per-frame scaling and time labels.

**Assets:** `assets/pelican-frames-2026-07-07.png` (the 4-frame strip).

**Findings:** the filmstrip makes motion reviewable for the first time; a single t=0 preview could never have confirmed rotation direction or drift amplitude. SMIL remains unsampled by design and the response says so.

## v0.2.0 (token economy) — 2026-07-07, PASS

**Under test:** artifact handles, direct preview return from render_svg, use-instanced pattern groups, save by artifact id.

**Prompt:** "A pelican riding a bicycle" (Simon Willison's LLM SVG benchmark), elaborated as a flat-style scene: gradient sky, glowing sun, drifting clouds, red frame bicycle with 8-spoke wheels as radial-groups, the pelican with pouch beak seated on the frame; extended this round with background hills and scatter-group grass tufts.

**Iterations:** 4. Iteration 1 ran the previous release's final config through the new build: the use-instanced wheel spokes rendered pixel-identical to 0.1.7 while the same config shrank from 7553 to 6783 chars, and the preview came back directly from render_svg (one tool call per round instead of render plus preview). Iterations 2 to 4 added hills and grass, then relocated the grass twice: it first collided with the caption, then landed on the sand strip instead of the green band. Scatter-group placement is blind to what sits underneath; only the returned preview image caught it, which is the point of the ritual. The final save used the artifact id, so the SVG text never entered context.

**Assets:** `assets/pelican-2026-07-07-1.svg`, `assets/pelican-2026-07-07-1.png` (saved via the save tool's artifact path; the collision counter appended `-1` as documented).

**Findings:** the whole loop ran on the new token economy end to end. Radial-group children rotate with local +x pointing outward, so spokes must be drawn long on the x axis (carried over from the previous run).

## v0.1.7 (DX repairs) — 2026-07-07, PASS

**Under test:** slim schema passthrough, numeric string coercion, reference integrity checks, render warnings, corrected field hints.

**Prompt:** "A pelican riding a bicycle" (the benchmark), as a flat-style scene: `canvas.preserveAspectRatio` set explicitly, `letterSpacing: "1.5"` passed as a string, gradient and filter referenced via `url(#sky)` and `url(#sunGlow)`, spinning wheel spokes as radial-groups with CSS keyframe animation.

**Iterations:** 4. Iteration 1 exposed the radial-group orientation gotcha: spokes drawn as tall rects (long axis on y) rendered as a chord ring instead of spokes, because children rotate with local +x pointing outward. Iterations 2 to 4 fixed the spokes, the slab wing, the invisible tail and the hidden legs. The run verified the repairs live: preserveAspectRatio survived to the output, the numeric string coerced cleanly, the references passed the new integrity checks, and the animation classes landed on the radial-group wrappers.

**Assets:** `assets/pelican-2026-07-07.svg`, `assets/pelican-2026-07-07.png`.

**Findings:** the radial-group +x-outward orientation is worth documenting in the tool description.
