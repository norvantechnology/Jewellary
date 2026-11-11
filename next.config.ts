import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";

function buildRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
    {
      protocol: "http",
      hostname: "localhost",
      port: "9000",
      pathname: "/**",
    },
    {
      protocol: "http",
      hostname: "127.0.0.1",
      port: "9000",
      pathname: "/**",
    },
  ];

  const cdnUrl = process.env.NEXT_PUBLIC_IMAGE_CDN_URL;
  if (cdnUrl) {
    try {
      const parsed = new URL(cdnUrl);
      const protocol = parsed.protocol === "http:" ? "http" : "https";
      patterns.push({
        protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        pathname: "/**",
      });
    } catch {
      // Ignore malformed env during build with SKIP_ENV_VALIDATION
    }
  }

  return patterns;
}

const allowedOrigins: string[] = [];
if (process.env.NEXT_PUBLIC_SITE_URL) {
  try {
    allowedOrigins.push(new URL(process.env.NEXT_PUBLIC_SITE_URL).host);
  } catch {
    // Ignore malformed URL during skipped validation
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  poweredByHeader: false,
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Google-Extended|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-Web|PerplexityBot|CCBot/i,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: buildRemotePatterns(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/checkout(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/sitemap.xml",
          destination: "/sitemap-index.xml",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
