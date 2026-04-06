<p align="center">
  <img src="assets/logo.svg" alt="nakkas" width="460" />
</p>

<p align="center">
  <strong>MCP server that turns AI into an SVG artist.</strong><br>
  One rendering engine. AI decides everything.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nakkas"><img src="https://img.shields.io/npm/v/nakkas" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/nakkas"><img src="https://img.shields.io/npm/dm/nakkas" alt="downloads" /></a>
  <a href="https://github.com/arikusi/nakkas/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/nakkas" alt="license" /></a>
  <a href="https://github.com/arikusi/arikusi-marketplace"><img src="https://img.shields.io/badge/marketplace-arikusi-orange.svg" alt="Marketplace" /></a>
</p>

<p align="center">
  Officially listed on the <a href="https://registry.modelcontextprotocol.io/?q=io.github.arikusi/nakkas"><strong>MCP Registry</strong></a>, <a href="https://glama.ai/mcp/servers/arikusi/nakkas"><strong>Glama</strong></a>, <a href="https://lobehub.com/mcp/arikusi-nakkas"><strong>LobeHub</strong></a>, and <a href="https://www.pulsemcp.com/servers/arikusi-nakkas"><strong>PulseMCP</strong></a>.
</p>

<p align="center">
  <a href="https://registry.modelcontextprotocol.io/?q=io.github.arikusi/nakkas"><img src="https://img.shields.io/badge/Official_MCP_Registry-active-brightgreen" alt="Official MCP Registry" /></a>
  <a href="https://lobehub.com/mcp/arikusi-nakkas"><img src="https://lobehub.com/badge/mcp/arikusi-nakkas" alt="LobeHub" /></a>
  <a href="https://deepwiki.com/arikusi/nakkas"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki" /></a>
</p>

<p align="center">
  <a href="https://glama.ai/mcp/servers/arikusi/nakkas">
    <img width="380" height="200" src="https://glama.ai/mcp/servers/arikusi/nakkas/badge" alt="Glama Badge" />
  </a>
</p>

> *nakkaş* means painter/artist in Turkish (old).

```
"make a neon terminal logo with animated binary digits"
  → AI constructs JSON config
  → nakkas renders to animated SVG
  → clean animated SVG output
```

## Why

- **One tool, infinite designs.** `render_svg` takes a JSON config. AI fills in everything.
- **AI-native schema.** Every field has `.describe()` annotations so the model knows what to do.
- **Pure declarative SVG.** CSS @keyframes + SMIL animations, no JavaScript.
- **Zero external deps.** No cloud API, no API keys. Runs locally.

## Install

### Claude Desktop

