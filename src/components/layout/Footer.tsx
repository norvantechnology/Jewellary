import { EtsyLogo } from "@/components/shared/EtsyLogo";
import { UiText } from "@/components/shared/UiText";
import * as React from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { CurrencySwitcher } from "@/components/layout/CurrencySwitcher";
import {
  CurrentYear,
  FooterLinkAccordion,
  type FooterSectionGroup,
} from "@/components/layout/FooterLinkAccordion";
import { FooterNewsletterForm } from "@/components/layout/FooterNewsletterForm";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { RevealStagger } from "@/components/motion/Reveal";
import { Logo } from "@/components/shared/Logo";
import type { SiteHeaderConfig } from "@/types/navigation";

function SocialIcon({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower.includes("etsy")) {
    return <EtsyLogo size="sm" />;
  }
  if (lower.includes("instagram")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden="true"
      >
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    );
  }
  if (lower.includes("youtube")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden="true"
      >
        <rect width="20" height="14" x="2" y="5" rx="4" />
        <path d="m10 9 5 3-5 3z" />
      </svg>
    );
  }
  if (lower.includes("pinterest")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden="true"
      >
        <path d="M8 20l4-9" />
        <path d="M10.7 14c.437 1.263 1.43 2 2.55 2c2.071 0 3.75-1.554 3.75-4a5 5 0 1 0-9.7 1.7" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  return <Globe className="size-5" strokeWidth={1.5} aria-hidden="true" />;
}

export interface FooterContent {
  blurb: string;
  copyright: string;
  columns: Array<{ heading: string; links: Array<{ label: string; href: string }> }>;
}

export function Footer({ config, content }: { config: SiteHeaderConfig; content: FooterContent }) {
  const categoryLinks = config.categories.slice(0, 4).map((cat) => ({
    label: cat.name,
    href: `/collections/${cat.path}`,
  }));

  // Column text comes from site-content.json → site.footer; the first column also lists categories.
  const sections: FooterSectionGroup[] = content.columns.map((column, idx) => ({
    id: `footer-${idx}`,
    heading: column.heading,
    links: idx === 0 ? [...column.links, ...categoryLinks] : column.links,
  }));

  const socialLinks = config.socialLinks ?? [];

  return (
    <footer
      data-focus-hide=""
      className="border-t border-footer-border bg-footer-bg text-footer-text"
    >
      <div className="container-wide pt-12 pb-[calc(3rem+env(safe-area-inset-bottom,0px)+var(--sticky-cta-offset,0px))] md:pt-16 lg:py-16">
        <RevealStagger className="grid gap-10 md:grid-cols-12 md:gap-8">
          {/* Column 1: Brand + Newsletter */}
          <div className="md:col-span-12 lg:col-span-5">
            <Logo
              siteName={config.siteName}
              className="text-footer-text [&_svg]:text-footer-accent"
              linkClassName="focus-visible:outline-footer-accent"
            />
            <p className="mt-3 max-w-sm text-sm text-footer-muted">{content.blurb}</p>

            <FooterNewsletterForm />
          </div>

          {/* Columns 2–4 on Mobile: Accordion */}
          <div className="md:hidden">
            <FooterLinkAccordion sections={sections} />
          </div>

          {/* Columns 2–4 on Desktop & Tablet */}
          {sections.map((section, idx) => (
            <div
              key={section.id}
              className={
                idx === 0
                  ? "hidden min-w-0 md:col-span-4 md:block lg:col-span-2"
                  : idx === 1
                    ? "hidden min-w-0 md:col-span-4 md:block lg:col-span-3"
                    : "hidden min-w-0 md:col-span-4 md:block lg:col-span-2"
              }
            >
              <h2 className="text-sm font-semibold text-footer-text">{section.heading}</h2>
              <ul className="mt-3 space-y-2.5">
                {section.links.map((item) => (
                  <li key={item.href} className="min-w-0">
                    <Link
                      href={item.href}
                      prefetch={false}
                      title={item.label}
                      className="ma-link-underline inline-flex max-w-full items-center text-sm text-footer-body transition-colors hover:text-footer-accent focus-visible:text-footer-accent focus-visible:underline focus-visible:outline-none"
                    >
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </RevealStagger>

        {/* Bottom Bar */}
        <div className="mt-10 flex flex-col items-center gap-4 border-t border-footer-border pt-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-xs text-footer-subtle">
            &copy; <CurrentYear /> {config.siteName}. {content.copyright}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end sm:gap-3">
            {socialLinks.length > 0 && (
              <div
                className="flex items-center gap-2"
                role="group"
                aria-labelledby="footer-social-label"
              >
                <span id="footer-social-label" className="sr-only">
                  <UiText section="layout" name="socialLinks" />
                </span>
                {socialLinks.map((social) => (
                  <a
                    key={social.href}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={social.label}
                    title={social.label}
                    className="transition-ui inline-flex size-11 items-center justify-center rounded-md text-footer-muted hover:bg-footer-input-bg hover:text-footer-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-footer-accent"
                  >
                    <SocialIcon label={social.label} />
                  </a>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-footer-muted sm:gap-3">
              <Link
                href="/privacy"
                prefetch={false}
                className="ma-link-underline inline-flex min-h-11 items-center px-1.5 hover:text-footer-accent focus-visible:text-footer-accent"
              >
                <UiText section="layout" name="footerPrivacy" />
              </Link>
              <Link
                href="/terms"
                prefetch={false}
                className="ma-link-underline inline-flex min-h-11 items-center px-1.5 hover:text-footer-accent focus-visible:text-footer-accent"
              >
                <UiText section="layout" name="footerTerms" />
              </Link>
            </div>

            <CurrencySwitcher compact align="end" tone="footer" />

            <ThemeSwitcher tone="footer" />
          </div>
        </div>
      </div>
    </footer>
  );
}
