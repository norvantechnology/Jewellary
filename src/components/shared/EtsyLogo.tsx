/* eslint-disable design-tokens/no-raw-hex -- Etsy's brand orange is fixed by its branding. */
import { cn } from "@/lib/utils";

/** Etsy badge: white "Etsy" wordmark on Etsy orange, so shoppers recognize it at a glance. */
export function EtsyLogo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-[#F1641E] font-serif leading-none font-bold tracking-tight text-white",
        size === "sm" && "h-5 px-1.5 text-[11px]",
        size === "md" && "h-7 px-2 text-sm",
        size === "lg" && "h-9 px-3 text-lg",
        className,
      )}
      aria-hidden="true"
    >
      Etsy
    </span>
  );
}
