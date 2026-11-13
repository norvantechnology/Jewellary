import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { CACHE_TAGS } from "@/server/cache-tags";
import { verifyCronAuthorization } from "@/server/cron-auth";
import { db } from "@/server/db";

async function handlePublishAndCleanup(request: Request) {
  const authError = verifyCronAuthorization(request);
  if (authError) return authError;

  const now = new Date();

  const [dueArticles, deletedExpiredCarts, scheduledBannerCount] = await Promise.all([
    db.article.findMany({
      where: {
        isPublished: false,
        publishedAt: { lte: now },
      },
      select: { id: true, slug: true },
    }),
    db.cart.deleteMany({
      where: {
        userId: null,
        expiresAt: { lte: now },
      },
    }),
    db.banner.count({
      where: {
        isActive: true,
        OR: [{ startsAt: { not: null } }, { endsAt: { not: null } }],
      },
    }),
  ]);

  if (dueArticles.length > 0) {
    await db.article.updateMany({
      where: { id: { in: dueArticles.map((a) => a.id) } },
      data: { isPublished: true },
    });
    revalidateTag(CACHE_TAGS.articles, "max");
    for (const article of dueArticles) {
      revalidateTag(CACHE_TAGS.article(article.slug), "max");
    }
  }

  if (scheduledBannerCount > 0) {
    revalidateTag(CACHE_TAGS.banners, "max");
  }

  return NextResponse.json({
    ok: true,
    publishedArticlesCount: dueArticles.length,
    cleanedGuestCartsCount: deletedExpiredCarts.count,
    timestamp: now.toISOString(),
  });
}

export async function GET(request: Request) {
  return handlePublishAndCleanup(request);
}

export async function POST(request: Request) {
  return handlePublishAndCleanup(request);
}
