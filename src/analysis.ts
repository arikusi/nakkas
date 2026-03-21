/**
 * Design analysis for rendered SVG configs.
 *
 * Scans the SVGConfig for common quality issues and returns human-readable
 * warnings. These are included in the render_svg response to guide the AI
 * toward better design decisions.
 *
 * Each rule is independent and self-contained. Adding a new rule is as
 * simple as adding a new check function to the rules array.
 */

import type { SVGConfig, AnyElement } from "./schemas/config.js";

// ---------------------------------------------------------------------------
// Rule implementations
// ---------------------------------------------------------------------------

function checkAnimationCount(config: SVGConfig): string | null {
  const count = config.animations?.length ?? 0;
  if (count > 4) {
    return (
      `${count} concurrent CSS animations detected. ` +
      `Consider using 2 to 3 complementary animations for visual clarity.`
    );
  }
  return null;
}

function checkGroupScaleAnimation(config: SVGConfig): string[] {
  const warnings: string[] = [];
  const animNames = new Map<string, { hasScale: boolean }>();

  for (const anim of config.animations ?? []) {
    const hasScale = anim.keyframes.some(
      (kf) => kf.properties.transform?.includes("scale")
    );
    animNames.set(anim.name, { hasScale });
  }

  const groupTypes = new Set([
    "radial-group",
    "arc-group",
    "grid-group",
    "scatter-group",
    "path-group",
    "group",
  ]);

  for (const el of config.elements) {
    if (
      groupTypes.has(el.type) &&
      "cssClass" in el &&
      typeof el.cssClass === "string"
    ) {
      const info = animNames.get(el.cssClass);
      if (info?.hasScale) {
        warnings.push(
          `Element type "${el.type}" with cssClass "${el.cssClass}" applies scale to a group container. ` +
            `Scale transforms on groups may behave inconsistently across browsers. ` +
            `Consider animating individual child opacity or transforms instead.`
        );
      }
    }
  }
  return warnings;
}

function checkMissingTransformBox(config: SVGConfig): string[] {
  const warnings: string[] = [];
  const animMap = new Map<string, boolean>();

  for (const anim of config.animations ?? []) {
    const needsBox = anim.keyframes.some((kf) => {
      const t = kf.properties.transform ?? "";
      return t.includes("scale") || t.includes("rotate");
    });
    animMap.set(anim.name, needsBox);
  }

  function check(el: AnyElement) {
    if (
      "cssClass" in el &&
      typeof el.cssClass === "string" &&
      animMap.get(el.cssClass)
    ) {
      const hasBox =
        "transformBox" in el && typeof el.transformBox === "string";
      if (!hasBox) {
        warnings.push(
          `Element with cssClass "${el.cssClass}" uses scale or rotate animation ` +
            `but is missing transformBox="fill-box". ` +
            `Add transformBox and transformOrigin for correct transform origin.`
        );
      }
    }
  }

  for (const el of config.elements) {
    check(el);
    if (el.type === "group" && "children" in el) {
      for (const child of el.children) {
        check(child as AnyElement);
      }
    }
  }
  return warnings;
}

function checkSvgSize(svgLength: number): string | null {
  const kb = Math.round(svgLength / 1024);
  if (kb > 50) {
    return (
      `SVG output is ${kb}kb. ` +
      `Consider reducing parametric steps or simplifying elements for a smaller file.`
    );
  }
  return null;
}

function checkElementCount(config: SVGConfig): string | null {
  let count = 0;
  for (const el of config.elements) {
    count++;
    if (el.type === "grid-group") count += el.cols * el.rows;
    else if (
      el.type === "radial-group" ||
      el.type === "arc-group" ||
      el.type === "scatter-group" ||
      el.type === "path-group"
    )
      count += el.count;
    else if (el.type === "group" && "children" in el) count += el.children.length;
  }
  if (count > 200) {
    return (
      `High element count (${count}). ` +
      `Complex output may render slowly in some contexts.`
    );
  }
  return null;
}

function checkSharedCssClass(config: SVGConfig): string[] {
  const warnings: string[] = [];
  const classCounts = new Map<string, number>();

  function countClass(el: AnyElement) {
    if ("cssClass" in el && typeof el.cssClass === "string" && el.cssClass) {
      classCounts.set(el.cssClass, (classCounts.get(el.cssClass) ?? 0) + 1);
    }
  }

  for (const el of config.elements) {
    countClass(el);
    if (el.type === "group" && "children" in el) {
      for (const child of el.children) countClass(child as AnyElement);
    }
  }

  for (const [cls, count] of classCounts) {
    if (count > 5) {
      warnings.push(
        `cssClass "${cls}" is shared by ${count} elements. ` +
          `This works for synchronized animation but prevents per-element timing control. ` +
          `Use staggered delays with distinct classes for cascading effects.`
      );
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Main analysis entry point
// ---------------------------------------------------------------------------

/**
 * Analyze a rendered SVG config and return design warnings.
 *
 * @param config    The validated SVGConfig object
 * @param svgLength Length of the rendered SVG string in characters
 * @returns Array of warning strings (empty if no issues detected)
 */
export function analyzeConfig(
  config: SVGConfig,
  svgLength: number
): string[] {
  const warnings: string[] = [];

  const animCount = checkAnimationCount(config);
  if (animCount) warnings.push(animCount);

  warnings.push(...checkGroupScaleAnimation(config));
  warnings.push(...checkMissingTransformBox(config));

  const sizeWarn = checkSvgSize(svgLength);
  if (sizeWarn) warnings.push(sizeWarn);

  const countWarn = checkElementCount(config);
  if (countWarn) warnings.push(countWarn);

  warnings.push(...checkSharedCssClass(config));

  return warnings;
}
