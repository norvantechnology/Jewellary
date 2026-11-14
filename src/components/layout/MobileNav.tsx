"use client";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import type { NavLabels } from "@/components/layout/navigation-data";
import type { NavCategoryItem } from "@/types/navigation";

const LazyMobileNavSheet = dynamic(
  () => import("@/components/layout/MobileNavSheet").then((m) => m.MobileNavSheet),
  { ssr: false },
);

interface MobileNavProps {
  siteName: string;
  categories: NavCategoryItem[];
  labels: NavLabels;
}

export function MobileNav({ siteName, categories, labels }: MobileNavProps) {
  const ui = useUiText();
  const [open, setOpen] = React.useState(false);
  const [hasOpened, setHasOpened] = React.useState(false);

  function handleOpen() {
    setHasOpened(true);
    setOpen(true);
  }

  return (
    <>
      <IconButton aria-label={ui.layout.openMenu} className="lg:hidden" onClick={handleOpen}>
        <Menu className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </IconButton>
      {hasOpened ? (
        <LazyMobileNavSheet
          siteName={siteName}
          categories={categories}
          labels={labels}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}
