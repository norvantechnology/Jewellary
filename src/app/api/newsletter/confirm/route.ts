import { NextResponse } from "next/server";
import { confirmNewsletterSubscription } from "@/modules/newsletter/newsletter.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const result = await confirmNewsletterSubscription(token);

  const destination = new URL("/newsletter", url.origin);
  destination.searchParams.set("action", "confirm");
  destination.searchParams.set("status", result.ok ? "confirmed" : "invalid");

  return NextResponse.redirect(destination, { status: 302 });
}
