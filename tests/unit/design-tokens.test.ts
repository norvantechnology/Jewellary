import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseTokens(): Record<string, string> {
  const css = fs.readFileSync(path.resolve(process.cwd(), "src/styles/tokens.css"), "utf8");
  const map: Record<string, string> = {};
  const matches = css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g);
  for (const match of matches) {
    const name = match[1];
    const value = match[2];
    if (name && value) map[name] = value;
  }
  return map;
}

describe("design system tokens & WCAG 2.2 AA contrast (A11Y-01, UX-10)", () => {
  const tokens = parseTokens();

  it("ensures no blue or purple hues exist in palette tokens", () => {
    for (const [name, hex] of Object.entries(tokens)) {
      const [r, g, b] = hexToRgb(hex);
      // Warm champagne/ivory/gold/bronze/charcoal/olive/terracotta/amber never have blue dominating red & green
      const isBlueOrPurpleDominant = b > r && b > g;
      expect(isBlueOrPurpleDominant, `Token ${name} (${hex}) must not be blue/purple`).toBe(false);
    }
  });

  it("meets >= 4.5:1 contrast for all light-mode text pairs", () => {
    const lightBg = tokens["--ivory-50"]!;
    const lightCard = tokens["--ivory-100"]!;
    const lightMuted = tokens["--beige-100"]!;

    const pairs: [string, string, number][] = [
      [tokens["--charcoal-750"]!, lightBg, 4.5],
      [tokens["--charcoal-750"]!, lightCard, 4.5],
      [tokens["--taupe-500"]!, lightBg, 4.5],
      [tokens["--taupe-500"]!, lightMuted, 4.5],
      [tokens["--bronze-700"]!, lightBg, 4.5],
      [tokens["--bronze-700"]!, lightMuted, 4.5],
      [tokens["--ivory-50"]!, tokens["--charcoal-750"]!, 4.5],
      [tokens["--terracotta-700"]!, lightBg, 4.5],
      [tokens["--ivory-50"]!, tokens["--terracotta-700"]!, 4.5],
      [tokens["--olive-700"]!, lightBg, 4.5],
      [tokens["--amber-700"]!, lightBg, 4.5],
      [tokens["--gold-500"]!, lightBg, 3.0], // non-text icon / focus ring
    ];

    for (const [fg, bg, minRatio] of pairs) {
      expect(contrastRatio(fg, bg), `Contrast ${fg} on ${bg}`).toBeGreaterThanOrEqual(minRatio);
    }
  });

  it("meets >= 4.5:1 contrast for all dark-mode text pairs", () => {
    const darkBg = tokens["--charcoal-950"]!;
    const darkCard = tokens["--charcoal-850"]!;
    const darkMuted = tokens["--charcoal-800"]!;

    const pairs: [string, string, number][] = [
      [tokens["--ivory-200"]!, darkBg, 4.5],
      [tokens["--ivory-200"]!, darkCard, 4.5],
      [tokens["--taupe-300"]!, darkBg, 4.5],
      [tokens["--taupe-300"]!, darkMuted, 4.5],
      [tokens["--bronze-300"]!, darkBg, 4.5],
      [tokens["--bronze-300"]!, darkMuted, 4.5],
      [tokens["--charcoal-900"]!, tokens["--champagne-300"]!, 4.5],
      [tokens["--terracotta-300"]!, darkBg, 4.5],
      [tokens["--charcoal-900"]!, tokens["--terracotta-300"]!, 4.5],
      [tokens["--olive-300"]!, darkBg, 4.5],
      [tokens["--amber-300"]!, darkBg, 4.5],
      [tokens["--gold-400"]!, darkBg, 3.0],
    ];

    for (const [fg, bg, minRatio] of pairs) {
      expect(contrastRatio(fg, bg), `Dark contrast ${fg} on ${bg}`).toBeGreaterThanOrEqual(
        minRatio,
      );
    }
  });
});
