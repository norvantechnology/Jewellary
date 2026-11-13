import { NextResponse } from "next/server";
import { unsubscribeNewsletterByToken } from "@/modules/newsletter/newsletter.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const result = await unsubscribeNewsletterByToken(token);

  const destination = new URL("/newsletter", url.origin);
  destination.searchParams.set("action", "unsubscribe");
  destination.searchParams.set("status", result.ok ? "unsubscribed" : "invalid");

  return NextResponse.redirect(destination, { status: 302 });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") ?? "";

  if (!token) {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
      if (typeof body?.token === "string") token = body.token;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData().catch(() => null);
      const raw = form?.get("token");
      if (typeof raw === "string") token = raw;
    }
  }

  const result = await unsubscribeNewsletterByToken(token);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Invalid unsubscribe link." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: "unsubscribed" }, { status: 200 });
}
