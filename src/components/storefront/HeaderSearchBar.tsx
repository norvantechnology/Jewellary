"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DynamicSearchDialog = dynamic(
  () => import("@/components/storefront/HeaderSearchDialog").then((mod) => mod.HeaderSearchDialog),
  { ssr: false },
);

export function HeaderSearchBar() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Search jewellery catalogue"
              aria-haspopup="dialog"
              className="transition-ui inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Search className="size-6" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="hidden lg:block">Search</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {open ? <DynamicSearchDialog open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
