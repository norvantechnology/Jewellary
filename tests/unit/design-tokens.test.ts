import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function parseCssColor(value: string, backdropHex?: string): Rgb {
  if (value.startsWith("#")) return hexToRgb(value);
  const rgbaMatch = value.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\s*\)$/i);
  if (rgbaMatch) {
    const fg: Rgb = [Number(rgbaMatch[1]), Number(rgbaMatch[2]), Number(rgbaMatch[3])];
    const alpha = rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1;
    if (alpha >= 1 || !backdropHex) return fg;
    const bg = hexToRgb(backdropHex);
    return [
      Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
      Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
      Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
    ];
  }
  throw new Error(`Unsupported colour format in token test: ${value}`);
}

function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgColor: string, bgColor: string, backdropHex?: string): number {
  const bgRgb = parseCssColor(bgColor, backdropHex);
  const bgHexComposed = `#${bgRgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  const fgRgb = parseCssColor(fgColor, bgHexComposed);
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractBlock(css: string, marker: string): Record<string, string> {
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`Missing block ${marker}`);
  const openBrace = css.indexOf("{", start);
  const closeBrace = css.indexOf("}", openBrace);
  const block = css.slice(openBrace + 1, closeBrace);
  const map: Record<string, string> = {};
  const matches = block.matchAll(/(--[a-z0-9-]+):\s*((?:#[0-9a-fA-F]{6})|(?:rgba?\([^)]+\)))\s*;/g);
  for (const match of matches) {
    const name = match[1];
    const value = match[2];
    if (name && value) map[name] = value;
  }
  return map;
}

describe("design system tokens & WCAG 2.2 AA contrast (A11Y-01, UX-10)", () => {
  const css = fs.readFileSync(path.resolve(process.cwd(), "src/styles/theme.css"), "utf8");
  const lightTokens = extractBlock(css, '[data-theme="light"]');
  const darkTokens = extractBlock(css, '.dark,\n[data-theme="dark"]');

  it("ensures no blue or purple hues exist in core warm-neutral & gold palette tokens", () => {
    const excluded = new Set(["--info", "--info-bg"]);
    for (const [mode, tokens] of [
      ["light", lightTokens],
      ["dark", darkTokens],
    ] as const) {
      for (const [name, value] of Object.entries(tokens)) {
        if (excluded.has(name) || !value.startsWith("#")) continue;
        const [r, g, b] = hexToRgb(value);
        const isBlueOrPurpleDominant = b > r && b > g;
        expect(
          isBlueOrPurpleDominant,
          `${mode} token ${name} (${value}) must stay warm neutral/gold/semantic`,
        ).toBe(false);
      }
    }
  });

  it("meets >= 4.5:1 contrast for all light-mode text pairs", () => {
    const bg = lightTokens["--bg"]!;
    const bgAlt = lightTokens["--bg-alt"]!;
    const surface = lightTokens["--surface"]!;
    const surface2 = lightTokens["--surface-2"]!;
    const surface3 = lightTokens["--surface-3"]!;

    const pairs: [string, string, number][] = [
      [lightTokens["--text"]!, bg, 4.5],
      [lightTokens["--text"]!, bgAlt, 4.5],
      [lightTokens["--text"]!, surface, 4.5],
      [lightTokens["--text-2"]!, bg, 4.5],
      [lightTokens["--text-2"]!, surface, 4.5],
      [lightTokens["--text-muted"]!, bg, 4.5],
      [lightTokens["--text-muted"]!, surface, 4.5],
      [lightTokens["--text-muted"]!, surface2, 4.5],
      [lightTokens["--text-muted"]!, surface3, 4.5],
      [lightTokens["--accent-text"]!, bg, 4.5],
      [lightTokens["--accent-text"]!, bgAlt, 4.5],
      [lightTokens["--accent-text"]!, surface, 4.5],
      [lightTokens["--on-accent"]!, lightTokens["--accent"]!, 4.5],
      [lightTokens["--on-primary"]!, lightTokens["--primary"]!, 4.5],
      [lightTokens["--announce-text"]!, lightTokens["--announce-bg"]!, 4.5],
      [lightTokens["--footer-text"]!, lightTokens["--footer-bg"]!, 4.5],
      [lightTokens["--footer-body"]!, lightTokens["--footer-bg"]!, 4.5],
      [lightTokens["--footer-muted"]!, lightTokens["--footer-bg"]!, 4.5],
      [lightTokens["--footer-subtle"]!, lightTokens["--footer-bg"]!, 4.5],
      [lightTokens["--footer-accent"]!, lightTokens["--footer-bg"]!, 4.5],
      [lightTokens["--footer-danger"]!, lightTokens["--footer-bg"]!, 4.5],
      [lightTokens["--success"]!, lightTokens["--success-bg"]!, 4.5],
      [lightTokens["--warning"]!, lightTokens["--warning-bg"]!, 4.5],
      [lightTokens["--danger"]!, lightTokens["--danger-bg"]!, 4.5],
      [lightTokens["--info"]!, lightTokens["--info-bg"]!, 4.5],
      [lightTokens["--accent-hover"]!, surface, 3.0], // non-text icon / border accent
    ];

    for (const [fg, bgVal, minRatio] of pairs) {
      expect(contrastRatio(fg, bgVal), `Light contrast ${fg} on ${bgVal}`).toBeGreaterThanOrEqual(
        minRatio,
      );
    }
  });

  it("meets >= 4.5:1 contrast for all dark-mode text pairs", () => {
    const bg = darkTokens["--bg"]!;
    const bgAlt = darkTokens["--bg-alt"]!;
    const surface = darkTokens["--surface"]!;
    const surface2 = darkTokens["--surface-2"]!;
    const surface3 = darkTokens["--surface-3"]!;

    const pairs: [string, string, number, string?][] = [
      [darkTokens["--text"]!, bg, 4.5],
      [darkTokens["--text"]!, bgAlt, 4.5],
      [darkTokens["--text"]!, surface, 4.5],
      [darkTokens["--text-2"]!, bg, 4.5],
      [darkTokens["--text-2"]!, surface, 4.5],
      [darkTokens["--text-muted"]!, bg, 4.5],
      [darkTokens["--text-muted"]!, surface, 4.5],
      [darkTokens["--text-muted"]!, surface2, 4.5],
      [darkTokens["--text-muted"]!, surface3, 4.5],
      [darkTokens["--accent-text"]!, bg, 4.5],
      [darkTokens["--accent-text"]!, bgAlt, 4.5],
      [darkTokens["--accent-text"]!, surface, 4.5],
      [darkTokens["--accent"]!, surface, 4.5],
      [darkTokens["--on-accent"]!, darkTokens["--accent"]!, 4.5],
      [darkTokens["--on-primary"]!, darkTokens["--primary"]!, 4.5],
      [darkTokens["--announce-text"]!, darkTokens["--announce-bg"]!, 4.5],
      [darkTokens["--footer-text"]!, darkTokens["--footer-bg"]!, 4.5],
      [darkTokens["--footer-body"]!, darkTokens["--footer-bg"]!, 4.5],
      [darkTokens["--footer-muted"]!, darkTokens["--footer-bg"]!, 4.5],
      [darkTokens["--footer-subtle"]!, darkTokens["--footer-bg"]!, 4.5],
      [darkTokens["--footer-accent"]!, darkTokens["--footer-bg"]!, 4.5],
      [darkTokens["--footer-danger"]!, darkTokens["--footer-bg"]!, 4.5],
      [darkTokens["--success"]!, darkTokens["--success-bg"]!, 4.5, surface],
      [darkTokens["--warning"]!, darkTokens["--warning-bg"]!, 4.5, surface],
      [darkTokens["--danger"]!, darkTokens["--danger-bg"]!, 4.5, surface],
      [darkTokens["--info"]!, darkTokens["--info-bg"]!, 4.5, surface],
      [darkTokens["--accent"]!, bg, 3.0],
    ];

    for (const [fg, bgVal, minRatio, backdrop] of pairs) {
      expect(
        contrastRatio(fg, bgVal, backdrop),
        `Dark contrast ${fg} on ${bgVal}`,
      ).toBeGreaterThanOrEqual(minRatio);
    }
  });

  it("verifies optimized luxury typography system with Cormorant Garamond and Jost", () => {
    const tokensCss = fs.readFileSync(path.resolve(process.cwd(), "src/styles/tokens.css"), "utf8");
    expect(tokensCss).toContain("--font-display");
    expect(tokensCss).toContain("Cormorant Garamond");
    expect(tokensCss).toContain("--font-sans");
    expect(tokensCss).toContain("Jost");

    expect(css).toContain("--font-display: var(--font-heading)");
    expect(css).toContain("--font-sans: var(--font-body)");
  });
});
