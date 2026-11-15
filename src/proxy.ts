import { NextResponse, type NextRequest } from "next/server";
import { normalizeRedirectPathInput } from "@/lib/seo/audit";
import { lookupProxyRedirect } from "@/modules/seo/redirect-lookup";
import { db } from "@/server/db";

const PROTECTED_PREFIXES = ["/account", "/admin"];
const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

const AI_BOT_SIGNATURES: Array<{
  name: string;
  group: "search" | "ai-search" | "ai-training";
  pattern: RegExp;
}> = [
  { name: "OAI-SearchBot", group: "ai-search", pattern: /OAI-SearchBot/i },
  { name: "ChatGPT-User", group: "ai-search", pattern: /ChatGPT-User/i },
  { name: "GPTBot", group: "ai-training", pattern: /GPTBot/i },
  { name: "PerplexityBot", group: "ai-search", pattern: /PerplexityBot/i },
  { name: "Perplexity-User", group: "ai-search", pattern: /Perplexity-User/i },
  { name: "Claude-SearchBot", group: "ai-search", pattern: /Claude-SearchBot/i },
  { name: "Claude-User", group: "ai-search", pattern: /Claude-User/i },
  { name: "ClaudeBot", group: "ai-training", pattern: /ClaudeBot|Claude-Web/i },
  { name: "Google-Extended", group: "ai-training", pattern: /Google-Extended/i },
  { name: "Googlebot-Image", group: "search", pattern: /Googlebot-Image/i },
  { name: "Storebot-Google", group: "search", pattern: /Storebot-Google/i },
  { name: "Googlebot", group: "search", pattern: /Googlebot/i },
  { name: "Bingbot", group: "search", pattern: /bingbot/i },
  { name: "Applebot", group: "search", pattern: /Applebot/i },
  { name: "Pinterestbot", group: "search", pattern: /Pinterestbot/i },
  { name: "CCBot", group: "ai-training", pattern: /CCBot/i },
];

const STATIC_EXT_PATTERN =
  /\.(?:avif|webp|jpe?g|png|gif|svg|ico|css|js|mjs|map|woff2?|ttf|eot|xml|txt|json|pdf|mp4|webm)$/i;

const NOINDEX_EXACT_OR_PREFIX = [
  "/admin",
  "/account",
  "/cart",
  "/checkout",
  "/wishlist",
  "/orders",
  "/customize",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/search",
];

export function detectAiBot(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  for (const sig of AI_BOT_SIGNATURES) {
    if (sig.pattern.test(userAgent)) {
      return sig.name;
    }
  }
  return null;
}

function detectBotInfo(
  userAgent: string | null | undefined,
): { name: string; group: "search" | "ai-search" | "ai-training" } | null {
  if (!userAgent) return null;
  for (const sig of AI_BOT_SIGNATURES) {
    if (sig.pattern.test(userAgent)) {
      return { name: sig.name, group: sig.group };
    }
  }
  return null;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i]! ^ bBytes[i]!;
  }
  return diff === 0;
}

function isStagingBasicAuthValid(request: NextRequest): boolean {
  const expectedUser = process.env.STAGING_BASIC_AUTH_USER;
  const expectedPass = process.env.STAGING_BASIC_AUTH_PASS;
  if (!expectedUser || !expectedPass) {
    return true;
  }

  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = atob(header.slice(6).trim());
    const sep = decoded.indexOf(":");
    if (sep < 0) return false;
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    return timingSafeStringEqual(user, expectedUser) && timingSafeStringEqual(pass, expectedPass);
  } catch {
    return false;
  }
}

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => Boolean(request.cookies.get(name)?.value));
}

function buildImgSrc(): string {
  const sources = ["'self'", "blob:", "data:", "https:"];
  const s3Url = process.env.S3_ENDPOINT;
  if (s3Url) {
    try {
      const origin = new URL(s3Url).origin;
      if (!sources.includes(origin)) sources.push(origin);
    } catch {
      // Ignore invalid S3_ENDPOINT format
    }
  }
  const cdnUrl = process.env.NEXT_PUBLIC_IMAGE_CDN_URL;
  if (cdnUrl) {
    try {
      const origin = new URL(cdnUrl).origin;
      if (!sources.includes(origin)) sources.push(origin);
    } catch {
      // Ignore invalid CDN URL format
    }
  }
  return `img-src ${sources.join(" ")}`;
}

