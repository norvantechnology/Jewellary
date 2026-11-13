/** Extract a readable message from API error payloads ({ error: string | { message } } or { message }). */
export function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as { error?: unknown; message?: unknown };
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }
  if (record.error && typeof record.error === "object") {
    const nested = (record.error as { message?: unknown }).message;
    if (typeof nested === "string" && nested.trim()) {
      return nested;
    }
  }
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }
  return fallback;
}
