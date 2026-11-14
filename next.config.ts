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

const allowedOriginsSet = new Set<string>();
for (const rawUrl of [process.env.NEXT_PUBLIC_SITE_URL, process.env.BETTER_AUTH_URL]) {
  if (!rawUrl) continue;
  try {
    allowedOriginsSet.add(new URL(rawUrl).host);
  } catch {
    // Ignore malformed URL during skipped validation
  }
}
if (process.env.NODE_ENV !== "production") {
  allowedOriginsSet.add("localhost:3000");
  allowedOriginsSet.add("127.0.0.1:3000");
}
const allowedOrigins = Array.from(allowedOriginsSet);

const nextConfig: NextConfig = {
  // Docker uses the standalone server; Vercel builds its own output.
  output: process.env.VERCEL ? undefined : "standalone",
  // Files read at runtime with fs must be bundled into serverless functions.
  outputFileTracingIncludes: { "/**": ["./certs/**"] },
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  poweredByHeader: false,
  // Disable streaming metadata uniformly so every browser and crawler receives <head> tags synchronously.
  htmlLimitedBots: /.*/,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    remotePatterns: buildRemotePatterns(),
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "radix-ui",
      "sonner",
      "cmdk",
      "zod",
      "recharts",
    ],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    serverActions: {
      bodySizeLimit: "2mb",
      ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
    },
  },
  turbopack: {
    resolveAlias: {
      // Bypass motion/react's `import * as fm` namespace shim so Turbopack tree-shakes
      // unused `motion` proxy / domMax / Reorder bundles under LazyMotion + domAnimation.
      "motion/react": "framer-motion",
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
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Every API route except /api/og/* (social share images must stay fetchable/indexable).
        source: "/api/:path((?!og/).*)",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/feeds/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
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
      afterFiles: [
        {
          source: "/:key([a-zA-Z0-9-]{8,128}).txt",
          destination: "/api/seo/indexnow-key?key=:key",
        },
      ],
      fallback: [],
    };
  },
};

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

export default withBundleAnalyzer(nextConfig);
