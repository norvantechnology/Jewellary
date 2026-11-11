"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Logo } from "@/components/shared/Logo";
import { IconButton } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavCategoryItem } from "@/types/navigation";

interface MobileNavProps {
  siteName: string;
  categories: NavCategoryItem[];
}

export function MobileNav({ siteName, categories }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton aria-label="Open navigation menu" className="lg:hidden">
          <Menu className="size-5" aria-hidden="true" />
        </IconButton>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(88vw,22rem)]">
        <SheetHeader>
          <SheetTitle>
            <Logo siteName={siteName} />
          </SheetTitle>
          <SheetDescription className="sr-only">Main mobile navigation</SheetDescription>
        </SheetHeader>

        <nav aria-label="Mobile collections" className="mt-4 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Link
              href="/collections"
              onClick={() => setOpen(false)}
              className="min-h-11 border-b border-border py-2.5 text-base font-medium text-foreground"
            >
              All Jewellery
            </Link>
            {categories.map((cat) => (
              <div key={cat.id} className="border-b border-border pb-3">
                <Link
                  href={`/collections/${cat.path}`}
                  onClick={() => setOpen(false)}
                  className="block py-1.5 text-base font-medium text-foreground"
                >
                  {cat.name}
                </Link>
                {cat.children.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1 pl-3">
                    {cat.children.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          href={`/collections/${sub.path}`}
                          onClick={() => setOpen(false)}
                          className="block py-1.5 text-sm text-muted-foreground hover:text-foreground"
                        >
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <Link
              href="/guides"
              onClick={() => setOpen(false)}
              className="py-2 text-foreground hover:text-accent-text"
            >
              Diamond &amp; Buying Guides
            </Link>
            <Link
              href="/about"
              onClick={() => setOpen(false)}
              className="py-2 text-foreground hover:text-accent-text"
            >
              Our Maison
            </Link>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="py-2 text-foreground hover:text-accent-text"
            >
              Private Concierge &amp; Contact
            </Link>
            <Link
              href="/wishlist"
              onClick={() => setOpen(false)}
              className="py-2 text-foreground hover:text-accent-text"
            >
              Saved Wishlist
            </Link>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="py-2 text-foreground hover:text-accent-text"
            >
              My Account
            </Link>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Theme
            </span>
            <ThemeSwitcher />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
