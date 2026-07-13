# Dogfooding Log

Every significant change ships only after a dogfood run: a design produced through the real MCP stdio layer against the freshly built server, iterated render → preview → critique → revise until it holds up. The test design is tailored to the change under test, so the run proves the feature works, not just that nothing broke. Each entry records the prompt, the number of iterations it took, what the run verified, and where the resulting assets live.

Newest first.

## v0.5.0 (markers + gradient contrast) — 2026-07-13, PASS

**Under test:** defs.markers presets on line and path elements, marker reference integrity, and the contrast audit's new gradient branch.

**Prompt (feature-tailored):** "A pipeline flow diagram (640 wide, light background): three rounded boxes labeled render_svg, preview, save, connected left to right by solid arrows with triangle heads; a dashed feedback loop from preview back into render_svg with a circle at its start and an open arrow at its end; a bold gradient-filled title."

**Iterations:** 3. Iteration 1 never rendered: the title referenced `url(#title)` before the gradient was defined and the reference check rejected the config pre-render with the exact field path — the 0.1.7 layer doing its job on a 0.5.0 design. Iteration 2 rendered the diagram correctly on the first visual pass (triangle heads on the solid connectors, the dashed loop starting with a circle at preview's underside and ending in an open arrow pointing up into render_svg) and the contrast audit caught a genuine borderline miss no eye would: the caption's #64748b on #f7f8fa measures 4.48:1, two hundredths under the 4.5:1 threshold. Iteration 3 darkened the caption and came back with zero notes. A deliberate probe alongside it swapped the title gradient's second stop for near-background #dbe2f0: the new gradient branch reported `stop #dbe2f0 has only 1.22:1 contrast` — and in the probe image the word sitting on that stop visibly dissolves into the background, exactly what the note claims.

**Assets:** `assets/flow-2026-07-13.svg` and `.png` (saved via the artifact path), `assets/flow-lowcontrast-2026-07-13.png` (the gradient probe, warning fired).

**Findings:** marker orientation, strokeWidth scaling and the url(#id) normalization all behaved on first render; the diagram use case is genuinely unlocked. The 4.48:1 caption catch is the strongest argument yet for numeric audits: it looks fine and is not.

**Edge-case audit (pre-release hardening, 2026-07-13):** a six-scenario probe card pushed the marker feature into its corners through the real MCP layer: zero-length line, strokeless line, auto-start-reverse, markerMid on a curved path, a marker inside a radial-group child, and strokeWidth scaling. The same SVG was then screenshotted in headless Chromium and pixel-diffed against the resvg preview. Five scenarios matched; one did not: column-height profiling of the start marker showed Chromium flips `auto-start-reverse` (wedge thin-to-tall, tip left) while resvg draws it unflipped (tall-to-thin, tip right). Fixed as a design note on render rather than dropping the feature, since browsers render it correctly. The strokeless case produced near-invisible 6px markers and no line, now also a design note. Separate probes found invisible text (opacity 0) triggering false-positive overlap warnings (now exempt) and measured the audit stack's font-scan cost: resvg re-scans system fonts per instance (~90ms), so 24 isolated text measurements cost 2.2s; with generic families resolved to explicit font files the same audit runs in 25ms with identical boxes (parity pinned by test). Also verified on the way: resvg getBBox returns viewBox-space coordinates in every canvas/viewBox combination (the audits' core assumption), markers survive bakeFrame and minify, symbol children carry markers through refcheck and rendering, marker/element id collisions are caught, gradient stops with alpha parse, and Turkish/emoji text measures cleanly. Probe card: `assets/marker-edges-2026-07-13.png`.

**Supporting pass (browser cross-check automation, same release):** the manual `scripts/easing-browser-truth.sh` check became `tests/browser-truth.test.ts`: 12 seeded random translateX animations frozen in headless Chromium and diffed against bakeFrame within 1px. The harness was validated both ways: three extra seeds (7, 4242, 987654) all matched 12/12, and a deliberately planted 10% error in the cubic-bezier evaluator made the test fail before the revert brought it back to green. A guard that cannot fail is not a guard; this one can and did.

## v0.4.0 (text layout) — 2026-07-13, PASS

**Under test:** per-text ink measurement and the two audits built on it: named viewport-overflow warnings and text-on-text collision detection.

**Prompt (feature-tailored):** "A repo badge card (480 wide, dark background): bold title, a one-line subtitle describing the project, and three stat pills (downloads, tests, license) with centered labels. Written the way a first attempt realistically goes: the subtitle drafted too long for the canvas."

**Iterations:** 3. Iteration 1: the 94-character subtitle overran the canvas and the response carried two notes side by side — the old generic "Content extends 95.3px past the right edge" and the new one naming the culprit: `Text "the MCP server that rend" extends 95.3px past the right edge of the viewport. Move it inside, shorten it, or reduce its font size.` The attribution is the feature: no hunting through elements for which one escaped. Iteration 2: subtitle shortened per the note; the card came back with zero notes. A deliberate collision probe alongside it (subtitle baseline shoved up into the title's ink at y=38) produced `Text "nakkas" overlaps text "renders, previews and au" by 79.9x12.2px. Give them separate space.` — and the preview shows exactly that ink collision. Iteration 3: spacing tightened to a strict 8 rhythm (subtitle to pills 32, pill row 88 to 120, canvas 144 for a 24px bottom margin per the v0.3.1 design guide); audits stayed silent and the card reads balanced.

**Assets:** `assets/badge-2026-07-13.svg` and `.png` (saved via the artifact path), `assets/badge-collide-2026-07-13.png` (the collision probe, warning fired).

**Findings:** rendering each text in isolation through resvg gives real glyph-outline boxes, so the overlap check has no false positives from line-box padding: texts 30px apart measure clean, texts printed through each other measure 79.9x12.2px. The generic bounds warning and the named text warning appearing together reads well, not redundantly: one says the canvas is broken, the other says by whom.

## v0.3.1 (model surface) — 2026-07-13, PASS

**Under test:** the new guidance in the render_svg tool description: the radial-group "+x points outward" orientation rule and the design guide (spacing unit, edge clearance, 3-size type scale, contrast targets, easing choices). A description change can only be dogfooded indirectly, so the run produced a design by following the new guidance to the letter and checked whether it holds up on the first attempt where the old description used to cost an iteration.

**Prompt (feature-tailored):** "A wall clock badge card (360x360, light background): a clock face with 12 tick marks as a radial-group, a two-tone second hand rotating continuously, title and caption typography. Follow the design guide: 8px spacing rhythm, 12/16/24 type scale, 4.5:1 contrast, linear easing for the continuous rotation. Verify the motion with output:{frames:4}."

**Iterations:** 3. Iteration 1: the ticks came out pointing correctly outward on the first attempt (drawn long on x, as the new description line instructs) — in v0.1.7 this exact shape cost an extra round as a chord ring. Two design flaws remained: the tick ring at radius 84 with 14px length pierced the face rim at r=96, and the second hand (a single symmetric rect, needed so the bbox-center rotation origin lands on the pivot) read as a directionless bar. Iteration 2: ticks moved fully inside the face (radius 74, length 12) and the hand became a two-tone needle — a group of two rects symmetric about the pivot, red north and gray south, so the group's bbox center still equals the clock center and the rotation stays true. Iteration 3: output:{frames:4} confirmed the motion: the red tip hits 12, 3, 6, 9 o'clock across the strip (clockwise quarter turns of the 6s linear loop) with the needle pinned to the derived center in every frame. Neither audit produced a note: content clears the edges and both text fills pass their WCAG thresholds, as the design guide told the config to do in the first place.

**Assets:** `assets/clock-2026-07-13.svg` and `.png` (saved via the artifact path), `assets/clock-frames-2026-07-13.png` (the 4-frame strip).

**Findings:** the orientation line pays for itself immediately; the guide's numbers (spacing multiples, type jumps, contrast) translate directly into silent audits. The bbox-center rotation origin remains the one modeling constraint the config author must design around (symmetric geometry about the pivot); worth considering an explicit transformOrigin coordinate pair some day.

## v0.3.0 (the eyes) — 2026-07-09, PASS

**Under test:** animation filmstrip sampling (`output.frames`) with its easing math, bounding-box overflow audit, text contrast audit.

**Prompt (feature-tailored):** "An easing comparison card (700x320, light background): four labeled lanes for linear, ease-in, ease-out and cubic-bezier(0.68, -0.55, 0.265, 1.55). Each lane has a track with end ticks and a colored ball that travels the same 560px in the same 3 seconds, differing only in timing function (iterationCount 1, fillMode forwards). Quarter-distance guide lines across the lanes. Render with output:{frames:5} so the positions diverge frame by frame."

**Iterations:** 4. Iteration 1 caught a real bug, which is exactly what a feature-shaped design is for: none of the balls moved, because the keyframes used CSS axis shorthands (`translateX`) and the sampler baked them verbatim into the SVG `transform` attribute, where they are invalid syntax and resvg drops the whole attribute. The fixed pelican scene could never have caught this — it only animates `rotate` and `translate`. Fix: the sampler now rewrites CSS-only functions to SVG syntax (translateX(a) → translate(a, 0), scaleY(a) → scale(1, a), skewX casing restored) with two regression tests. Iteration 2 showed the physics correctly: ease-in lagging linear, ease-out leading, and the back bezier dipping BEHIND the start line at t=0.75s (its -0.55 control point) then overshooting past the end tick at t=2.25s before settling. Iteration 3 added quarter-distance guides; the linear ball sits exactly on the midpoint guide at t=1.5s. Iteration 4 came from user review: the bezier ball's overshoot read as a rendering glitch to a viewer without the math in their head. Two things followed. First, a pixel-truth measurement: ball centers were extracted from the strip per frame with a color-mask centroid and compared against the easing math — all 20 positions (4 balls x 5 frames) landed within about 1px of expectation (the constant 1.1px residual is centroid bias from anti-aliased edges), so there was no drift; the "shift" was the bezier doing exactly what cubic-bezier(0.68, -0.55, 0.265, 1.55) does. Second, a legibility fix: the lane now carries dashed track extensions, hollow rings at the precomputed overshoot extremes (x=23.6 and x=679.9) and the caption "overshoots by design (y < 0, y > 1)" — and the ball landing exactly on those rings doubles as an embedded correctness proof.

**Supporting passes (pelican + audits, 2026-07-07):** the 4-frame pelican strip showed cloud drift and wheel-spoke rotation with wheels staying centered (derived transform origins correct); a deliberately broken 200x100 card (circle off the right edge, #e0e0e0 caption on #f5f5f5) produced both audits with exact numbers ("Content extends 70px past the right edge", "Text \"faint\" has 1.21:1 contrast, WCAG wants 4.5:1 at 14px"); a 6-frame strip at previewWidth 300 confirmed scaling and labels.

**Browser ground truth (2026-07-09):** user review then asked about the ball moving BACKWARD between t=0 and t=0.75s. That is the curve itself: cubic-bezier(0.68, -0.55, 0.265, 1.55) has negative eased progress in its first phase (a windup before the launch). To settle it beyond argument, the same animation was frozen inside a real headless Chromium using the negative animation-delay trick and read back via getComputedStyle: the browser puts the ball at translateX = -46.4px at t=0.75s, 339.7px at t=1.5s and 609.9px at t=2.25s — positions 23.6 / 409.7 / 679.9 on the track, matching nakkas's sampled frames to a tenth of a pixel. The sampler agrees with Chromium's animation engine exactly. The harness is checked in as `scripts/easing-browser-truth.sh` (plus its HTML fixture) and can be re-run against any chromium; it is the seed of an automated browser-vs-sampler cross-check.

**Assets:** `assets/easing-frames-2026-07-09.png` (the 5-frame strip), `assets/easing-compare-2026-07-09.svg` and `.png` (the scene, saved via the artifact path), `assets/pelican-frames-2026-07-07.png`. Reproducible check: `scripts/easing-browser-truth.sh`.

**Findings:** the filmstrip makes motion reviewable for the first time, down to easing curve shape. CSS axis shorthand transforms in keyframes are common model output; the rewrite in the sampler is load-bearing. SMIL remains unsampled by design and the response says so.

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
