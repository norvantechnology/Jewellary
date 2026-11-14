"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { Float } from "@/components/motion/Float";
import { FadeIn } from "@/components/motion/Reveal";
import { Container, Section } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useUiText().errors;
  useEffect(() => {
    console.error("Unhandled route error", error.digest);
  }, [error]);

  return (
    <main id="main-content" className="min-h-[75dvh] bg-background">
      <Section spacing="lg">
        <Container className="flex flex-col items-center text-center">
          <Float amplitude={6} duration={7} rotate={1.2}>
            <div className="mb-6 flex size-16 items-center justify-center rounded-full border border-border bg-card text-accent-text shadow-sm">
              <ShieldAlert className="size-7 stroke-[1.4]" aria-hidden="true" />
            </div>
          </Float>
          <FadeIn>
            <h1 className="type-h1 font-semibold text-foreground">{t.heading}</h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              {t.text}
            </p>
            <Button type="button" onClick={reset} className="mt-8">
              {t.retry}
            </Button>
          </FadeIn>
        </Container>
      </Section>
    </main>
  );
}
