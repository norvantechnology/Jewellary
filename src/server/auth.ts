import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { env } from "@/lib/env";
import { assertHumanSubmission } from "@/server/abuse";
import { db } from "@/server/db";
import { sendResetPasswordEmail, sendVerificationEmail } from "@/server/email/send";

/** Addresses Vercel provides automatically (production domain, branch preview, this deployment). */
const vercelOrigins = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_URL,
]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);

const baseUrl =
  env.BETTER_AUTH_URL ?? process.env.SITE_URL ?? vercelOrigins[0] ?? env.NEXT_PUBLIC_SITE_URL;
export const isGoogleAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

const STAFF_ROLES = ["ADMIN", "STAFF"];

async function isStaffAccount(email: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { role: true },
  });
  return Boolean(user && STAFF_ROLES.includes(user.role));
}

/** Staff accounts are created by the store owner, so their email needs no verification. */
async function markStaffAccountVerified(email: string): Promise<void> {
  await db.user.updateMany({
    where: {
      email: email.trim().toLowerCase(),
      role: { in: STAFF_ROLES as Array<"ADMIN" | "STAFF"> },
      emailVerified: false,
    },
    data: { emailVerified: true },
  });
}

export const auth = betterAuth({
  appName: env.NEXT_PUBLIC_SITE_NAME,
  baseURL: baseUrl,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: (request) => {
    const origins = new Set<string>([env.NEXT_PUBLIC_SITE_URL]);
    if (env.BETTER_AUTH_URL) {
      origins.add(env.BETTER_AUTH_URL);
    }
    if (process.env.SITE_URL) origins.add(process.env.SITE_URL);
    for (const origin of vercelOrigins) origins.add(origin);
    if (
      process.env.NODE_ENV !== "production" ||
      baseUrl.includes("localhost") ||
      baseUrl.includes("127.0.0.1")
    ) {
      origins.add("http://localhost:3000");
      origins.add("http://127.0.0.1:3000");
      if (process.env.PORT) {
        origins.add(`http://localhost:${process.env.PORT}`);
        origins.add(`http://127.0.0.1:${process.env.PORT}`);
      }
    }
    const reqHost = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host");
    if (reqHost) {
      const reqHostname = reqHost.split(":")[0]?.toLowerCase() ?? "";
      if (
        reqHostname === "localhost" ||
        reqHostname === "127.0.0.1" ||
        reqHostname === "::1" ||
        reqHostname === "[::1]"
      ) {
        origins.add(`http://${reqHost}`);
      }
    }
    return Array.from(origins);
  },
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Unverified addresses cannot sign in: prevents registering with someone else's email.
    requireEmailVerification: true,
    // A reset signs out every device, so a stolen session cannot outlive the password.
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, token }) => {
      const resetUrl = `${env.NEXT_PUBLIC_SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
      await sendResetPasswordEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, token }) => {
      // Admin and staff accounts never get verification emails (see the sign-in hook below).
      if (await isStaffAccount(user.email)) return;
      const verifyUrl = `${env.NEXT_PUBLIC_SITE_URL}/verify-email?token=${encodeURIComponent(token)}`;
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        verifyUrl,
      });
    },
  },
  socialProviders: isGoogleAuthEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  rateLimit: {
    enabled: false,
  },
  advanced: {
    useSecureCookies: baseUrl.startsWith("https://"),
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  },
  plugins: [
    admin({
      roles: {
        CUSTOMER: userAc,
        STAFF: userAc,
        ADMIN: adminAc,
      },
      defaultRole: "CUSTOMER",
      adminRoles: ["ADMIN"],
    }),
    twoFactor({
      issuer: env.NEXT_PUBLIC_SITE_NAME,
    }),
    nextCookies(),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Admin/staff sign in without any email verification step or email.
      if (ctx.path === "/sign-in/email") {
        const body =
          ctx.body && typeof ctx.body === "object" ? (ctx.body as Record<string, unknown>) : {};
        if (typeof body.email === "string") await markStaffAccountVerified(body.email);
        return;
      }
      if (ctx.path !== "/sign-up/email" || !ctx.request) {
        return;
      }

      const body =
        ctx.body && typeof ctx.body === "object" ? (ctx.body as Record<string, unknown>) : {};
      const website =
        typeof body.website === "string"
          ? body.website
          : (ctx.request.headers.get("x-abuse-website") ?? "");
      const timingToken =
        typeof body.timingToken === "string"
          ? body.timingToken
          : (ctx.request.headers.get("x-abuse-timing") ?? "");
      const turnstileToken =
        typeof body.turnstileToken === "string"
          ? body.turnstileToken
          : (ctx.request.headers.get("x-abuse-turnstile") ?? "");
      const forwarded = ctx.request.headers.get("x-forwarded-for");
      const ip = forwarded ? forwarded.split(",")[0]?.trim() : undefined;

      try {
        await assertHumanSubmission({ website, timingToken, turnstileToken, ip });
      } catch (err) {
        throw new APIError("BAD_REQUEST", {
          message:
            err instanceof Error
              ? err.message
              : "We could not verify your submission right now. Please try again.",
        });
      }
    }),
  },
});

export type AuthInstance = typeof auth;
