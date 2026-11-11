import { cn } from "@/lib/utils";

interface LogoProps {
  siteName: string;
  className?: string;
  showWordmark?: boolean;
}

export function Logo({ siteName, className, showWordmark = true }: LogoProps) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-2 text-foreground sm:gap-2.5", className)}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="size-6 shrink-0 text-accent sm:size-7"
      >
        <path
          d="M16 3L27 12L16 29L5 12L16 3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M5 12H27" stroke="currentColor" strokeWidth="1.25" />
        <path
          d="M11 12L16 3L21 12L16 29L11 12Z"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span className="truncate font-display text-base font-semibold tracking-[0.05em] uppercase sm:text-xl md:text-2xl md:tracking-[0.06em]">
          {siteName}
        </span>
      )}
    </span>
  );
}
