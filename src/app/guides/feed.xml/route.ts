import { NextResponse } from "next/server";
import { buildGuidesRssXml } from "@/lib/seo/feeds";
import { createXmlResponseHeaders } from "@/lib/seo/sitemap";
import { getPublishedArticles } from "@/modules/articles/article.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function GET() {
  const [settings, articles] = await Promise.all([
    getPublicStoreSettings(),
    getPublishedArticles(),
  ]);

  const rssXml = buildGuidesRssXml(
    articles.filter((article) => !article.noindex),
    settings,
  );

  return new NextResponse(rssXml, {
    status: 200,
    headers: createXmlResponseHeaders(),
  });
}
