"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";

interface AnnouncementBarProps {
  text?: string | null;
  href?: string | null;
  enabled?: boolean;
}

const STORAGE_KEY = "maison_announcement_dismissed";
const DISMISS_EVENT = "maison:announcement-dismissed";

function subscribe(callback: () => void) {
  window.addEventListener(DISMISS_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(DISMISS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getClientSnapshot(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AnnouncementBar({ text, href, enabled = true }: AnnouncementBarProps) {
  const dismissed = React.useSyncExternalStore(subscribe, getClientSnapshot, () => false);

  if (!enabled || !text || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Store announcement"
      className="relative flex min-h-10 items-center justify-center border-b border-border bg-primary px-11 py-1.5 text-center text-xs tracking-[0.08em] text-primary-foreground uppercase"
    >
      {href ? (
        <Link href={href} className="underline-offset-4 hover:underline">
          {text}
        </Link>
      ) : (
        <span>{text}</span>
      )}
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          try {
            window.sessionStorage.setItem(STORAGE_KEY, "1");
            window.dispatchEvent(new Event(DISMISS_EVENT));
          } catch {
            // Ignore
          }
        }}
        className="absolute right-2 inline-flex size-9 cursor-pointer items-center justify-center rounded-sm text-primary-foreground/80 transition-colors hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
