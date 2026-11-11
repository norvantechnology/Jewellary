/**
 * Formats a Date or ISO string for user-facing editorial and order timelines.
 */
export function formatDate(
  date: Date | string,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
): string {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(parsed);
}

/**
 * Computes estimated delivery date range adding business days from today.
 */
export function estimateDeliveryWindow(
  minDays: number,
  maxDays: number,
  leadTimeDays = 0,
  fromDate = new Date(),
): { from: Date; to: Date } {
  const addBusinessDays = (start: Date, businessDays: number): Date => {
    const result = new Date(start);
    let remaining = Math.max(0, businessDays);
    while (remaining > 0) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) {
        remaining -= 1;
      }
    }
    return result;
  };

  return {
    from: addBusinessDays(fromDate, leadTimeDays + minDays),
    to: addBusinessDays(fromDate, leadTimeDays + maxDays),
  };
}

export function formatDeliveryRange(from: Date, to: Date, locale = "en-US"): string {
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  return `${fmt.format(from)} – ${fmt.format(to)}`;
}
