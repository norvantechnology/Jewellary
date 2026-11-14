import Link from "next/link";
import { getSiteContent } from "@/modules/site-content/site-content.service";
import { Gem } from "lucide-react";
import { NotFoundBeacon } from "@/components/layout/NotFoundBeacon";
import { Float } from "@/components/motion/Float";
import { FadeIn } from "@/components/motion/Reveal";
import { Container, Section } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const page = (await getSiteContent()).pages.notFound;
  return (
    <main id="main-content" className="min-h-[75dvh] bg-background">
      <NotFoundBeacon />
      <Section spacing="lg">
        <Container className="flex flex-col items-center text-center">
          <Float amplitude={7} duration={7} rotate={1.5}>
            <div className="mb-6 flex size-16 items-center justify-center rounded-full border border-border bg-card text-accent-text shadow-sm">
              <Gem className="size-7 stroke-[1.4]" aria-hidden="true" />
            </div>
          </Float>
          <FadeIn>
            <h1 className="type-h1 font-semibold text-foreground">{page.heading}</h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              {page.text}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link href="/collections">{page.primaryLabel}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/search">{page.secondaryLabel}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/contact">{page.tertiaryLabel}</Link>
              </Button>
            </div>
          </FadeIn>
        </Container>
      </Section>
    </main>
  );
}
