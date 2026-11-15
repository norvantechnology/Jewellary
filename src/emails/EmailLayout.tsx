import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { BRAND_PALETTE } from "@/lib/brand-palette";

interface EmailLayoutProps {
  siteName: string;
  previewText: string;
  heading: string;
  children: React.ReactNode;
  contactEmail?: string;
}

const P = BRAND_PALETTE.light;
const SANS = "Helvetica, Arial, sans-serif";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://shinorajewels.com").replace(
  /\/$/,
  "",
);

const STYLES = {
  body: {
    backgroundColor: P.surface2,
    color: P.text,
    fontFamily: SANS,
    margin: "0",
    padding: "24px 12px",
  },
  container: {
    backgroundColor: P.surface,
    border: `1px solid ${P.border}`,
    borderRadius: "10px",
    margin: "0 auto",
    maxWidth: "600px",
    overflow: "hidden" as const,
  },
  header: {
    backgroundColor: P.primary,
    padding: "22px 32px",
    textAlign: "center" as const,
  },
  brand: {
    color: P.footerAccent,
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "20px",
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    textDecoration: "none",
    margin: "0",
  },
  goldRule: { height: "3px", backgroundColor: P.accent, lineHeight: "3px", fontSize: "1px" },
  content: { padding: "36px 32px 12px" },
  heading: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "26px",
    lineHeight: "1.3",
    fontWeight: "500",
    color: P.text,
    margin: "0 0 20px 0",
  },
  hr: { borderColor: P.border, margin: "24px 0 0 0" },
  footer: { padding: "20px 32px 28px", textAlign: "center" as const },
  footerLinks: { fontSize: "13px", fontFamily: SANS, margin: "0 0 10px 0" },
  footerLink: { color: P.accentText, textDecoration: "none", fontWeight: "600" },
  footerText: {
    fontSize: "12px",
    lineHeight: "1.6",
    color: P.textMuted,
    fontFamily: SANS,
    margin: "0",
  },
};

export function EmailLayout({
  siteName,
  previewText,
  heading,
  children,
  contactEmail = "info@shinorajewels.com",
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={STYLES.body}>
        <Container style={STYLES.container}>
          <Section style={STYLES.header}>
            <Link href={SITE_URL} style={STYLES.brand}>
              {siteName}
            </Link>
          </Section>
          <Section style={STYLES.goldRule}>&nbsp;</Section>
          <Section style={STYLES.content}>
            <Heading style={STYLES.heading}>{heading}</Heading>
            {children}
          </Section>
          <Hr style={STYLES.hr} />
          <Section style={STYLES.footer}>
            <Text style={STYLES.footerLinks}>
              <Link href={`${SITE_URL}/collections`} style={STYLES.footerLink}>
                Shop
              </Link>
              &nbsp;&nbsp;&middot;&nbsp;&nbsp;
              <Link href={`${SITE_URL}/account/orders`} style={STYLES.footerLink}>
                My orders
              </Link>
              &nbsp;&nbsp;&middot;&nbsp;&nbsp;
              <Link href={`${SITE_URL}/contact`} style={STYLES.footerLink}>
                Help
              </Link>
            </Text>
            <Text style={STYLES.footerText}>
              Questions? Reply to this email or write to{" "}
              <Link href={`mailto:${contactEmail}`} style={{ color: P.accentText }}>
                {contactEmail}
              </Link>
              .
            </Text>
            <Text style={{ ...STYLES.footerText, marginTop: "6px" }}>
              Handmade fine jewelry &middot; {siteName}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const EMAIL_BUTTON_STYLE = {
  backgroundColor: BRAND_PALETTE.light.primary,
  color: BRAND_PALETTE.light.onPrimary,
  borderRadius: "6px",
  fontSize: "13px",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  textDecoration: "none",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontWeight: "600",
  padding: "13px 26px",
  display: "inline-block",
};

export const EMAIL_PARAGRAPH_STYLE = {
  fontSize: "15px",
  lineHeight: "1.65",
  color: BRAND_PALETTE.light.text2,
  fontFamily: "Helvetica, Arial, sans-serif",
  margin: "0 0 16px 0",
};
