import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container, Grid, Section } from "@/components/shared/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SiteHeaderConfig } from "@/types/navigation";

const SHELL_PREVIEW_CONFIG: SiteHeaderConfig = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Maison Aurelia",
  announcementEnabled: true,
  announcementText: "Complimentary insured express delivery on orders above $1,000",
  announcementHref: "/shipping-returns",
  contactEmail: process.env.EMAIL_FROM ?? "concierge@example.com",
  categories: [
    {
      id: "rings",
      name: "Rings",
      slug: "rings",
      path: "rings",
      children: [
        {
          id: "engagement",
          name: "Engagement Rings",
          slug: "engagement-rings",
          path: "rings/engagement-rings",
        },
        {
          id: "wedding",
          name: "Wedding Bands",
          slug: "wedding-bands",
          path: "rings/wedding-bands",
        },
      ],
    },
    {
      id: "necklaces",
      name: "Necklaces",
      slug: "necklaces",
      path: "necklaces",
      children: [
        { id: "pendants", name: "Diamond Pendants", slug: "pendants", path: "necklaces/pendants" },
      ],
    },
    {
      id: "earrings",
      name: "Earrings",
      slug: "earrings",
      path: "earrings",
      children: [],
    },
    {
      id: "bracelets",
      name: "Bracelets",
      slug: "bracelets",
      path: "bracelets",
      children: [],
    },
  ],
};

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header config={SHELL_PREVIEW_CONFIG} />

      <main id="main-content" className="flex-1">
        <Section spacing="lg" className="border-b border-border bg-muted/40">
          <Container>
            <div className="max-w-2xl">
              <Badge variant="outline">Fine Jewellery &amp; Diamonds</Badge>
              <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Timeless Form, Certified Radiance
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Handcrafted engagement rings, GIA-graded solitaires, and 18K gold heirlooms built
                with transparent provenance and insured delivery.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/collections">Explore Collections</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/guides">Diamond 4Cs Guide</Link>
                </Button>
              </div>
            </div>
          </Container>
        </Section>

        <Section spacing="md">
          <Container>
            <Grid cols={3}>
              <Card>
                <CardHeader>
                  <CardTitle>Engagement Rings</CardTitle>
                  <CardDescription>Solitaires, halos, and cathedral settings.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href="/collections/rings/engagement-rings"
                    className="text-sm font-medium text-accent-text underline-offset-4 hover:underline"
                  >
                    View Engagement Rings
                  </Link>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Fine Necklaces</CardTitle>
                  <CardDescription>18K gold pendants and tennis silhouettes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href="/collections/necklaces"
                    className="text-sm font-medium text-accent-text underline-offset-4 hover:underline"
                  >
                    View Necklaces
                  </Link>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Private Concierge</CardTitle>
                  <CardDescription>Gemologist advice and bespoke sourcing.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href="/contact"
                    className="text-sm font-medium text-accent-text underline-offset-4 hover:underline"
                  >
                    Request Consultation
                  </Link>
                </CardContent>
              </Card>
            </Grid>
          </Container>
        </Section>
      </main>

      <Footer config={SHELL_PREVIEW_CONFIG} />
    </div>
  );
}
