import "server-only";
import { headers } from "next/headers";

/**
 * The path + query of the current request (set by src/proxy.ts), for login `next=` links.
 * Falls back when the header is missing or not a same-site path under `prefix`.
 */
export async function getRequestReturnTo(prefix: string): Promise<string> {
  const value = (await headers()).get("x-ma-return-to");
  if (value && value.startsWith(prefix) && !value.startsWith("//")) return value;
  return prefix;
}
