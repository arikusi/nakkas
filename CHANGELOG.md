# Changelog

## 0.4.0

Text layout release: the audits learn to read. Dogfood record: see `dogfooding.md`.

* Every text and textPath element is now measured after rendering: each one is rendered in isolation through resvg and its ink bounding box (tight glyph outlines, real fonts) recorded. Text inside a group keeps the group's transform. Measurement is capped at 24 texts per render, with a note when anything was skipped.
* Named overflow warnings: text that escapes the viewport produces a design note naming the text and the exact overflow in pixels, next to the generic content-bounds warning that could only say something was clipped. `Text "runaway label" extends 95.3px past the right edge of the viewport.`
* Text-on-text collision detection: any two ink boxes intersecting by more than a hair produce a note naming both texts and the overlap size. Boxes are measured at the base state; when one of the texts is animated the note says so. Pattern-group text children are exempt, since overlap among generated copies is usually the design.
* The render_svg description mentions the new audit so the model knows escaped and colliding text will be caught.
* 383 tests (10 new covering ink measurement, group transforms, tspan flattening, the cap, and both checks).

## 0.3.1

Model-surface release: the tool description learns the lessons the dogfood runs kept teaching. Dogfood record: see `dogfooding.md`.

* The pattern-group paragraph in the `render_svg` description now states the orientation rule that cost an iteration in every radial design so far: the child is drawn at the local origin with local +x pointing outward, so spokes, rays and petals must be drawn long along the x axis or they render as a chord ring. This was documented in the README since 0.1.7 but never where the model actually reads.
* New design guide block in the description: one spacing unit and multiples of it everywhere, edge clearance of at least 5% of the smaller canvas dimension, at most 3 font sizes with clear jumps, WCAG contrast targets (4.5:1 body, 3:1 from 24px), and easing choices (ease-out entrances, ease-in-out loops, linear only for continuous rotation or travel).
* New regression tests pin the orientation line and the design guide in the description and cap its size, so the model surface cannot silently regress or creep past its token budget. 373 tests.

## 0.3.0

The eyes release: the preview stops lying about motion and starts catching layout and readability mistakes. Dogfood record: see `dogfooding.md`.

* New `output.frames: N` (2 to 10): instead of the single t=0 preview, render_svg samples the CSS animations at N points in time and returns one labeled filmstrip image. nakkas evaluates the @keyframes math itself — duration, delay, iteration count, direction, fill mode, and easing per segment (named curves, cubic-bezier, steps) — and bakes each sampled state into a static frame. Transform animations resolve transform-box: fill-box / transform-origin: center numerically from the element's geometry (shapes, pattern groups, groups of shapes); elements whose origin cannot be derived keep their base state and say so in a note. SMIL is not sampled and is noted when present.
* Bounding-box audit: after every render the content's real bounding box (from resvg) is compared against the viewport, and anything poking past an edge produces a design note with the exact overflow in pixels. Previously off-canvas content was silently clipped in the preview.
* Text contrast audit: text with a plain hex fill is checked against a plain hex canvas background using WCAG contrast ratios (3:1 at 24px and above, 4.5:1 below), with the failing ratio in the note. Gradient and pattern fills are skipped, not guessed.
* Frame baking rewrites CSS-only transform shorthands to SVG attribute syntax: translateX(a) becomes translate(a, 0), scaleY(a) becomes scale(1, a), skewX keeps its casing. Baked verbatim they are invalid in the transform attribute and resvg drops the whole transform, freezing the element. Found by the easing-comparison dogfood on its first frame.
* 370 tests (34 new covering easing evaluation, value interpolation, the CSS-to-SVG transform rewrite, progress math, frame baking, filmstrip composition and both audits).

## 0.2.0

Token economy release: an iteration loop no longer pays context tokens for SVG text. Minor version bump because the default render_svg response shape changed. Dogfood record: see `dogfooding.md`.

* render_svg now answers with a PNG preview image plus a server-side artifact id instead of the SVG text. The store keeps the 32 most recent renders for the process lifetime. preview and save accept `artifact: "art-1"` directly, so the render → look → revise loop costs one tool call per round and the SVG string never travels through the model's context window. This is the new default; the previous behavior is one flag away.
* New top-level `output` config block controls the response shape: `svg: true` includes the SVG text, `preview: false` skips the image, `previewWidth` scales it, `minify: true` collapses inter-tag whitespace in the stored and saved SVG.
* Pattern groups (radial, arc, grid, scatter, path) now render the child element once into a local defs block and instance it with `<use>` per placement. A 12×12 grid went from 144 full copies of the child markup to one definition plus 144 one-line use tags. Also fixes duplicated ids when a pattern child carried an id.
* Parametric path data coordinates are capped at 2 decimals (was 3); at hundreds of sampled points the third decimal was pure bloat.
* preview and save return a clear error naming the live artifact ids when given an unknown or expired id, and still accept raw `content` for anything that did not come from render_svg.
* 336 tests (20 new covering the artifact store, minification, use-instancing, output options and coercion).

