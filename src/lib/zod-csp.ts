import { z } from "zod";

/**
 * Configure Zod v4 to skip JIT `new Function("")` capability probing in browser
 * runtimes so strict CSP headers without `'unsafe-eval'` never emit violations.
 */
if (typeof window !== "undefined") {
  z.config({ jitless: true });
}