Add to your config file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nakkas": {
      "command": "npx",
      "args": ["-y", "nakkas@latest"]
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add nakkas npx nakkas@latest
```

### Cursor / Zed / Other MCP clients

```json
{
  "mcpServers": {
    "nakkas": {
      "command": "npx",
      "args": ["-y", "nakkas@latest"]
    }
  }
}
```

### Local Development

```bash
git clone https://github.com/arikusi/nakkas
cd nakkas
npm install && npm run build
# Use dist/index.js as the command
```

## Quick Start

Ask your AI (with Nakkas connected):

> "Make an animated SVG: dark terminal frame (800×200), glowing cyan text 'NAKKAS', neon glow filter, fade-in on load."

> "Create a loading spinner: a circle with a draw-on stroke animation that loops every 1.5 seconds."

> "Data visualization: animated bar chart, 5 bars, each fading in with a staggered delay, gradient fills."

> "Profile badge (400×120): blue-to-purple gradient, white username text, drop shadow, subtle pulse animation."

## Tools

Nakkas provides three tools:

| Tool | Purpose |
|---|---|
| `render_svg` | Takes SVGConfig JSON, returns SVG string + design analysis warnings |
| `preview` | Takes rendered content, returns a PNG image for visual inspection |
| `save` | Takes rendered content, saves to disk as SVG (text) or PNG (raster) |

The intended workflow: render → preview → iterate → save. The `save` tool is separate from `render_svg` to encourage previewing and refining before saving.

### The `save` Tool

```json
{ "content": "<svg ...>...</svg>", "outputPath": "./design.svg", "format": "auto" }
```

Formats: `auto` (infers from extension), `svg` (text file), `png` (renders to raster first). If the file exists, a numeric counter is appended to prevent overwriting. The actual saved path is returned.

## The `render_svg` Tool

**Input:** `SVGConfig` JSON object
**Output:** Complete SVG XML string plus optional design analysis notes

After rendering, the response may include design warnings about common issues such as too many concurrent animations, missing transformBox, or group-level scale transforms.

### SVGConfig Structure

```typescript
{
  canvas: {
    width: number | string,   // e.g. 800 or "100%"
    height: number | string,
    viewBox?: string,          // "0 0 800 400"
    background?: string        // hex "#111111" or "transparent"
  },

  defs?: {
    gradients?: Gradient[],   // linearGradient | radialGradient
    filters?: Filter[],        // preset or raw primitives
    clipPaths?: ClipPath[],
    masks?: Mask[],
    symbols?: Symbol[],
    paths?: { id, d }[]       // for textPath elements
  },

  elements: Element[],         // shapes, text, groups, use instances

  animations?: CSSAnimation[]  // CSS @keyframes definitions
}
```

### Element Types

| Type | Required fields | Notes |
|------|----------------|-------|
| `rect` | `width`, `height` | `x`, `y` default 0; `rx`/`ry` for rounded corners |
| `circle` | `r` | `cx`, `cy` default 0 |
| `ellipse` | `rx`, `ry` | Independent horizontal/vertical radii |
| `line` | `x1`, `y1`, `x2`, `y2` | |
| `polyline` | `points` | Open path: `"10,20 50,80 90,20"` |
| `polygon` | `points` | Auto-closed shape |
| `path` | `d` | Full SVG path commands |
| `image` | `href`, `width`, `height` | URL or `data:image/...` URI for embedded images |
| `text` | `content` | String or `(string \| Tspan)[]` array |
| `textPath` | `pathId`, `text` | Text following a curve; path defined in `defs.paths` |
| `group` | `children` | Shared attrs applied to all children (no nested groups) |
| `use` | `href` | Instance a symbol or clone an element by `#id` |
| `radial-group` | `cx`, `cy`, `count`, `radius`, `child` | Place N copies around a full circle |
| `arc-group` | `cx`, `cy`, `radius`, `count`, `startAngle`, `endAngle`, `child` | Place N copies along a circular arc |
| `grid-group` | `cols`, `rows`, `colSpacing`, `rowSpacing`, `child` | Place copies in an M by N grid |
| `scatter-group` | `width`, `height`, `count`, `seed`, `child` | Scatter N copies at seeded random positions |
| `path-group` | `waypoints`, `count`, `child` | Distribute N copies evenly along a polyline |
| `parametric` | `fn` | Mathematical curve: `rose`, `heart`, `star`, `lissajous`, `spiral`, `superformula`, `epitrochoid`, `hypotrochoid`, `wave` |

### All Visual Elements (Shared Fields)

```typescript
{
  id?: string,             // required for filter/gradient/clip references
  cssClass?: string,       // matches CSS animation names
  fill?: string,           // "#rrggbb" | "none" | "url(#gradId)"
  stroke?: string,
  strokeWidth?: number,
  strokeDasharray?: string, // "10 5", use for draw-on animation
  strokeDashoffset?: number,
  opacity?: number,        // 0–1
  filter?: string,         // "url(#filterId)"
  clipPath?: string,       // "url(#clipId)"
  transform?: string,      // "rotate(45)" "translate(100, 50)"
  transformBox?: "fill-box" | "view-box" | "stroke-box",  // set "fill-box" for CSS rotation
  transformOrigin?: string, // "center", works with fill-box
  smilAnimations?: SMILAnimation[]
}
```

### Filter Presets

Reference as `filter: "url(#myId)"` on any element after defining in `defs.filters`:

```json
{ "type": "preset", "id": "myGlow", "preset": "glow", "stdDeviation": 8, "color": "#ff00ff" }
```

| Preset | Key params | Effect |
|--------|-----------|--------|
| `glow` | `stdDeviation`, `color` | Soft halo |
| `neon` | `stdDeviation`, `color` | Intense bright glow |
| `blur` | `stdDeviation` | Gaussian blur |
| `drop-shadow` | `stdDeviation`, `offsetX`, `offsetY`, `color` | Drop shadow |
| `glitch` | `stdDeviation` | Turbulence displacement (animated) |
| `grayscale` | `value` (0–1) | Desaturate |
| `sepia` | — | Warm sepia tone |
| `invert` | — | Invert colors |
| `saturate` | `value` | Boost/reduce saturation |
| `hue-rotate` | `value` (degrees) | Shift hues |
| `chromatic-aberration` | `value` (px offset, default 3) | RGB channel split for lens distortion look |
| `noise` | `value` (opacity 0 to 1, default 0.25) | Film grain and texture overlay |
| `outline` | `color`, `value` (thickness, default 2) | Colored outline around the element |
| `inner-shadow` | `color`, `stdDeviation`, `value` (opacity, default 0.5) | Shadow inside the element |
| `emboss` | `stdDeviation`, `value` (intensity, default 1.5) | 3D relief shading effect |

### CSS Animations

