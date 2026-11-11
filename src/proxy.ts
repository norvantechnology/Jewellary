import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/account", "/admin"];
const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => Boolean(request.cookies.get(name)?.value));
}

function buildReportOnlyCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://checkout.razorpay.com https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://api.razorpay.com https://lumberjack.razorpay.com https://www.google-analytics.com",
    "frame-src https://js.stripe.com https://api.razorpay.com https://checkout.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Optimistic UX redirect ONLY; real auth & RBAC always execute in src/server/dal.ts.
  const requiresAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (requiresAuth && !hasSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy-Report-Only", buildReportOnlyCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.*|feeds/.*|llms.txt|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
