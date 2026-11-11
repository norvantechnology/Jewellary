import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export function verifyCronAuthorization(request: Request): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Missing bearer authorization." } },
      { status: 401 },
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const providedBuf = Buffer.from(token, "utf8");
  const expectedBuf = Buffer.from(env.CRON_SECRET, "utf8");

  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron authorization token." } },
      { status: 401 },
    );
  }

  return null;
}
