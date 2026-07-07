/**
 * ID and reference integrity checks.
 *
 * A config can pass schema validation and still render broken output:
 * fill="url(#missing)" paints nothing, use.href="#nothing" draws nothing,
 * duplicate IDs make the browser pick one silently. None of that is visible
 * until the preview comes back wrong, and even then the cause is invisible.
 * This module catches those cases before rendering, with field-level paths.
 */

import type { SVGConfig, AnyElement } from "./schemas/config.js";

interface IdTable {
  /** id → where it was defined, for duplicate reporting */
  all: Map<string, string[]>;
  paints: Set<string>; // gradients + patterns → url(#id) in fill/stroke
  filters: Set<string>;
  clipPaths: Set<string>;
  masks: Set<string>;
  paths: Set<string>; // defs.paths → textPath.pathId
  useTargets: Set<string>; // symbols + element ids → use.href
}

const URL_REF = /url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/;

function extractUrlRef(value: string | undefined): string | null {
  if (!value) return null;
  const m = URL_REF.exec(value);
  return m ? m[1] : null;
}

function define(table: IdTable, id: string, where: string): void {
  const sites = table.all.get(id);
  if (sites) sites.push(where);
  else table.all.set(id, [where]);
}

function collectElementIds(
  table: IdTable,
  elements: AnyElement[],
  pathPrefix: string
): void {
  elements.forEach((el, i) => {
    const where = `${pathPrefix}.${i}`;
    const id = (el as { id?: string }).id;
    if (id) {
      define(table, id, where);
      table.useTargets.add(id);
    }
    if (el.type === "group") {
      collectElementIds(table, el.children as AnyElement[], `${where}.children`);
    }
    const child = (el as { child?: AnyElement }).child;
    if (child) collectElementIds(table, [child], `${where}.child`);
  });
}

function buildIdTable(config: SVGConfig): IdTable {
  const table: IdTable = {
    all: new Map(),
    paints: new Set(),
    filters: new Set(),
    clipPaths: new Set(),
    masks: new Set(),
    paths: new Set(),
    useTargets: new Set(),
  };
  const defs = config.defs;
  defs?.gradients?.forEach((g, i) => {
    define(table, g.id, `defs.gradients.${i}`);
    table.paints.add(g.id);
  });
  defs?.patterns?.forEach((p, i) => {
    define(table, p.id, `defs.patterns.${i}`);
    table.paints.add(p.id);
  });
  defs?.filters?.forEach((f, i) => {
    define(table, f.id, `defs.filters.${i}`);
    table.filters.add(f.id);
  });
  defs?.clipPaths?.forEach((c, i) => {
    define(table, c.id, `defs.clipPaths.${i}`);
    table.clipPaths.add(c.id);
  });
  defs?.masks?.forEach((m, i) => {
    define(table, m.id, `defs.masks.${i}`);
    table.masks.add(m.id);
  });
  defs?.paths?.forEach((p, i) => {
    define(table, p.id, `defs.paths.${i}`);
    table.paths.add(p.id);
  });
  defs?.symbols?.forEach((s, i) => {
    define(table, s.id, `defs.symbols.${i}`);
    table.useTargets.add(s.id);
  });
  collectElementIds(table, config.elements, "elements");
  return table;
}

function available(ids: Set<string>): string {
  if (ids.size === 0) return "none are defined";
  return `defined: ${[...ids].join(", ")}`;
}

function checkPresentationRefs(
  el: AnyElement,
  where: string,
  table: IdTable,
  errors: string[]
): void {
  const attrs = el as {
    fill?: string;
    stroke?: string;
    filter?: string;
    clipPath?: string;
    mask?: string;
  };
  const paintChecks: Array<[string, string | undefined]> = [
    ["fill", attrs.fill],
    ["stroke", attrs.stroke],
  ];
  for (const [field, value] of paintChecks) {
    const ref = extractUrlRef(value);
    if (ref && !table.paints.has(ref)) {
      errors.push(
        `${where}.${field}: references undefined id "${ref}" — no gradient or pattern with that id (${available(table.paints)})`
      );
    }
  }
  const urlChecks: Array<[string, string | undefined, Set<string>, string]> = [
    ["filter", attrs.filter, table.filters, "filter"],
    ["clipPath", attrs.clipPath, table.clipPaths, "clipPath"],
    ["mask", attrs.mask, table.masks, "mask"],
  ];
  for (const [field, value, ids, kind] of urlChecks) {
    const ref = extractUrlRef(value);
    if (ref && !ids.has(ref)) {
      errors.push(
        `${where}.${field}: references undefined ${kind} id "${ref}" (${available(ids)})`
      );
    }
  }
}

function checkElements(
  elements: AnyElement[],
  pathPrefix: string,
  table: IdTable,
  errors: string[]
): void {
  elements.forEach((el, i) => {
    const where = `${pathPrefix}.${i}`;
    checkPresentationRefs(el, where, table, errors);

    if (el.type === "use") {
      const target = el.href.replace(/^#/, "");
      if (!table.useTargets.has(target)) {
        errors.push(
          `${where}.href: references undefined id "${target}" — no symbol or element with that id (${available(table.useTargets)})`
        );
      }
    }
    if (el.type === "textPath") {
      if (!table.paths.has(el.pathId)) {
        errors.push(
          `${where}.pathId: references undefined path id "${el.pathId}" — define it in defs.paths (${available(table.paths)})`
        );
      }
    }
    if (el.type === "group") {
      checkElements(el.children as AnyElement[], `${where}.children`, table, errors);
    }
    const child = (el as { child?: AnyElement }).child;
    if (child) checkElements([child], `${where}.child`, table, errors);
  });
}

/**
 * Validate ID uniqueness and reference integrity across the whole config.
 * Returns field-level error messages; empty array means the config is sound.
 */
export function checkReferences(config: SVGConfig): string[] {
  const errors: string[] = [];
  const table = buildIdTable(config);

  for (const [id, sites] of table.all) {
    if (sites.length > 1) {
      errors.push(
        `Duplicate id "${id}" defined at ${sites.join(" and ")} — all IDs must be unique within the SVG`
      );
    }
  }

  // Gradient href inheritance must point at another gradient
  config.defs?.gradients?.forEach((g, i) => {
    const href = (g as { href?: string }).href;
    if (href) {
      const target = href.replace(/^#/, "");
      const isGradient = config.defs?.gradients?.some((other) => other.id === target);
      if (!isGradient) {
        errors.push(
          `defs.gradients.${i}.href: references undefined gradient id "${target}"`
        );
      }
    }
  });

  // Defs children can also carry paint references (e.g. mask content filled
  // with a gradient), so walk them too.
  config.defs?.symbols?.forEach((s, i) => {
    checkElements(s.children as AnyElement[], `defs.symbols.${i}.children`, table, errors);
  });
  config.defs?.masks?.forEach((m, i) => {
    checkElements(m.children as AnyElement[], `defs.masks.${i}.children`, table, errors);
  });
  config.defs?.patterns?.forEach((p, i) => {
    checkElements(p.children as AnyElement[], `defs.patterns.${i}.children`, table, errors);
  });

  checkElements(config.elements, "elements", table, errors);
  return errors;
}
