import { formatDate } from "@/lib/dates";

const DATE_ONLY: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
const DATE_TIME: Intl.DateTimeFormatOptions = {
  ...DATE_ONLY,
  hour: "numeric",
  minute: "2-digit",
};

interface LocalDateProps {
  value: Date | string;
  /** Include the time of day. */
  withTime?: boolean;
  className?: string;
}

/**
 * One consistent, unambiguous date format ("Nov 12, 2026") everywhere. The server and the
 * browser may sit in different time zones, so the text is allowed to differ at hydration.
 */
export function LocalDate({ value, withTime = false, className }: LocalDateProps) {
  const date = typeof value === "string" ? new Date(value) : value;
  return (
    <time dateTime={date.toISOString()} className={className} suppressHydrationWarning>
      {formatDate(date, "en-US", withTime ? DATE_TIME : DATE_ONLY)}
    </time>
  );
}
