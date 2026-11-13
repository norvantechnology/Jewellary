import { Suspense } from "react";
import type { Metadata } from "next";
import { ArticlesManager } from "@/components/admin/ArticlesManager";
import { Skeleton } from "@/components/ui/skeleton";
import { listAllArticles } from "@/modules/articles/article.service";

export const metadata: Metadata = {
  title: "Articles & Guides",
};

async function ArticlesContent() {
  const articles = await listAllArticles();
  return <ArticlesManager articles={articles} />;
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function AdminArticlesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ArticlesContent />
    </Suspense>
  );
}
