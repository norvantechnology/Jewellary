import { NextResponse } from "next/server";
import { generateSitemaps } from "@/app/sitemap";
import { toAbsoluteUrl } from "@/lib/seo/metadata";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const segments = await generateSitemaps();
  const entries = segments
    .map(
      (seg) =>
        `  <sitemap>\n    <loc>${escapeXml(toAbsoluteUrl(`/sitemap/${seg.id}.xml`))}</loc>\n  </sitemap>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
