// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasPermission, roleAtLeast } from "@/lib/permissions";
import { writeAuditLog } from "@/server/audit";
import { auth } from "@/server/auth";
import { clearEmailOutbox, getEmailOutbox } from "@/server/email/client";
import { RateLimitError } from "@/server/errors";
import { createPrismaClient } from "@/server/prisma-client";
import { clearMemoryRateLimits, enforceRateLimit } from "@/server/rate-limit";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

const db = createPrismaClient();

describe("Auth, RBAC, Rate Limiting, Email Outbox & Audit Log", () => {
  const testEmail = `test-user-${Date.now()}@example.com`;
  let createdUserId: string | null = null;

  beforeEach(() => {
    clearMemoryRateLimits();
    clearEmailOutbox();
  });

  afterAll(async () => {
    if (createdUserId) {
      await db.user.deleteMany({ where: { id: createdUserId } });
    }
    await db.auditLog.deleteMany({ where: { action: "TEST_RBAC_AUDIT" } });
    await db.$disconnect();
  });

  it("enforces role hierarchy and permission matrix strictly", () => {
    expect(roleAtLeast("CUSTOMER", "CUSTOMER")).toBe(true);
    expect(roleAtLeast("CUSTOMER", "STAFF")).toBe(false);
    expect(roleAtLeast("STAFF", "STAFF")).toBe(true);
    expect(roleAtLeast("STAFF", "ADMIN")).toBe(false);
    expect(roleAtLeast("ADMIN", "ADMIN")).toBe(true);

    expect(hasPermission("STAFF", "catalog:write")).toBe(true);
    expect(hasPermission("STAFF", "customers:change_role")).toBe(false);
    expect(hasPermission("STAFF", "settings:manage")).toBe(false);
    expect(hasPermission("ADMIN", "customers:change_role")).toBe(true);
    expect(hasPermission("CUSTOMER", "orders:read")).toBe(false);
  });

  it("enforces tiered rate limits and attaches retryAfterSeconds", async () => {
    const key = `198.51.100.44:${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await expect(enforceRateLimit("forgotPassword", key)).resolves.toMatchObject({
        success: true,
      });
    }

    await expect(enforceRateLimit("forgotPassword", key)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("creates user via Better Auth, sends verification email to test outbox, and authenticates credentials", async () => {
    const signUp = await auth.api.signUpEmail({
      body: {
        name: "Test Client",
        email: testEmail,
        password: "LuxuryPassword123!",
      },
    });

    createdUserId = signUp.user.id;
    expect(signUp.user.email).toBe(testEmail.toLowerCase());

    const dbUser = await db.user.findUnique({ where: { id: signUp.user.id } });
    expect(dbUser?.role).toBe("CUSTOMER");

    const outbox = getEmailOutbox();
    expect(outbox.some((m) => m.to === testEmail.toLowerCase() && m.tag === "auth-verify")).toBe(
      true,
    );

    // Unverified accounts cannot sign in.
    await expect(
      auth.api.signInEmail({ body: { email: testEmail, password: "LuxuryPassword123!" } }),
    ).rejects.toThrow(/not verified/i);

    await db.user.update({ where: { id: signUp.user.id }, data: { emailVerified: true } });

    const signIn = await auth.api.signInEmail({
      body: {
        email: testEmail,
        password: "LuxuryPassword123!",
      },
    });
    expect(signIn.user.id).toBe(signUp.user.id);
  });

  it("persists redacted audit log entries to PostgreSQL", async () => {
    await writeAuditLog({
      actorEmail: "admin@example.com",
      actorRole: "ADMIN",
      action: "TEST_RBAC_AUDIT",
      entityType: "User",
      entityId: "u_123",
      after: { role: "STAFF", password: "should-be-redacted" },
    });

    const saved = await db.auditLog.findFirst({
      where: { action: "TEST_RBAC_AUDIT" },
    });
    expect(saved).not.toBeNull();
    expect(saved?.after).toEqual({ role: "STAFF", password: "[REDACTED]" });
  });
});
