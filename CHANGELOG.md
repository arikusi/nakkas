# Changelog

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
