/**
 * Low-level SVG/XML generation utilities.
 *
 * Rules:
 * - escapeXml() on every user-provided string that goes into attribute values or text content
 * - formatNumber() to keep SVG output clean (avoid "10.000000000001")
 * - Never output <script>, event handlers (on*), or external URLs
 * - console.error() for debug logging ONLY — never console.log() (breaks MCP stdio)
 */

// ---------------------------------------------------------------------------
// XML safety
// ---------------------------------------------------------------------------

const XML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escape a string for safe inclusion in XML attribute values or text content. */
export function escapeXml(str: string): string {
  return String(str).replace(/[&<>"']/g, (ch) => XML_ESCAPE[ch] ?? ch);
}

/**
 * Security guard: reject strings that look like JavaScript event handlers or
 * external resource URLs. Returns true if the value is safe to output.
 */
export function isSafeValue(value: string): boolean {
  const lower = value.toLowerCase().trim();
  // Block event handler injection patterns anywhere in the value (defense-in-depth)
  if (/\bon\w+\s*=/i.test(lower)) return false;
  // Block javascript: URIs
  if (lower.startsWith("javascript:")) return false;
  // Allow data:image/ URIs — legitimate for embedding raster images in SVG.
  // Block all other data: URIs (data:text/html etc. can embed scripts).
  if (lower.startsWith("data:") && !lower.startsWith("data:image/")) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Attribute formatting
// ---------------------------------------------------------------------------

/**
 * Format a single attribute as 'name="value"'.
 * Returns empty string if value is null/undefined.
 */
export function attr(name: string, value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const strVal = String(value);
  if (!isSafeValue(strVal)) {
    console.error(`[nakkas] Unsafe attribute value blocked: ${name}="${strVal}"`);
    return "";
  }
  return `${name}="${escapeXml(strVal)}"`;
}

/**
 * Format multiple attributes from an object. Skips null/undefined values.
 * Returns a space-separated attribute string (leading space if non-empty).
 *
 * @example attrs({ fill: "#ff0000", opacity: 0.5 }) → 'fill="#ff0000" opacity="0.5"'
 */
export function attrs(
  obj: Record<string, string | number | boolean | null | undefined>
): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const a = attr(k, v);
    if (a) parts.push(a);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Element generation
// ---------------------------------------------------------------------------

/**
 * Build a complete SVG element string.
 * Uses self-closing form when children is empty/undefined.
 */
export function tag(name: string, attrsStr: string, children?: string): string {
  const a = attrsStr ? ` ${attrsStr}` : "";
  if (!children) return `<${name}${a}/>`;
  return `<${name}${a}>${children}</${name}>`;
}

/** Build an element where children are always on separate indented lines. */
export function blockTag(name: string, attrsStr: string, children: string): string {
  const a = attrsStr ? ` ${attrsStr}` : "";
  if (!children.trim()) return `<${name}${a}/>`;
  return `<${name}${a}>\n${indent(children)}\n</${name}>`;
}

/** Indent each line of a multi-line string by 2 spaces. */
export function indent(content: string, spaces = 2): string {
  const pad = " ".repeat(spaces);
  return content
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/**
 * Format a number for SVG output: trim unnecessary precision.
 * SVG at typical viewport sizes needs at most 1 decimal place.
 */
export function num(n: number, precision = 3): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  const rounded = parseFloat(n.toFixed(precision));
  return String(rounded);
}

/**
 * Format a length value (number or CSS string) for an SVG attribute.
 * Numbers are formatted with num(); strings are passed through.
 */
export function length(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return num(value);
  return value;
}

// ---------------------------------------------------------------------------
// Style string helpers
// ---------------------------------------------------------------------------

/**
 * Build a CSS inline style string from a property map.
 * Merges with an existing style string, placing map properties first.
 * CSS properties use kebab-case keys.
 *
 * @example styleString({ "transform-box": "fill-box" }, "color:red") → "transform-box:fill-box;color:red"
 */
export function styleString(
  cssProps: Record<string, string>,
  existing?: string
): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(cssProps)) {
    if (v) parts.push(`${k}:${v}`);
  }
  if (existing?.trim()) parts.push(existing.trim().replace(/;$/, ""));
  return parts.join(";");
}

// ---------------------------------------------------------------------------
// Comment
// ---------------------------------------------------------------------------

export function comment(text: string): string {
  // Sanitize to avoid breaking XML comment with -->
  return `<!-- ${text.replace(/-->/g, "- ->")} -->`;
}
