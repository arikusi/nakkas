# Changelog

## Unreleased

### Dogfood: pelican test (2026-07-07) — PASS

Every release round now closes with a pelican-on-a-bicycle dogfood run: the config is rendered through the real MCP stdio layer against the fresh build, previewed, critiqued and revised for at least three iterations, and the result lands in `assets/` with the date. This round took 4 iterations and verified the DX repairs live: `canvas.preserveAspectRatio` survived to the output (slim passthrough), `letterSpacing: "1.5"` as a string coerced cleanly, `url(#sky)`/`url(#sunGlow)` passed reference checks, and the animation classes landed on the radial-group wrappers. Result: `assets/pelican-2026-07-07.svg` (animated: spinning spokes, drifting clouds) and `assets/pelican-2026-07-07.png`.

One usability finding came out of iteration 1: a radial-group child is rotated so its local +x axis points outward from the center, so a spoke drawn as a tall rect (long axis on y) renders as a chord ring instead of spokes. Worth documenting in the tool description.

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
