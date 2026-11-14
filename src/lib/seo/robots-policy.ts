import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";

// /api/og/ = social share images. Facebook/WhatsApp, X and LinkedIn obey robots.txt, so the
// more specific Allow must beat the /api Disallow or link previews show no image.
export const ROBOTS_ALLOW_PATHS = ["/", "/api/og/", "/_next/static/", "/_next/image"];

export const ROBOTS_DISALLOW_PATHS = [
  "/admin",
  "/api",
  "/cart",
  "/checkout",
  "/account",
  "/orders",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/_next/",
];

/**
 * Search, social, and retrieval user-agents always permitted to index public catalogue & editorial copy.
 * Internal `/search`, `/wishlist`, and `/products/.../customize` stay allowed to crawl so bots honor
 * `noindex, follow` meta/X-Robots-Tag directives rather than getting trapped as uncrawled URLs.
 */
export const RETRIEVAL_USER_AGENTS = [
  "Googlebot",
  "Googlebot-Image",
  "Storebot-Google",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
  "Applebot",
  "Pinterestbot",
] as const;

/**
 * Model-training crawlers controlled toggleably by Store Settings (`allowAiCrawlers`).
 */
export const AI_TRAINING_USER_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
] as const;

export function buildRobotsPolicy(
  allowAiCrawlers: boolean,
  siteOrigin: string = getSiteUrl(),
  options?: { stagingMode?: boolean; customDisallowPaths?: string[] },
): MetadataRoute.Robots {
  const isStaging = options?.stagingMode ?? process.env.STAGING_MODE === "true";
  if (isStaging) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  const disallowPaths = Array.from(
    new Set([...ROBOTS_DISALLOW_PATHS, ...(options?.customDisallowPaths ?? [])]),
  );

  const rules: NonNullable<MetadataRoute.Robots["rules"]> = [
    {
      userAgent: "*",
      allow: ROBOTS_ALLOW_PATHS,
      disallow: disallowPaths,
    },
    ...RETRIEVAL_USER_AGENTS.map((userAgent) => ({
      userAgent,
      allow: ROBOTS_ALLOW_PATHS,
      disallow: disallowPaths,
    })),
    ...AI_TRAINING_USER_AGENTS.map((userAgent) =>
      allowAiCrawlers
        ? {
            userAgent,
            allow: ROBOTS_ALLOW_PATHS,
            disallow: disallowPaths,
          }
        : {
            userAgent,
            disallow: "/",
          },
    ),
  ];

  const cleanOrigin = siteOrigin.replace(/\/+$/, "");

  return {
    rules,
    sitemap: `${cleanOrigin}/sitemap.xml`,
    host: cleanOrigin,
  };
}
