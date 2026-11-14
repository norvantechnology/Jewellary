import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { BRAND_PALETTE } from "@/lib/brand-palette";
import { env } from "@/lib/env";
import { getSiteUrl } from "@/lib/seo/site";

/**
 * Social share images (WhatsApp, iMessage, Facebook, X, LinkedIn, Slack, Pinterest...).
 *
 * Rules every preview app accepts:
 * - 1200x630 (1.91:1), served as JPEG (WebP/AVIF/SVG are ignored by WhatsApp and others).
 * - Small: we target < 150 KB (WhatsApp silently drops images over ~300 KB).
 * - Absolute https URL, publicly reachable, long cache headers.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
const OG_JPEG_QUALITY = 80;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const PUBLIC_DIR = path.join(process.cwd(), "public");

function allowedRemoteOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const raw of [getSiteUrl(), env.NEXT_PUBLIC_IMAGE_CDN_URL, process.env.SITE_URL]) {
    try {
      if (raw) origins.add(new URL(raw).origin);
    } catch {
      // ignore malformed config
    }
  }
  return origins;
}

async function readSourceBytes(src: string): Promise<Buffer | null> {
  if (src.startsWith("/") && !src.startsWith("//")) {
    // Local file under /public (seed images, uploads served statically).
    const resolved = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(src.split("?")[0]!)));
    if (!resolved.startsWith(PUBLIC_DIR + path.sep)) return null;
    return readFile(resolved).catch(() => null);
  }
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  // Only fetch from our own site or image CDN (no open proxy / SSRF).
  if (!allowedRemoteOrigins().has(url.origin)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return bytes.byteLength > MAX_SOURCE_BYTES ? null : bytes;
  } catch {
    return null;
  }
}

/** Loads any product/banner photo (webp, png, jpeg, avif...) as a JPEG data URI sized for the card. */
export async function loadOgPhoto(
  src: string | null | undefined,
  width: number,
  height: number,
): Promise<string | null> {
  if (!src || src.endsWith(".svg")) return null;
  const bytes = await readSourceBytes(src);
  if (!bytes) return null;
  try {
    const jpeg = await sharp(bytes)
      .resize(width, height, { fit: "cover", position: "attention" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export interface OgCardInput {
  brand: string;
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  /** Price or short highlight shown at the bottom. */
  highlight?: string | null;
  /** Data URI from loadOgPhoto. */
  photo?: string | null;
}

function clamp(text: string | null | undefined, max: number): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Brand card: photo on the left (when available), text on the right. */
function OgCard({ brand, eyebrow, title, subtitle, highlight, photo }: OgCardInput) {
  const p = BRAND_PALETTE.light;
  const photoWidth = photo ? 600 : 0;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: p.bg,
        color: p.text,
      }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img
          src={photo}
          width={photoWidth}
          height={OG_SIZE.height}
          style={{ objectFit: "cover" }}
        />
      ) : null}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: photo ? "56px 52px" : "64px 80px",
          borderLeft: photo ? `6px solid ${p.accent}` : "none",
          borderTop: photo ? "none" : `10px solid ${p.accent}`,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: p.accentText,
          }}
        >
          {clamp(eyebrow ? `${brand} · ${eyebrow}` : brand, 48)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              fontSize: photo ? 54 : 68,
              lineHeight: 1.1,
              fontWeight: 700,
            }}
          >
            {clamp(title, photo ? 70 : 90)}
          </div>
          {subtitle ? (
            <div style={{ display: "flex", fontSize: 28, lineHeight: 1.35, color: p.text2 }}>
              {clamp(subtitle, photo ? 110 : 150)}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: p.accentText }}>
          {clamp(highlight, 60)}
        </div>
      </div>
    </div>
  );
}

/** Renders the card and returns a small, cacheable JPEG response. */
export async function ogJpegResponse(input: OgCardInput): Promise<Response> {
  const png = await new ImageResponse(<OgCard {...input} />, OG_SIZE).arrayBuffer();
  const jpeg = await sharp(Buffer.from(png))
    .jpeg({ quality: OG_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(jpeg.byteLength),
      // Preview apps cache aggressively; URLs carry ?v=<updatedAt> so edits get a new image.
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
    },
  });
}
