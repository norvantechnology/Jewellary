import { Suspense } from "react";
import type { Metadata } from "next";
import { BannersManager } from "@/components/admin/BannersManager";
import { Skeleton } from "@/components/ui/skeleton";
import { listAllBanners } from "@/modules/banners/banner.service";

export const metadata: Metadata = {
  title: "Banners",
};

async function BannersContent() {
  const banners = await listAllBanners();
  return <BannersManager banners={banners} />;
}

export default function AdminBannersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <BannersContent />
    </Suspense>
  );
}
