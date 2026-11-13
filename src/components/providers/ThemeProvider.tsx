"use client";

import * as React from "react";
import { preconnect, prefetchDNS } from "react-dom";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { BRAND_PALETTE } from "@/lib/brand-palette";

interface ThemeProviderProps {
  children: React.ReactNode;
  imageCdnOrigin?: string | null;
}

const CLIENT_SCRIPT_PROPS =
  typeof window === "undefined" ? undefined : ({ type: "application/json" } as const);

function isExternalCdnOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "[::1]";
  } catch {
    return false;
  }
}

function ThemeColorMetaSync() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    const color = resolvedTheme === "dark" ? BRAND_PALETTE.dark.bg : BRAND_PALETTE.light.bg;
    let dynamicMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"][data-dynamic-theme="true"]',
    );
    if (!dynamicMeta) {
      dynamicMeta = document.createElement("meta");
      dynamicMeta.name = "theme-color";
      dynamicMeta.setAttribute("data-dynamic-theme", "true");
      document.head.appendChild(dynamicMeta);
    }
    dynamicMeta.content = color;
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children, imageCdnOrigin }: ThemeProviderProps) {
  if (imageCdnOrigin && isExternalCdnOrigin(imageCdnOrigin)) {
    preconnect(imageCdnOrigin);
    prefetchDNS(imageCdnOrigin);
  }

  return (
    <NextThemesProvider
      // The no-flash script only needs to run from server HTML. When React renders it in the
      // browser (e.g. a 404 boundary) mark it as an inert data block so React doesn't warn.
      scriptProps={CLIENT_SCRIPT_PROPS}
      attribute={["class", "data-theme"]}
      defaultTheme="system"
      enableSystem
      enableColorScheme
      storageKey="theme"
    >
      <ThemeColorMetaSync />
      {children}
    </NextThemesProvider>
  );
}