function buildConnectSrc(isHttps: boolean): string {
  const sources = [
    "'self'",
    isHttps ? "wss:" : "ws:",
    ...(isHttps ? [] : ["wss:"]),
    "https://api.stripe.com",
    "https://api.razorpay.com",
    "https://lumberjack.razorpay.com",
    "https://www.google-analytics.com",
    "https://*.ingest.sentry.io",
    "https://challenges.cloudflare.com",
  ];
  // Browser uploads go straight to object storage with a presigned URL (e.g. Supabase S3).
  const s3Endpoint = process.env.S3_ENDPOINT;
  if (s3Endpoint) {
    try {
      const origin = new URL(s3Endpoint).origin;
      if (!sources.includes(origin)) sources.push(origin);
    } catch {
      // Ignore invalid S3_ENDPOINT format
    }
  }
  const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (realtimeUrl) {
    try {
      const parsed = new URL(realtimeUrl);
      const wsOrigin = `${parsed.protocol === "https:" ? "wss:" : "ws:"}//${parsed.host}`;
      if (!sources.includes(parsed.origin)) sources.push(parsed.origin);
      if (!sources.includes(wsOrigin)) sources.push(wsOrigin);
    } catch {
      // Ignore malformed NEXT_PUBLIC_REALTIME_URL
    }
  }
  return `connect-src ${sources.join(" ")}`;
}

