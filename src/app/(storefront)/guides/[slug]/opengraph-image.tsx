import { ImageResponse } from "next/og";
import { resolvePublishedArticleBySlug } from "@/modules/articles/article.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export const alt = "Maison Aurelia Gemological Buying Guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function GuideOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, settings] = await Promise.all([params, getPublicStoreSettings()]);
  const resolved = await resolvePublishedArticleBySlug(slug);
  const article = resolved && resolved.kind === "article" ? resolved.article : null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#1E1915",
        color: "#FAF7F0",
        padding: "60px 72px",
        border: "12px solid #9A7532",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: "#D1AA62",
          }}
        >
          {settings.storeName} · Atelier Journal
        </span>
        <span style={{ display: "flex", fontSize: 16, color: "#C4B9A5" }}>
          Gemology Buying Guide
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", fontSize: 54, lineHeight: 1.12, fontWeight: 600 }}>
          {article?.title ?? "Fine Jewellery & Diamond Buying Guide"}
        </div>
        {article?.excerpt && (
          <div style={{ display: "flex", fontSize: 22, lineHeight: 1.45, color: "#DDD2BF" }}>
            {article.excerpt.slice(0, 160)}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #4A3D31",
          paddingTop: 22,
          fontSize: 18,
          color: "#D1AA62",
        }}
      >
        <span style={{ display: "flex" }}>
          Written by {article?.authorName ?? "Senior Atelier Gemologist"}
        </span>
        <span style={{ display: "flex" }}>GIA &amp; IGI Reference Notes</span>
      </div>
    </div>,
    { ...size },
  );
}
