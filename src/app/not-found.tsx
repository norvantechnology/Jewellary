import Link from "next/link";
import { Search } from "lucide-react";
import { Container, Section } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="min-h-[75dvh] bg-background">
      <Section spacing="lg">
        <Container className="flex flex-col items-center text-center">
          <p className="text-editorial-label text-accent-text">Error 404</p>
          <h1 className="mt-3 font-display text-4xl font-medium text-foreground sm:text-5xl">
            This Piece Could Not Be Found
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            The collection item or page you requested may have been archived or moved. Explore our
            signature collections or search by diamond shape, metal, or SKU.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/collections">Browse Collections</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/search" className="gap-2">
                <Search className="size-4" aria-hidden="true" />
                Search Catalogue
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">Return Home</Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-4 border-t border-border pt-6 text-xs tracking-wider text-muted-foreground uppercase">
            <Link href="/collections/rings" className="hover:text-foreground">
              Rings
            </Link>
            <Link href="/collections/necklaces" className="hover:text-foreground">
              Necklaces
            </Link>
            <Link href="/collections/earrings" className="hover:text-foreground">
              Earrings
            </Link>
            <Link href="/guides" className="hover:text-foreground">
              Buying Guides
            </Link>
          </div>
        </Container>
      </Section>
    </main>
  );
}
