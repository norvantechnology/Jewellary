import { ImageResponse } from "next/og";
import { BRAND_PALETTE } from "@/lib/brand-palette";
import { getPublishedArticleBySlug } from "@/modules/articles/article.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function GuideOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, settings] = await Promise.all([
    params,
    getPublicStoreSettings().catch(() => null),
  ]);
  const article = await getPublishedArticleBySlug(slug).catch(() => null);
  const storeName = settings?.storeName ?? "Maison Aurelia";
  const p = BRAND_PALETTE.light;

  const title = article?.title ?? "Gemology & Jewellery Care Journal";
  const excerpt =
    article?.excerpt ??
    "Independent guidance on diamond grading, precious metals, and heirloom care.";
  const authorLine = article
    ? `${article.authorName}${article.authorCredentials ? ` · ${article.authorCredentials}` : ""}`
    : `${storeName} Editorial`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px 72px",
        background: `linear-gradient(135deg, ${p.bg} 0%, ${p.surface} 58%, ${p.surface3} 100%)`,
        color: p.text,
        border: `1px solid ${p.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 20,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: p.accentText,
            fontWeight: 600,
          }}
        >
          {storeName} · Journal
        </span>
        <span
          style={{
            fontSize: 16,
            color: p.textMuted,
            border: `1px solid ${p.borderStrong}`,
            padding: "6px 14px",
            borderRadius: 999,
          }}
        >
          {article?.articleSection ?? "Gemology Guide"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
        <div style={{ fontSize: 52, fontWeight: 600, lineHeight: 1.15, color: p.text }}>
          {title.slice(0, 96)}
        </div>
        <div style={{ fontSize: 24, lineHeight: 1.4, color: p.text2 }}>{excerpt.slice(0, 155)}</div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: `1px solid ${p.border}`,
          paddingTop: 22,
          fontSize: 18,
          color: p.textMuted,
        }}
      >
        <span>By {authorLine}</span>
        <span>Atelier Research &amp; Buyer Guidance</span>
      </div>
    </div>,
    { ...size },
  );
}