function buildEnforcedCsp(isHttps: boolean): string {
  const isDev = process.env.NODE_ENV !== "production";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://checkout.razorpay.com https://www.googletagmanager.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    buildImgSrc(),
    "font-src 'self' data:",
    buildConnectSrc(isHttps),
    "frame-src https://js.stripe.com https://api.razorpay.com https://checkout.razorpay.com https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

function isLocalHostname(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function recordBotHitNonBlocking(
  bot: { name: string; group: "search" | "ai-search" | "ai-training" },
  pathname: string,
  status: number,
  referer: string | null,
) {
  console.info(
    JSON.stringify({
      event: "ai_bot_visit",
      bot: bot.name,
      group: bot.group,
      path: pathname,
      status,
      ts: new Date().toISOString(),
    }),
  );
  void db.aiBotHit
    .create({
      data: {
        botName: bot.name,
        botGroup: bot.group,
        path: pathname.slice(0, 500),
        status,
        referer: referer ? referer.slice(0, 500) : null,
      },
    })
    .catch(() => {
      // Best-effort telemetry; never block request rendering.
    });
}

function shouldCanonicalizePath(pathname: string): boolean {
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/uploads/") ||
    pathname.startsWith("/customize/accept/") ||
    // Private routes carry case-sensitive ids/order numbers; lowercasing them breaks lookups.
    pathname.startsWith("/orders/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    STATIC_EXT_PATTERN.test(pathname)
  ) {
    return false;
  }
  return true;
}

function getRobotsHeaderForPath(pathname: string, isStaging: boolean): string | null {
  if (isStaging) {
    return "noindex, nofollow, noarchive";
  }
  if (/^\/products\/[^/]+\/customize(?:\/|$)/.test(pathname)) {
    return "noindex, follow";
  }
  if (
    NOINDEX_EXACT_OR_PREFIX.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return "noindex, follow";
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const method = request.method.toUpperCase();
  const isReadMethod = method === "GET" || method === "HEAD";
  const isStaging = process.env.STAGING_MODE === "true";
  const isMaintenance = process.env.MAINTENANCE_MODE === "true";
  const botInfo = detectBotInfo(request.headers.get("user-agent"));

  // Maintenance mode (503 + Retry-After), while keeping health/admin/auth reachable.
  if (
    isMaintenance &&
    pathname !== "/api/health" &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/login")
  ) {
    if (botInfo) {
      recordBotHitNonBlocking(botInfo, pathname, 503, request.headers.get("referer"));
    }
    return new NextResponse(
      "<!doctype html><html><head><title>Scheduled Maintenance — Shinora Jewels</title></head><body><main style='font-family:system-ui,sans-serif;padding:4rem;text-align:center'><h1>Shinora Jewels is briefly undergoing scheduled maintenance</h1><p>Please check back shortly.</p></main></body></html>",
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Retry-After": "3600",
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  // Env-gated Staging Protection: Basic Auth + site-wide noindex
  if (isStaging && pathname !== "/api/health" && !isStagingBasicAuthValid(request)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Staging Preview"',
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Cache-Control": "private, no-store",
      },
    });
  }

  // Dynamic Redirect Manager + canonical host / lowercase / trailing-slash 301s
  if (isReadMethod && shouldCanonicalizePath(pathname)) {
    const canonicalHost = process.env.CANONICAL_HOST?.trim().toLowerCase() ?? "";
    const incomingHost = (
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      ""
    ).toLowerCase();
    const isHttps =
      request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    const isLocal = isLocalHostname(incomingHost) || isLocalHostname(request.nextUrl.hostname);

    const normalizedPath = normalizeRedirectPathInput(pathname);
    const needsHostRedirect =
      Boolean(canonicalHost) && !isLocal && (incomingHost !== canonicalHost || !isHttps);
    const needsPathRedirect = normalizedPath !== pathname;

    // Look up DB redirects & 410 rules cleanly (best effort)
    let matchedRedirect: Awaited<ReturnType<typeof lookupProxyRedirect>> = null;
    if (pathname !== "/" && !pathname.startsWith("/admin")) {
      try {
        matchedRedirect = await lookupProxyRedirect(normalizedPath);
      } catch {
        matchedRedirect = null;
      }
    }

    if (matchedRedirect) {
      if (matchedRedirect.kind === "rule") {
        void db.redirectRule
          .update({
            where: { id: matchedRedirect.id },
            data: { hits: { increment: 1 }, lastHitAt: new Date() },
          })
          .catch(() => {});
      } else if (matchedRedirect.entityType && matchedRedirect.oldSlug) {
        void db.slugRedirect
          .updateMany({
            where: {
              entityType: matchedRedirect.entityType,
              oldSlug: matchedRedirect.oldSlug,
            },
            data: { hits: { increment: 1 }, lastHitAt: new Date() },
          })
          .catch(() => {});
      }

      if (matchedRedirect.statusCode === 410) {
        if (botInfo) {
          recordBotHitNonBlocking(botInfo, pathname, 410, request.headers.get("referer"));
        }
        return new NextResponse(
          "<!doctype html><html><head><title>Permanently Removed — Shinora Jewels</title></head><body><main style='font-family:system-ui,sans-serif;padding:4rem;text-align:center'><h1>410 — Permanently Removed</h1><p>This piece or page has been permanently removed from our catalogue.</p><p><a href='/collections'>Explore Current Collections</a></p></main></body></html>",
          {
            status: 410,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "X-Robots-Tag": "noindex, nofollow",
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      }

      if (matchedRedirect.toPath) {
        const destinationBase = needsHostRedirect
          ? `https://${canonicalHost}`
          : request.nextUrl.origin;
        const targetUrl = new URL(
          matchedRedirect.toPath.startsWith("http")
            ? matchedRedirect.toPath
            : `${matchedRedirect.toPath}${search}`,
          destinationBase,
        );
        const code =
          matchedRedirect.statusCode === 302 ||
          matchedRedirect.statusCode === 307 ||
          matchedRedirect.statusCode === 308
            ? matchedRedirect.statusCode
            : 301;
        if (botInfo) {
          recordBotHitNonBlocking(botInfo, pathname, code, request.headers.get("referer"));
        }
        return NextResponse.redirect(targetUrl, code);
      }
    }

    if (needsHostRedirect || needsPathRedirect) {
      const origin = needsHostRedirect ? `https://${canonicalHost}` : request.nextUrl.origin;
      const target = new URL(`${normalizedPath}${search}`, origin);
      if (botInfo) {
        recordBotHitNonBlocking(botInfo, pathname, 301, request.headers.get("referer"));
      }
      return NextResponse.redirect(target, 301);
    }
  }

  // Optimistic UX redirect ONLY; real auth & RBAC always execute in src/server/dal.ts.
  const requiresAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (requiresAuth && !hasSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (botInfo) {
    recordBotHitNonBlocking(botInfo, pathname, 200, request.headers.get("referer"));
  }

  const isHttps =
    request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-ma-pathname", pathname);
  requestHeaders.set("x-ma-return-to", `${pathname}${search}`);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", buildEnforcedCsp(isHttps));

  const robotsHeader = getRobotsHeaderForPath(pathname, isStaging);
  if (robotsHeader) {
    response.headers.set("X-Robots-Tag", robotsHeader);
  }

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|api/og/|favicon.ico|icon.svg|icon-.*\\.png|apple-touch-icon\\.png|robots.txt|sitemap.*|sitemaps/.*|feeds/.*|llms.txt|llms-full.txt|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
