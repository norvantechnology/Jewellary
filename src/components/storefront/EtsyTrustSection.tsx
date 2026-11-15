import { ArrowUpRight, BadgeCheck, Star } from "lucide-react";
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
 * "Also on Etsy" trust band. Stats (rating, reviews, sales) come from site-content.json and are
 * shown only when filled with the real numbers from the Etsy shop page.
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
    <Section className="bg-bg py-10 md:py-14" aria-labelledby={headingId}>
      <Container variant="wide">
        <Reveal className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-12 lg:items-center lg:gap-10 lg:p-10">
            <div className="space-y-4 lg:col-span-7">
              <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-bg-alt py-1 pr-3.5 pl-1 text-xs font-medium text-text-2">
                <EtsyLogo size="sm" className="rounded-full px-2" />
                {content.eyebrow} · {content.shopName}
              </span>
              <h2
                id={headingId}
                className="type-h2 font-display font-semibold text-balance text-text"
              >
                {content.heading}
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-text-2 sm:text-base">
                {content.text}
              </p>
              {content.points.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {content.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-text">
                      <BadgeCheck
                        className="mt-0.5 size-4 shrink-0 text-accent-text"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-bg-alt p-5 sm:p-6 lg:col-span-5">
              <div className="flex items-center gap-3">
                <EtsyLogo size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{content.shopName}</p>
                  <p className="text-xs text-text-muted">
                    etsy.com/shop/{content.shopName.toLowerCase()}
                  </p>
                </div>
              </div>
              {stats.length > 0 && (
                <dl className="grid grid-cols-3 gap-3">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-border bg-surface px-2 py-3 text-center"
                    >
                      <dt className="sr-only">{stat.label}</dt>
                      <dd className="flex items-center justify-center gap-1 font-display text-2xl font-semibold text-text">
                        {stat.value}
                        {stat.star && (
                          <Star className="size-4 fill-accent text-accent" aria-hidden="true" />
                        )}
                      </dd>
                      <dd className="mt-1 text-xs text-text-muted">{stat.label}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <a
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-ui group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-center text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {content.ctaLabel}
                <ArrowUpRight
                  className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
                <span className="sr-only">(opens Etsy in a new tab)</span>
              </a>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
