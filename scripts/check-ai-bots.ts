/**
 * AI & Search Bot Crawler Verification Script
 * Verifies raw SSR HTML, canonicals, JSON-LD, status codes, and policy endpoints
 * across Searchbots & AI crawlers (Googlebot, Bingbot, OAI-SearchBot, GPTBot, PerplexityBot, ClaudeBot).
 *
 * Usage: SEO_CRAWL_BASE_URL=http://localhost:3000 npx tsx scripts/check-ai-bots.ts
 */

import { config } from "dotenv";

config({ path: ".env" });

const BASE_URL = (process.env.SEO_CRAWL_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const BOTS = [
  { name: "curl", ua: "curl/8.5.0" },
  {
    name: "Googlebot",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  },
  {
    name: "Bingbot",
    ua: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  },
  { name: "OAI-SearchBot", ua: "OAI-SearchBot/1.0 (+https://openai.com/searchbot)" },
  {
    name: "GPTBot",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0",
  },
  {
    name: "PerplexityBot",
    ua: "PerplexityBot/1.0 (+https://docs.perplexity.ai/guides/perplexitybot)",
  },
  { name: "ClaudeBot", ua: "ClaudeBot/1.0 (+claudebot@anthropic.com)" },
];

async function main() {
  let failures = 0;

  // 1. Verify technical SEO endpoints
  for (const endpoint of [
    "/robots.txt",
    "/sitemap.xml",
    "/sitemaps/pages.xml",
    "/sitemaps/collections.xml",
    "/sitemaps/products-1.xml",
    "/sitemaps/images-1.xml",
    "/sitemaps/guides.xml",
    "/llms.txt",
    "/llms-full.txt",
    "/guides/feed.xml",
    "/.well-known/security.txt",
  ]) {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    if (!res.ok) {
      console.error(`FAIL ${endpoint} -> HTTP ${res.status}`);
      failures += 1;
    } else {
      console.log(`PASS ${endpoint} -> HTTP ${res.status}`);
    }
  }

  // 2. Verify SSR HTML for each crawler UA on public key routes
  for (const bot of BOTS) {
    for (const path of ["/", "/collections", "/guides"]) {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { "User-Agent": bot.ua, Accept: "text/html" },
      });
      const html = await res.text();
      const hasH1 = /<h1[\s>]/i.test(html);
      const hasCanonical = /rel=["']canonical["']/i.test(html);
      const hasJsonLd = /type=["']application\/ld\+json["']/i.test(html);
      const hasLocalhostLeak = /http:\/\/localhost:3000/i.test(html);

      if (!res.ok || !hasH1 || !hasCanonical || !hasJsonLd || hasLocalhostLeak) {
        console.error(
          `FAIL [${bot.name}] ${path}: status=${res.status} h1=${hasH1} canonical=${hasCanonical} jsonld=${hasJsonLd} localhostLeak=${hasLocalhostLeak}`,
        );
        failures += 1;
      } else {
        console.log(`PASS [${bot.name}] ${path}: HTTP ${res.status} SSR complete`);
      }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} bot verification check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll AI & Search bot SSR checks passed!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
