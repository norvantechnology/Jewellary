"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import type { NavCategoryItem } from "@/types/navigation";

const LazyMobileNavSheet = dynamic(
  () => import("@/components/layout/MobileNavSheet").then((m) => m.MobileNavSheet),
  { ssr: false },
);

interface MobileNavProps {
  siteName: string;
  categories: NavCategoryItem[];
}

export function MobileNav({ siteName, categories }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const [hasOpened, setHasOpened] = React.useState(false);

  function handleOpen() {
    setHasOpened(true);
    setOpen(true);
  }

  return (
    <>
      <IconButton aria-label="Open navigation menu" className="lg:hidden" onClick={handleOpen}>
        <Menu className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </IconButton>
      {hasOpened ? (
        <LazyMobileNavSheet
          siteName={siteName}
          categories={categories}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}
