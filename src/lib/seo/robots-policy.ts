import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export const ROBOTS_ALLOW_PATHS = ["/", "/_next/static/", "/_next/image"];

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
  "/dev",
  "/_next/",
];

/**
 * Search and retrieval user-agents always permitted to index public catalogue & editorial copy.
 * Internal `/search` is deliberately omitted from `Disallow` so `noindex,follow` is crawled and honored.
 */
export const RETRIEVAL_USER_AGENTS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
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
] as const;

export function buildRobotsPolicy(
  allowAiCrawlers: boolean,
  siteOrigin: string = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, ""),
): MetadataRoute.Robots {
  const rules: NonNullable<MetadataRoute.Robots["rules"]> = [
    {
      userAgent: "*",
      allow: ROBOTS_ALLOW_PATHS,
      disallow: ROBOTS_DISALLOW_PATHS,
    },
    ...RETRIEVAL_USER_AGENTS.map((userAgent) => ({
      userAgent,
      allow: ROBOTS_ALLOW_PATHS,
      disallow: ROBOTS_DISALLOW_PATHS,
    })),
    ...AI_TRAINING_USER_AGENTS.map((userAgent) =>
      allowAiCrawlers
        ? {
            userAgent,
            allow: ROBOTS_ALLOW_PATHS,
            disallow: ROBOTS_DISALLOW_PATHS,
          }
        : {
            userAgent,
            disallow: "/",
          },
    ),
  ];

  return {
    rules,
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
