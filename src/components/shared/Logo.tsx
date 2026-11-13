import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  siteName: string;
  className?: string;
  linkClassName?: string;
  showWordmark?: boolean;
  /** Destination route when clicking the brand logo. Pass `null` for non-interactive art. */
  href?: string | null;
  onClick?: () => void;
}

export function Logo({
  siteName,
  className,
  linkClassName,
  showWordmark = true,
  href = "/",
  onClick,
}: LogoProps) {
  const brandMark = (
    <span className={cn("inline-flex min-w-0 items-center gap-2 text-text sm:gap-2.5", className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="size-5 shrink-0 text-accent-text sm:size-7 dark:text-accent"
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
        <span className="min-w-0 truncate font-display text-xs font-semibold tracking-[0.04em] whitespace-nowrap uppercase min-[375px]:text-sm sm:text-lg sm:tracking-[0.06em] lg:text-xl">
          {siteName}
        </span>
      )}
    </span>
  );

  if (href === null) {
    return brandMark;
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={`${siteName} homepage`}
      className={cn(
        "transition-ui inline-flex min-h-11 min-w-0 items-center rounded-md hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        linkClassName,
      )}
    >
      {brandMark}
    </Link>
  );
}
