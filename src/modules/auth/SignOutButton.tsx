"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/server/auth-client";
import { useUiText } from "@/components/providers/UiTextProvider";

export function SignOutButton({
  variant = "outline",
}: {
  variant?: "outline" | "secondary" | "ghost";
}) {
  const t = useUiText().auth.signOut;
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSignOut() {
    setPending(true);
    await authClient.signOut();
    toast.success(t.toast);
    router.replace("/");
    router.refresh();
  }

  return (
    <Button type="button" variant={variant} onClick={handleSignOut} loading={pending}>
      {t.label}
    </Button>
  );
}
