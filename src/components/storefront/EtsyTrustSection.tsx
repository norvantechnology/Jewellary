import { ArrowUpRight, Star } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { EtsyLogo } from "@/components/shared/EtsyLogo";
import { Container, Section } from "@/components/shared/primitives";

export interface EtsyTrustContent {
  eyebrow: string;
  heading: string;
  text: string;
  shopName: string;
  url: string;
  ctaLabel: string;
  rating: string;
  reviewCount: string;
  sales: string;
  ratingLabel: string;
  reviewCountLabel: string;
  salesLabel: string;
  points: string[];
}

/**
 * Compact "Also on Etsy" trust strip: badge, one-line heading, optional stats (shown only when
 * filled with real numbers in site-content.json) and a link to the shop.
 */
export function EtsyTrustSection({
  content,
  headingId = "etsy-trust-heading",
}: {
  content: EtsyTrustContent;
  headingId?: string;
}) {
  if (!content.url) return null;
  const stats = [
    { value: content.rating, label: content.ratingLabel, star: true },
    { value: content.reviewCount, label: content.reviewCountLabel, star: false },
    { value: content.sales, label: content.salesLabel, star: false },
  ].filter((s) => s.value.trim());

  return (
    <Section className="bg-bg py-6 md:py-8" aria-labelledby={headingId}>
      <Container variant="wide">
        <Reveal className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <EtsyLogo size="lg" />
            <div className="min-w-0">
              <h2 id={headingId} className="text-base font-semibold text-text sm:text-lg">
                {content.heading}
              </h2>
              <p className="text-xs text-text-muted sm:text-sm">
                {content.eyebrow} · {content.shopName}
              </p>
            </div>
          </div>

          {stats.length > 0 && (
            <dl className="flex items-center gap-5 sm:border-l sm:border-border sm:pl-6">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="flex items-center justify-center gap-1 text-base font-semibold text-text">
                    {stat.value}
                    {stat.star && (
                      <Star className="size-3.5 fill-accent text-accent" aria-hidden="true" />
                    )}
                  </dd>
                  <dd className="text-[11px] text-text-muted">{stat.label}</dd>
                </div>
              ))}
            </dl>
          )}

          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-ui group inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium text-text hover:border-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {content.ctaLabel}
            <ArrowUpRight
              className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
            <span className="sr-only">(opens Etsy in a new tab)</span>
          </a>
        </Reveal>
      </Container>
    </Section>
  );
}
