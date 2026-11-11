import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DevUiShowcase } from "./DevUiShowcase";

export const metadata: Metadata = {
  title: "Design System Gallery",
  robots: { index: false, follow: false },
};

async function DevUiGate() {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_UI !== "true") {
    notFound();
  }
  return <DevUiShowcase />;
}

export default function DevUiPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background p-8">Loading gallery...</div>}>
      <DevUiGate />
    </Suspense>
  );
}
