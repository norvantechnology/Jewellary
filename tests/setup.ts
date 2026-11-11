import "@testing-library/jest-dom/vitest";
import { config } from "dotenv";
import { vi } from "vitest";

config({ path: ".env" });

// Allow importing `server-only` modules in Vitest unit and integration tests.
vi.mock("server-only", () => ({}));

// Allow testing `"use cache"` service helpers directly in Vitest outside Next.js server runtime.
vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
  revalidatePath: () => {},
  revalidateTag: () => {},
  updateTag: () => {},
}));
