import { cacheLife } from "next/cache";
import Link from "next/link";
import { ShieldCheck, Sparkles, Truck } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Logo } from "@/components/shared/Logo";
import { Container } from "@/components/shared/primitives";
import type { SiteHeaderConfig } from "@/types/navigation";

interface FooterProps {
  config: SiteHeaderConfig;
}

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function Footer({ config }: FooterProps) {
  return (
    <footer className="border-t border-border bg-muted/40 text-foreground">
      {/* Trust strip */}
      <div className="border-b border-border bg-card">
        <Container>
          <div className="grid gap-6 py-8 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">Independently Certified</p>
                <p className="text-xs text-muted-foreground">
                  GIA &amp; IGI graded diamonds with verified dossier transparency.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">Insured Express Delivery</p>
                <p className="text-xs text-muted-foreground">
                  Fully insured courier shipping with signature verification.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">30-Day Complimentary Returns</p>
                <p className="text-xs text-muted-foreground">
                  Thoughtful exchanges, resizing guidance, and lifetime care.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo siteName={config.siteName} />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Heirloom-grade diamonds, 18K recycled gold, and platinum pieces crafted with
              documented provenance and enduring restraint.
            </p>
            <div className="mt-5 flex flex-col gap-1 text-sm text-muted-foreground">
              <a
                href={`mailto:${config.contactEmail}`}
                className="w-fit transition-colors hover:text-foreground"
              >
                {config.contactEmail}
              </a>
              {config.contactPhone && <span>{config.contactPhone}</span>}
            </div>
          </div>

          <div>
            <h2 className="mb-4 font-sans text-editorial-label text-foreground">Collections</h2>
            <ul className="grid gap-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/collections" className="hover:text-foreground">
                  All Jewellery
                </Link>
              </li>
              {config.categories.slice(0, 5).map((cat) => (
                <li key={cat.id}>
                  <Link href={`/collections/${cat.path}`} className="hover:text-foreground">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-sans text-editorial-label text-foreground">Client Care</h2>
            <ul className="grid gap-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/guides" className="hover:text-foreground">
                  Diamond &amp; Jewellery Guides
                </Link>
              </li>
              <li>
                <Link href="/ring-size-guide" className="hover:text-foreground">
                  Ring Size Guide
                </Link>
              </li>
              <li>
                <Link href="/care-guide" className="hover:text-foreground">
                  Jewellery Care Guide
                </Link>
              </li>
              <li>
                <Link href="/orders/track" className="hover:text-foreground">
                  Track Your Order
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  Private Concierge
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-sans text-editorial-label text-foreground">
              Maison &amp; Policies
            </h2>
            <ul className="grid gap-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-foreground">
                  About {config.siteName}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-foreground">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link href="/shipping-returns" className="hover:text-foreground">
                  Shipping &amp; Returns
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="gold-hairline w-full" aria-hidden="true" />

        <div className="flex flex-col items-start justify-between gap-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              &copy; <CopyrightYear /> {config.siteName}. All rights reserved.
            </span>
            {config.socialLinks && config.socialLinks.length > 0 && (
              <div className="flex items-center gap-3">
                {config.socialLinks.map((social) => (
                  <a
                    key={social.href}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-sm border border-border bg-card px-2 py-1 text-[11px] font-medium tracking-wider uppercase">
              Insured Checkout
            </span>
            <ThemeSwitcher />
          </div>
        </div>
      </Container>
    </footer>
  );
}
