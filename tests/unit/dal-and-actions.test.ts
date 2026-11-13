// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, ForbiddenError, UnauthorizedError } from "@/server/errors";

const hoisted = vi.hoisted(() => {
  const cookieStore = new Map<string, string>();
  let headerEntries: Record<string, string> = {};
  let throwHeaders = false;
  return {
    cookieStore,
    setHeaders: (h: Record<string, string>, shouldThrow = false) => {
      headerEntries = h;
      throwHeaders = shouldThrow;
    },
    getHeaders: () => {
      if (throwHeaders) throw new Error("No headers");
      return new Headers(headerEntries);
    },
    getSession: vi.fn(),
    findUser: vi.fn(),
    writeAuditLog: vi.fn(),
    redirectFn: vi.fn((url: string): never => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
  };
});

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

vi.mock("next/headers", () => ({
  headers: async () => hoisted.getHeaders(),
  cookies: async () => ({
    get: (name: string) =>
      hoisted.cookieStore.has(name) ? { value: hoisted.cookieStore.get(name)! } : undefined,
    set: (name: string, value: string) => {
      hoisted.cookieStore.set(name, value);
    },
    delete: (name: string) => {
      hoisted.cookieStore.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: hoisted.redirectFn,
}));

vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: hoisted.getSession,
    },
  },
}));

vi.mock("@/server/db", () => ({
  db: {
    user: {
      findUnique: hoisted.findUser,
    },
    storeSetting: {
      findUnique: vi.fn().mockResolvedValue({ requireAdminTwoFactor: false }),
    },
  },
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: hoisted.writeAuditLog,
}));

import { createAction } from "@/server/create-action";
import {
  getOptionalSession,
  requirePageUser,
  requirePermission,
  requireRole,
  requireUser,
} from "@/server/dal";
import {
  buildSignedGuestCookieValue,
  clearGuestTokenCookie,
  getOrCreateGuestTokenCookie,
  readGuestTokenFromCookies,
  verifySignedGuestCookieValue,
} from "@/server/guest-token";
import { clearMemoryRateLimits, getClientIp, getClientUserAgent } from "@/server/rate-limit";

