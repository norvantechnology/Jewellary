import { Suspense } from "react";
import type { Metadata } from "next";
import { NOINDEX_FOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import Link from "next/link";
import { MailX, Sparkles } from "lucide-react";
import { Float } from "@/components/motion/Float";
import { FadeIn } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.newsletter.seo, {
    pathname: "/newsletter",
    robots: NOINDEX_FOLLOW_ROBOTS,
  });
}

async function NewsletterStatusBody({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; status?: string }>;
}) {
  const [sp, siteContent] = await Promise.all([searchParams, getSiteContent()]);
  const page = siteContent.pages.newsletter;
  const action = sp.action ?? "";
  const status = sp.status ?? "";

  const isConfirmed = action === "confirm" && status === "confirmed";
  const isUnsubscribed = action === "unsubscribe" && status === "unsubscribed";
  const isInvalid = status === "invalid";
  const state = isConfirmed
    ? page.confirmed
    : isUnsubscribed
      ? page.unsubscribed
      : isInvalid
        ? page.invalid
        : page.default;

  return (
    <section className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center px-4 py-12 text-center md:py-16">
      <FadeIn className="w-full rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <Float amplitude={6} duration={7} rotate={1.2}>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-surface-2 text-accent-text">
            {isConfirmed ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5 text-success"
                aria-hidden="true"
              >
                <path d="M5 13l4 4L19 7" className="ma-check-draw" />
              </svg>
            ) : isUnsubscribed || isInvalid ? (
              <MailX className="size-5 stroke-[1.5]" aria-hidden="true" />
            ) : (
              <Sparkles className="size-5 stroke-[1.5]" aria-hidden="true" />
            )}
          </div>
        </Float>

        <h1 className="text-2xl leading-[1.2] font-semibold tracking-[-0.015em] text-foreground sm:text-3xl">
          {state.heading}
        </h1>

        <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-sm">
          {state.text}
        </p>

        <div className="mt-6 flex flex-col justify-center gap-3 min-[480px]:flex-row min-[480px]:flex-wrap">
          <Button asChild className="w-full min-[480px]:w-auto">
            <Link href="/collections">{page.primaryCta}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full min-[480px]:w-auto">
            <Link href="/">{page.secondaryCta}</Link>
          </Button>
        </div>
      </FadeIn>
    </section>
  );
}

export default function NewsletterStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; status?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <section className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-4 py-10 sm:py-16">
          <Skeleton className="h-64 w-full rounded-lg" />
        </section>
      }
    >
      <NewsletterStatusBody searchParams={searchParams} />
    </Suspense>
  );
}
