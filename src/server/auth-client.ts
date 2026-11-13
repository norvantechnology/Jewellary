"use client";

import { adminClient, inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { AuthInstance } from "@/server/auth";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL,
  plugins: [inferAdditionalFields<AuthInstance>(), adminClient(), twoFactorClient()],
});
