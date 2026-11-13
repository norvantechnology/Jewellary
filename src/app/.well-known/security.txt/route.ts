import { NextResponse } from "next/server";
import { toAbsoluteUrl } from "@/lib/seo/site";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function GET() {
  const settings = await getPublicStoreSettings();
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const body = [
    `Contact: mailto:${settings.contactEmail}`,
    `Canonical: ${toAbsoluteUrl("/.well-known/security.txt")}`,
    `Preferred-Languages: en`,
    `Policy: ${toAbsoluteUrl("/privacy")}`,
    `Expires: ${expires}`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
