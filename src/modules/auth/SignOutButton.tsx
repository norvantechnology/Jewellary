"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/server/auth-client";

export function SignOutButton({
  variant = "outline",
}: {
  variant?: "outline" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSignOut() {
    setPending(true);
    await authClient.signOut();
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  }

  return (
    <Button type="button" variant={variant} onClick={handleSignOut} loading={pending}>
      Sign Out
    </Button>
  );
}
