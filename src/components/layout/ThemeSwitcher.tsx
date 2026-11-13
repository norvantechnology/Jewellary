"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MOTION_EASE, useReducedMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function ThemeSwitcher({
  compact = true,
  inline = false,
  tone = "default",
  className,
  showTooltip = false,
}: {
  compact?: boolean;
  inline?: boolean;
  tone?: "default" | "footer";
  className?: string;
  showTooltip?: boolean;
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotionSafe();
  const timerRef = React.useRef<number | null>(null);
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleThemeChange = (nextTheme: string) => {
    if (!reducedMotion && typeof document !== "undefined") {
      document.documentElement.classList.add("ma-theme-switching");
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        document.documentElement.classList.remove("ma-theme-switching");
      }, 240);
    }
    setTheme(nextTheme);
  };

  if (inline) {
    const activeTheme = mounted ? (theme ?? "system") : "system";
    const options = [
      { value: "light", label: "Light", Icon: Sun },
      { value: "dark", label: "Dark", Icon: Moon },
      { value: "system", label: "Auto", Icon: Monitor },
    ] as const;

    return (
      <div
        role="radiogroup"
        aria-label="Select colour theme"
        className={cn(
          "grid w-full grid-cols-3 gap-1 rounded-lg border border-border bg-surface-2 p-1",
          className,
        )}
      >
        {options.map(({ value, label, Icon }) => {
          const checked = activeTheme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => handleThemeChange(value)}
              className={cn(
                "transition-ui inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                checked ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const iconKey = !mounted ? "sun" : resolvedTheme === "dark" ? "moon" : "sun";
  const currentIcon = !mounted ? (
    <Sun className={compact ? "size-6" : "size-5"} strokeWidth={1.5} aria-hidden="true" />
  ) : resolvedTheme === "dark" ? (
    <Moon className={compact ? "size-6" : "size-5"} strokeWidth={1.5} aria-hidden="true" />
  ) : (
    <Sun className={compact ? "size-6" : "size-5"} strokeWidth={1.5} aria-hidden="true" />
  );

  const animatedIcon = (
    <span className={cn("inline-flex items-center justify-center", compact ? "size-6" : "size-5")}>
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={iconKey}
          initial={reducedMotion ? { opacity: 0.4 } : { opacity: 0, rotate: -45, scale: 0.72 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, rotate: 45, scale: 0.72 }}
          transition={
            reducedMotion ? { duration: 0.12 } : { duration: 0.25, ease: MOTION_EASE.out }
          }
          className="inline-flex items-center justify-center"
        >
          {currentIcon}
        </m.span>
      </AnimatePresence>
    </span>
  );

  const isFooter = tone === "footer";

  const triggerButton = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label="Select colour theme"
        className={cn(
          compact
            ? "transition-ui inline-flex size-11 cursor-pointer items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
            : "transition-ui inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2",
          isFooter
            ? "text-footer-text hover:bg-footer-input-bg hover:text-footer-accent focus-visible:outline-footer-accent"
            : "text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-accent",
          className,
        )}
      >
        {animatedIcon}
        {!compact && <span className="capitalize">{mounted ? (theme ?? "system") : "system"}</span>}
      </button>
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {showTooltip ? (
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
            <TooltipContent className="hidden lg:block">Theme</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        triggerButton
      )}

      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={mounted ? (theme ?? "system") : "system"}
          onValueChange={handleThemeChange}
        >
          <DropdownMenuRadioItem value="light" className="gap-2">
            <Sun className="size-4 text-text-muted" strokeWidth={1.5} aria-hidden="true" />
            <span>Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2">
            <Moon className="size-4 text-text-muted" strokeWidth={1.5} aria-hidden="true" />
            <span>Dark</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="gap-2">
            <Monitor className="size-4 text-text-muted" strokeWidth={1.5} aria-hidden="true" />
            <span>System</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
