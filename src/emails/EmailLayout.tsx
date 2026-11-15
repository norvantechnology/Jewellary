import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
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

const STYLES = {
  body: {
    backgroundColor: BRAND_PALETTE.light.bg,
    color: BRAND_PALETTE.light.text,
    fontFamily: "Georgia, 'Times New Roman', serif",
    margin: "0",
    padding: "32px 16px",
  },
  container: {
    backgroundColor: BRAND_PALETTE.light.surface,
    border: `1px solid ${BRAND_PALETTE.light.border}`,
    borderRadius: "4px",
    margin: "0 auto",
    maxWidth: "580px",
    padding: "40px 36px",
  },
  brandHeader: {
    fontSize: "13px",
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: BRAND_PALETTE.light.accentText,
    margin: "0 0 12px 0",
    fontFamily: "Helvetica, Arial, sans-serif",
  },
  heading: {
    fontSize: "26px",
    lineHeight: "1.25",
    fontWeight: "500",
    color: BRAND_PALETTE.light.text,
    margin: "0 0 20px 0",
  },
  hr: {
    borderColor: BRAND_PALETTE.light.border,
    margin: "28px 0 20px 0",
  },
  footer: {
    fontSize: "12px",
    lineHeight: "1.6",
    color: BRAND_PALETTE.light.textMuted,
    fontFamily: "Helvetica, Arial, sans-serif",
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
          <Section>
            <Text style={STYLES.brandHeader}>{siteName}</Text>
            <Heading style={STYLES.heading}>{heading}</Heading>
            {children}
          </Section>
          <Hr style={STYLES.hr} />
          <Section>
            <Text style={STYLES.footer}>
              {siteName} Customer Care &bull; Questions? Email us at{" "}
              <a href={`mailto:${contactEmail}`} style={{ color: BRAND_PALETTE.light.accentText }}>
                {contactEmail}
              </a>
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
  borderRadius: "4px",
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