```json
{
  "animations": [{
    "name": "pulse",
    "duration": "2s",
    "iterationCount": "infinite",
    "direction": "alternate",
    "keyframes": [
      { "offset": "from", "properties": { "opacity": "0.3", "transform": "scale(0.9)" } },
      { "offset": "to",   "properties": { "opacity": "1",   "transform": "scale(1.1)" } }
    ]
  }],
  "elements": [{
    "type": "circle",
    "cx": 100, "cy": 100, "r": 40,
    "cssClass": "pulse",
    "transformBox": "fill-box",
    "transformOrigin": "center"
  }]
}
```

**CSS property keys**: camelCase (`strokeDashoffset`) or kebab-case (`stroke-dashoffset`). Both work.

**Animatable CSS properties**: `opacity`, `fill`, `stroke`, `transform`, `filter`, `clip-path`, `stroke-dasharray`, `stroke-dashoffset`, `font-size`, `letter-spacing` and more.

### SMIL Animations

Three SMIL types, defined inline on each element via `smilAnimations: []`:

```json
{ "kind": "animate",          "attributeName": "d",       "from": "...", "to": "...", "dur": "2s" }
{ "kind": "animateTransform", "type": "rotate",            "from": "0 100 100", "to": "360 100 100", "dur": "3s" }
{ "kind": "animateMotion",    "path": "M 0 0 C ...",      "dur": "4s", "rotate": "auto" }
```

**Path morphing** (`attributeName: "d"`): from/to paths must have identical command types and counts. Only coordinates can differ.

### Fonts

System fonts work everywhere without any loading: `Arial`, `Helvetica`, `Courier New`, `Georgia`, `Verdana`, `monospace`, `sans-serif`, `serif`.

Custom font families are also accepted. They work when the font is available in the rendering environment (web page with loaded fonts, design tool, etc.).

### Use Cases & Compatibility

| Context | CSS @keyframes | SMIL | External fonts | Interactive (onclick) |
|---------|---------------|------|---------------|----------------------|
| GitHub README `<img>` | ✅ | ✅ | ❌ | ❌ |
| Web page `<img>` | ✅ | ✅ | ❌ | ❌ |
| Web page inline SVG | ✅ | ✅ | ✅ | ✅ |
| Design tool export | ✅ | ✅ | ✅ | — |
| Static file viewer | ✅ | ✅ | depends | depends |

## Troubleshooting

### "MCP error -32602: Input validation error"

This means the MCP SDK rejected the input before it reached the handler. It usually happens on the first attempt and works on retry. The most common triggers:

* **Gradient type typo.** Use `"linearGradient"` or `"radialGradient"`, not `"linear"` or `"radial"`. This is the single most frequent mistake.
* **Keyframe offset as string.** Write `0` or `100` (numbers) or `"from"` / `"to"`. Writing `"0%"` or `"100%"` will fail.
* **Named colors.** Only hex values work: `"#ff0000"`, not `"red"`. No `rgb()` either.
* **Missing `type` on elements.** Every element object needs a `type` field.

If you're building an MCP client integration and seeing this consistently, the issue is likely in how your client serializes arguments. See [anthropics/claude-code#29104](https://github.com/anthropics/claude-code/issues/29104) for context on known serialization quirks.

### Preview shows a blank or unexpected image

The preview tool renders a static snapshot at t=0. Animations are not captured. What you see is the SVG's initial state before any CSS or SMIL animation starts.

If the image is completely blank:

* Check that your elements have `fill` or `stroke` set. A shape without fill on a transparent canvas is invisible.
* Check coordinates. An element at `x: 2000` on an `800px` wide canvas is simply off-screen.
* If using `filter: "url(#myFilter)"`, make sure `myFilter` is actually defined in `defs.filters`.

### Animations not working on GitHub

GitHub READMEs render SVG through `<img>` tags, which strips JavaScript but keeps CSS and SMIL. If your animation works locally but not on GitHub:

* Avoid `<script>` or event handlers (`onclick`, `onmouseover`). These are removed.
* External fonts won't load. Stick to system fonts: `Arial`, `Courier New`, `Georgia`, `monospace`, `sans-serif`.
* CSS `@import` for fonts is blocked. If you need a specific font, use inline `<text>` with a system fallback.

### Large SVG output

If `render_svg` returns a warning about file size (over 50kb), the parametric curves or pattern groups are probably generating too many elements. Reduce `steps` on parametric curves or `count` on pattern groups. A grid-group with `cols: 50, rows: 50` produces 2500 elements, which adds up fast.

## Tech Stack

* TypeScript + Node.js 18+
* `@modelcontextprotocol/sdk` (MCP server)
* `zod` (schema validation and AI type guidance)
* No external SVG libraries, pure XML construction
* Vitest (280 tests)

## License

MIT. Built by [arikusi](https://github.com/arikusi).
