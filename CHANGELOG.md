# Changelog

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
