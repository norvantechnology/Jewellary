import "@testing-library/jest-dom/vitest";
import { config } from "dotenv";
import { vi } from "vitest";

config({ path: ".env" });

// Allow importing `server-only` modules in Vitest unit and integration tests.
vi.mock("server-only", () => ({}));
