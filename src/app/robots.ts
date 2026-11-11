import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/metadata";
import { buildRobotsPolicy } from "@/lib/seo/robots-policy";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getPublicStoreSettings();
  return buildRobotsPolicy(settings.allowAiCrawlers, getSiteUrl());
}