## 0.1.7

Dogfood record: see `dogfooding.md`.

* Fixed the slim registration schema silently stripping valid fields before the handler ran. `canvas.preserveAspectRatio` and any other key the full schema accepts vanished without an error because the MCP SDK parses arguments through plain `z.object()`. Every object in the slim schema is now `.passthrough()`; the full schema in the handler is the single validation authority.
* Fixed validation cheat sheets teaching wrong field names: the grid-group hint said `spacingX`/`spacingY` where the schema wants `colSpacing`/`rowSpacing`, and the parametric hint said `size` and `freqX`/`freqY` where the schema wants `scale` and `freqA`/`freqB`. Added hints for arc-group, scatter-group and path-group, plus a test that cross-checks every hint against the real schema shape.
* Numeric strings now coerce on all number fields: `letterSpacing: "6"` or `strokeWidth: "2.5"` is converted instead of rejected, so CSS-style habits no longer cost a retry round-trip. Non-numeric strings still fail with the same field-level messages.
* Added reference integrity checks before rendering. Dangling `url(#id)` in `fill`/`stroke`/`filter`/`clipPath`/`mask`, `use.href` with no matching symbol or element, `textPath.pathId` missing from `defs.paths`, dangling gradient `href` inheritance, and duplicate IDs are all rejected with the exact field path and the list of defined IDs. Previously these rendered silently broken output.
* Attribute values blocked by the security filter (event handlers, `javascript:` URIs, non-image `data:` URIs) now surface as a design note in the tool response naming the omitted attribute. Previously the only trace was a stderr line the model never saw.
* Corrected the `render_svg` tool description: gradient stop and filter colors are hex-only but element `fill`/`stroke` accept any paint string; grid-group takes `cols`/`rows` (not `count`); `epitrochoid` added to the parametric function list; parametric size is set via `scale`; per-type pattern group fields spelled out.

## 0.1.6

* Fixed background rect ignoring the viewBox origin: with a centered viewBox like `-100 -100 200 200` the background covered only one quadrant. It now anchors to the viewBox rect.
* Fixed generic font families (`monospace`, `sans-serif`, `serif`) rendering with an arbitrary substitute font in preview and PNG save. Generic keywords are now resolved to real fonts before rasterization, using fontconfig's own mapping on Linux and platform defaults on macOS and Windows.
* Validation errors now name the actual failing field. `elements.1: Invalid input` became `elements.1.content: Required`, with a field cheat sheet for the failing element type appended to the error.
* Added a field reference section to the `render_svg` tool description covering the names that differ from raw SVG: text uses `content`, textPath uses `pathId` plus `text`, groups use `children`, pattern groups take a single `child`.
* Docker image now installs fontconfig and DejaVu fonts; text previously rasterized as blank glyphs in the container.
* README rewritten around the preview loop: AI-readable summary paragraph, honest font guidance (generic families first, named fonts only with a fallback), documented field name differences, and a note on the new validation errors. llms.txt and llms-full.txt synced.
* server.json version tracking fixed; the MCP Registry entry had gone stale at 0.1.4 because it was never bumped.

## 0.1.5

* Relaxed slim schema: removed `.min()` constraints from `elements` and `keyframes` in the MCP-facing schema. Validation still happens in the handler with clear error messages instead of cryptic `-32602` errors. Closes #2.
* Added troubleshooting section to README covering common validation errors, blank previews, GitHub animation quirks, and large SVG output.
* Added DeepWiki badge.

## 0.1.4

* Added Linux config path to Claude Desktop install section.
* Added Official MCP Registry and PulseMCP listing badges.

## 0.1.3

- Fixed keyframe offset bug: values 0-1 (fractional) now correctly map to 0%-100%. Previously 1 became 1% instead of 100%.
- Added critical format rules to tool description to reduce first-attempt validation errors.

## 0.1.2

- Reduced tool description from ~1.8k to ~311 tokens. Total tool context now ~636 tokens.

## 0.1.1

- Reduced MCP tool schema from ~28k to ~325 tokens.
- Decoupled tool registration schema from runtime validation. AI sees a compact schema, handler validates with the full schema and returns detailed error messages.

## 0.1.0

- Initial release
- `render_svg`, `preview`, `save` tools
- CSS @keyframes + SMIL animations
- Pattern primitives (radial, arc, grid, scatter, path groups)
- Parametric curves (rose, heart, star, spiral, superformula, etc.)
- 15 filter presets (glow, neon, blur, glitch, chromatic-aberration, etc.)
- 280 tests
