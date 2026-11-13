"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPreviousRoute } from "@/lib/route-history";

interface BackLinkProps extends Omit<React.ComponentProps<typeof Link>, "href"> {
  /** Where to go when there is no in-site page to return to (direct landing, new tab). */
  fallbackHref: string;
}

/**
 * "Back to list" link that returns to the exact previous page (keeping its filters, page and
 * scroll) when the visitor came from `fallbackHref` within this site; otherwise a normal link.
 */
export function BackLink({ fallbackHref, onClick, ...props }: BackLinkProps) {
  const router = useRouter();

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const previous = getPreviousRoute();
    if (previous && previous.split("?")[0] === fallbackHref.split("?")[0]) {
      event.preventDefault();
      router.back();
    }
  }

  return <Link href={fallbackHref} onClick={handleClick} {...props} />;
}
