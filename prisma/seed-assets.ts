import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SEED_IMAGE_DIR = path.join(process.cwd(), "public", "images", "seed");

export interface GeneratedAsset {
  storageKey: string;
  url: string;
  thumbUrl: string;
  mediumUrl: string;
  width: number;
  height: number;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildJewellerySvg(input: {
  title: string;
  subtitle: string;
  accentHex: string;
  bgStartHex: string;
  bgEndHex: string;
  width: number;
  height: number;
  motif: "solitaire" | "band" | "pendant" | "earrings" | "bracelet" | "banner";
}): string {
  const { width, height, bgStartHex, bgEndHex, accentHex, title, subtitle, motif } = input;
  const cx = width / 2;
  const cy = motif === "banner" ? height / 2 : height * 0.44;
  const scale = motif === "banner" ? 1.25 : 1;

  let illustration = "";
  if (motif === "solitaire" || motif === "banner") {
    illustration = `
      <ellipse cx="${cx}" cy="${cy + 95 * scale}" rx="${110 * scale}" ry="${38 * scale}" fill="none" stroke="${accentHex}" stroke-width="14"/>
      <ellipse cx="${cx}" cy="${cy + 92 * scale}" rx="${110 * scale}" ry="${38 * scale}" fill="none" stroke="#F7F1E5" stroke-width="3" opacity="0.7"/>
      <polygon points="${cx},${cy - 95 * scale} ${cx + 58 * scale},${cy - 30 * scale} ${cx + 35 * scale},${cy + 25 * scale} ${cx - 35 * scale},${cy + 25 * scale} ${cx - 58 * scale},${cy - 30 * scale}" fill="#FFFDF9" fill-opacity="0.92" stroke="${accentHex}" stroke-width="5"/>
      <polyline points="${cx - 58 * scale},${cy - 30 * scale} ${cx + 58 * scale},${cy - 30 * scale}" stroke="${accentHex}" stroke-width="3"/>
      <polyline points="${cx - 30 * scale},${cy - 30 * scale} ${cx},${cy - 95 * scale} ${cx + 30 * scale},${cy - 30 * scale} ${cx},${cy + 25 * scale} ${cx - 30 * scale},${cy - 30 * scale}" fill="none" stroke="${accentHex}" stroke-width="2.5" opacity="0.75"/>
    `;
  } else if (motif === "band") {
    illustration = `
      <ellipse cx="${cx}" cy="${cy + 20}" rx="155" ry="72" fill="none" stroke="${accentHex}" stroke-width="26"/>
      <ellipse cx="${cx}" cy="${cy + 14}" rx="155" ry="72" fill="none" stroke="#FFFDF7" stroke-width="5" opacity="0.55"/>
      <circle cx="${cx - 60}" cy="${cy - 44}" r="12" fill="#FFFDF9" stroke="${accentHex}" stroke-width="3"/>
      <circle cx="${cx}" cy="${cy - 54}" r="14" fill="#FFFDF9" stroke="${accentHex}" stroke-width="3"/>
      <circle cx="${cx + 60}" cy="${cy - 44}" r="12" fill="#FFFDF9" stroke="${accentHex}" stroke-width="3"/>
    `;
  } else if (motif === "pendant") {
    illustration = `
      <path d="M${cx - 120},${cy - 210} Q${cx},${cy + 20} ${cx + 120},${cy - 210}" fill="none" stroke="${accentHex}" stroke-width="4"/>
      <polygon points="${cx},${cy + 5} ${cx + 52},${cy + 65} ${cx},${cy + 135} ${cx - 52},${cy + 65}" fill="#FFFDF9" stroke="${accentHex}" stroke-width="5"/>
      <polygon points="${cx},${cy + 22} ${cx + 30},${cy + 65} ${cx},${cy + 115} ${cx - 30},${cy + 65}" fill="none" stroke="${accentHex}" stroke-width="2.5"/>
    `;
  } else if (motif === "earrings") {
    illustration = `
      <circle cx="${cx - 75}" cy="${cy}" r="52" fill="none" stroke="${accentHex}" stroke-width="11"/>
      <circle cx="${cx + 75}" cy="${cy}" r="52" fill="none" stroke="${accentHex}" stroke-width="11"/>
      <polygon points="${cx - 75},${cy - 58} ${cx - 57},${cy - 35} ${cx - 75},${cy - 14} ${cx - 93},${cy - 35}" fill="#FFFDF9" stroke="${accentHex}" stroke-width="3"/>
      <polygon points="${cx + 75},${cy - 58} ${cx + 93},${cy - 35} ${cx + 75},${cy - 14} ${cx + 57},${cy - 35}" fill="#FFFDF9" stroke="${accentHex}" stroke-width="3"/>
    `;
  } else {
    illustration = `
      <ellipse cx="${cx}" cy="${cy + 15}" rx="175" ry="95" fill="none" stroke="${accentHex}" stroke-width="10" stroke-dasharray="18 6"/>
      <ellipse cx="${cx}" cy="${cy + 15}" rx="158" ry="82" fill="none" stroke="#FFFDF9" stroke-width="4" opacity="0.75"/>
    `;
  }

  const labelY = motif === "banner" ? height - 48 : height - 96;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stop-color="${bgStartHex}"/>
        <stop offset="100%" stop-color="${bgEndHex}"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#glow)"/>
    <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="none" stroke="${accentHex}" stroke-opacity="0.28" stroke-width="1.5"/>
    ${illustration}
    <text x="${cx}" y="${labelY}" text-anchor="middle" font-family="Georgia, serif" font-size="${motif === "banner" ? 30 : 28}" letter-spacing="3" fill="#2E261F">${escapeXml(title)}</text>
    <text x="${cx}" y="${labelY + 34}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" letter-spacing="4" fill="#6E5D4B">${escapeXml(subtitle.toUpperCase())}</text>
  </svg>`;
}

export async function ensureSeedImageAsset(input: {
  slug: string;
  title: string;
  subtitle: string;
  accentHex?: string;
  bgStartHex?: string;
  bgEndHex?: string;
  width?: number;
  height?: number;
  motif: "solitaire" | "band" | "pendant" | "earrings" | "bracelet" | "banner";
}): Promise<GeneratedAsset> {
  mkdirSync(SEED_IMAGE_DIR, { recursive: true });

  const width = input.width ?? 1000;
  const height = input.height ?? 1000;
  const accentHex = input.accentHex ?? "#B69155";
  const bgStartHex = input.bgStartHex ?? "#FFFDF9";
  const bgEndHex = input.bgEndHex ?? "#EDE3D2";

  const mainFile = `${input.slug}.webp`;
  const medFile = `${input.slug}-med.webp`;
  const thumbFile = `${input.slug}-thumb.webp`;

  const mainPath = path.join(SEED_IMAGE_DIR, mainFile);
  const medPath = path.join(SEED_IMAGE_DIR, medFile);
  const thumbPath = path.join(SEED_IMAGE_DIR, thumbFile);

  if (!existsSync(mainPath) || !existsSync(medPath) || !existsSync(thumbPath)) {
    const svgBuffer = Buffer.from(
      buildJewellerySvg({
        title: input.title,
        subtitle: input.subtitle,
        accentHex,
        bgStartHex,
        bgEndHex,
        width,
        height,
        motif: input.motif,
      }),
    );

    await Promise.all([
      sharp(svgBuffer).webp({ quality: 86 }).toFile(mainPath),
      sharp(svgBuffer)
        .resize(Math.round(width * 0.65), Math.round(height * 0.65))
        .webp({ quality: 82 })
        .toFile(medPath),
      sharp(svgBuffer)
        .resize(Math.round(width * 0.35), Math.round(height * 0.35))
        .webp({ quality: 78 })
        .toFile(thumbPath),
    ]);
  }

  return {
    storageKey: `seed/${mainFile}`,
    url: `/images/seed/${mainFile}`,
    mediumUrl: `/images/seed/${medFile}`,
    thumbUrl: `/images/seed/${thumbFile}`,
    width,
    height,
  };
}
