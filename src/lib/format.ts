/**
 * Formats a gram weight for display in product specification tables.
 */
export function formatWeightGrams(grams: number | string | null | undefined): string | null {
  if (grams === null || grams === undefined || grams === "") return null;
  const num = Number(grams);
  if (!Number.isFinite(num)) return null;
  return `${num.toFixed(2)} g`;
}

/**
 * Formats carat weight consistently with 2 decimal places.
 */
export function formatCarat(carat: number | string | null | undefined): string | null {
  if (carat === null || carat === undefined || carat === "") return null;
  const num = Number(carat);
  if (!Number.isFinite(num)) return null;
  return `${num.toFixed(2)} ct`;
}

/**
 * Masks an email address for limited-PII STAFF views (e.g. a***@example.com).
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const prefix = local.slice(0, 2);
  return `${prefix}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

/**
 * Masks a phone number for limited-PII views (keeps last 4 digits).
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `•••• ${digits.slice(-4)}`;
}