describe("DAL, guest cookies, request headers, and createAction coverage", () => {
  beforeEach(() => {
    hoisted.cookieStore.clear();
    hoisted.setHeaders({ cookie: "better-auth.session_token=test" });
    hoisted.getSession.mockReset();
    hoisted.findUser.mockReset();
    hoisted.writeAuditLog.mockReset();
    hoisted.redirectFn.mockClear();
    clearMemoryRateLimits();
  });

  it("extracts client IP and user-agent headers safely", async () => {
    hoisted.setHeaders({
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
      "user-agent": "VitestClient/1.0",
    });
    expect(await getClientIp()).toBe("203.0.113.9");
    expect(await getClientUserAgent()).toBe("VitestClient/1.0");

    hoisted.setHeaders({ "x-real-ip": "198.51.100.7" });
    expect(await getClientIp()).toBe("198.51.100.7");

    hoisted.setHeaders({}, true);
    expect(await getClientIp()).toBe("127.0.0.1");
    expect(await getClientUserAgent()).toBeUndefined();
  });

  it("signs, reads, rotates, and clears guest cookies safely", async () => {
    const hexId = "0123456789abcdef0123456789abcdef";
    const signed = buildSignedGuestCookieValue(hexId);
    expect(verifySignedGuestCookieValue(signed)).toBe(hexId);
    expect(verifySignedGuestCookieValue(null)).toBeNull();
    expect(verifySignedGuestCookieValue("nodot")).toBeNull();
    expect(verifySignedGuestCookieValue("not-hex.sig")).toBeNull();
    expect(verifySignedGuestCookieValue(`${hexId}.wrong`)).toBeNull();

    expect(await readGuestTokenFromCookies()).toBeNull();
    const created = await getOrCreateGuestTokenCookie();
    expect(created).toMatch(/^[a-f0-9]{32}$/);
    expect(await readGuestTokenFromCookies()).toBe(created);
    expect(await getOrCreateGuestTokenCookie()).toBe(created);

    await clearGuestTokenCookie();
    expect(await readGuestTokenFromCookies()).toBeNull();
  });

  it("resolves DAL sessions, active bans, anonymization, roles, and permissions", async () => {
    hoisted.getSession.mockResolvedValue(null);
    expect(await getOptionalSession()).toBeNull();
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(requirePageUser("/account/orders")).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Faccount%2Forders",
    );

    hoisted.getSession.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } });
    hoisted.findUser.mockResolvedValueOnce({
      id: "u1",
      name: "Gone",
      email: "gone@example.com",
      emailVerified: true,
      phone: null,
      role: "CUSTOMER",
      banned: false,
      banExpires: null,
      anonymizedAt: new Date(),
    });
    expect(await getOptionalSession()).toBeNull();

    hoisted.findUser.mockResolvedValueOnce({
      id: "u1",
      name: "Banned",
      email: "ban@example.com",
      emailVerified: true,
      phone: null,
      role: "STAFF",
      banned: true,
      banExpires: new Date(Date.now() + 60_000),
      anonymizedAt: null,
    });
    expect(await getOptionalSession()).toBeNull();

    hoisted.findUser.mockResolvedValue({
      id: "u2",
      name: "Atelier Staff",
      email: "staff@example.com",
      emailVerified: true,
      phone: "+12125550199",
      role: "STAFF",
      banned: false,
      banExpires: null,
      anonymizedAt: null,
    });

    const ctx = await requirePageUser("/admin");
    expect(ctx.user.role).toBe("STAFF");
    expect(await requireRole("STAFF")).toMatchObject({ sessionId: "s1" });
    await expect(requireRole("ADMIN")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requirePermission("settings:manage")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await requirePermission("orders:update_status")).toMatchObject({ sessionId: "s1" });
  });

  it("executes createAction across auth levels, validation, rate limits, audits, and errors", async () => {
    hoisted.getSession.mockResolvedValue({ user: { id: "u_admin" }, session: { id: "s_admin" } });
    hoisted.findUser.mockResolvedValue({
      id: "u_admin",
      name: "Admin",
      email: "admin@maison.test",
      emailVerified: true,
      phone: null,
      role: "ADMIN",
      banned: false,
      banExpires: null,
      anonymizedAt: null,
    });

    const adminAction = createAction(
      {
        name: "test.admin",
        schema: z.object({ label: z.string().min(3) }),
        auth: { permission: "settings:manage" },
        rateLimit: { tier: "adminWrite" },
        audit: {
          action: "test.updated",
          entityType: "Test",
          entityId: () => "t-1",
          after: (input) => ({ label: input.label }),
        },
      },
      async (input, ctx) => ({ saved: input.label, actor: ctx.auth?.user.email }),
    );

    const invalid = await adminAction({ label: "x" });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.code).toBe("VALIDATION_ERROR");
      expect(invalid.error.fieldErrors?.label).toBeDefined();
    }

    const ok = await adminAction({ label: "Solitaire" });
    expect(ok).toEqual({
      ok: true,
      data: { saved: "Solitaire", actor: "admin@maison.test" },
    });
    expect(hoisted.writeAuditLog).toHaveBeenCalledTimes(1);

    const roleAction = createAction(
      {
        name: "test.minRole",
        schema: z.object({ flag: z.boolean() }),
        auth: { minRole: "STAFF" },
      },
      async () => ({ done: true }),
    );
    expect(await roleAction({ flag: true })).toEqual({ ok: true, data: { done: true } });

    const requiredAction = createAction(
      {
        name: "test.required",
        schema: z.object({ throwType: z.enum(["app", "unexpected"]) }),
        auth: "required",
      },
      async (input) => {
        if (input.throwType === "app") {
          throw new AppError("CONFLICT", "Duplicate state", 409);
        }
        throw new Error("boom");
      },
    );

    const appErr = await requiredAction({ throwType: "app" });
    expect(appErr).toEqual({
      ok: false,
      error: { code: "CONFLICT", message: "Duplicate state", fieldErrors: undefined },
    });

    const unexpectedErr = await requiredAction({ throwType: "unexpected" });
    expect(unexpectedErr.ok).toBe(false);
    if (!unexpectedErr.ok) {
      expect(unexpectedErr.error.code).toBe("INTERNAL_ERROR");
    }

    const publicLimited = createAction(
      {
        name: "test.publicRl",
        schema: z.object({ val: z.string() }),
        auth: "public",
        rateLimit: { tier: "forgotPassword", key: (i) => i.val },
      },
      async () => "ok",
    );
    for (let i = 0; i < 3; i += 1) {
      expect((await publicLimited({ val: "same@test.com" })).ok).toBe(true);
    }
    const blocked = await publicLimited({ val: "same@test.com" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error.code).toBe("RATE_LIMITED");
    }
  });
});
