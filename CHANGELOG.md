# Changelog

## 0.1.1

- Reduced total tool context from ~30k tokens to ~636 tokens (schema: 325, description: 311).
- Decoupled tool registration schema from runtime validation. AI sees a compact schema, handler validates with the full schema and returns detailed error messages.
- Moved detailed documentation to llms.txt/llms-full.txt, keeping the tool description minimal.

## 0.1.0

- Initial release
- `render_svg`, `preview`, `save` tools
- CSS @keyframes + SMIL animations
- Pattern primitives (radial, arc, grid, scatter, path groups)
- Parametric curves (rose, heart, star, spiral, superformula, etc.)
- 15 filter presets (glow, neon, blur, glitch, chromatic-aberration, etc.)
- 280 tests
