"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Container, Section } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error", error.digest);
  }, [error]);

  return (
    <main id="main-content" className="min-h-[75dvh] bg-background">
      <Section spacing="lg">
        <Container className="flex flex-col items-center text-center">
          <p className="text-editorial-label text-destructive">Unexpected Error</p>
          <h1 className="mt-3 font-display text-4xl font-medium text-foreground">
            Something Went Wrong
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            We could not complete your request right now. Please try again or contact our concierge
            team if the issue persists.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button type="button" onClick={reset}>
              Try Again
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Return Home</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </main>
  );
}
