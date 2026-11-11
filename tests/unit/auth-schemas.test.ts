import { describe, expect, it } from "vitest";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/modules/auth/auth.schemas";
import { sanitizeAuditPayload } from "@/server/audit";

describe("Auth schemas & redirect sanitization", () => {
  it("allows relative internal redirect paths and blocks open redirects", () => {
    expect(sanitizeRedirectPath("/account")).toBe("/account");
    expect(sanitizeRedirectPath("/collections/rings?metal=gold")).toBe(
      "/collections/rings?metal=gold",
    );
    expect(sanitizeRedirectPath("https://evil.example/phish", "/account")).toBe("/account");
    expect(sanitizeRedirectPath("//evil.example/phish", "/account")).toBe("/account");
    expect(sanitizeRedirectPath("/\\evil.example", "/account")).toBe("/account");
    expect(sanitizeRedirectPath(undefined, "/wishlist")).toBe("/wishlist");
  });

  it("enforces strict login and registration rules", () => {
    expect(
      loginSchema.safeParse({ email: "  User@Example.COM ", password: "secret" }).data,
    ).toEqual({
      email: "user@example.com",
      password: "secret",
    });

    const badPass = registerSchema.safeParse({
      name: "Claire",
      email: "claire@example.com",
      password: "short",
      confirmPassword: "short",
      acceptTerms: true,
    });
    expect(badPass.success).toBe(false);

    const mismatch = registerSchema.safeParse({
      name: "Claire",
      email: "claire@example.com",
      password: "ValidPassword123!",
      confirmPassword: "OtherPassword123!",
      acceptTerms: true,
    });
    expect(mismatch.success).toBe(false);

    const noTerms = registerSchema.safeParse({
      name: "Claire",
      email: "claire@example.com",
      password: "ValidPassword123!",
      confirmPassword: "ValidPassword123!",
      acceptTerms: false,
    });
    expect(noTerms.success).toBe(false);

    expect(forgotPasswordSchema.safeParse({ email: "bad-email" }).success).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        token: "tok",
        newPassword: "ValidPassword123!",
        confirmPassword: "ValidPassword123!",
      }).success,
    ).toBe(true);
  });

  it("redacts sensitive credentials from audit payloads", () => {
    const cleaned = sanitizeAuditPayload({
      email: "admin@example.com",
      password: "plain-password",
      accessToken: "jwt-123",
      nested: { secret: "xyz", amount: 500 },
    });

    expect(cleaned).toEqual({
      email: "admin@example.com",
      password: "[REDACTED]",
      accessToken: "[REDACTED]",
      nested: { secret: "[REDACTED]", amount: 500 },
    });
  });
});
