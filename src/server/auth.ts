import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { sendResetPasswordEmail, sendVerificationEmail } from "@/server/email/send";

const baseUrl = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_SITE_URL;
export const isGoogleAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  appName: env.NEXT_PUBLIC_SITE_NAME,
  baseURL: baseUrl,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_SITE_URL, ...(env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : [])],
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
    requireEmailVerification: false,
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
    nextCookies(),
  ],
});

export type AuthInstance = typeof auth;
