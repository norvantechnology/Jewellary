import * as React from "react";
import { Button, Link, Section, Text } from "@react-email/components";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/emails/EmailLayout";
import { BRAND_PALETTE } from "@/lib/brand-palette";

interface NewsletterConfirmEmailProps {
  siteName: string;
  confirmUrl: string;
  unsubscribeUrl: string;
  contactEmail?: string;
}

export function NewsletterConfirmEmail({
  siteName,
  confirmUrl,
  unsubscribeUrl,
  contactEmail,
}: NewsletterConfirmEmailProps) {
  return (
    <EmailLayout
      siteName={siteName}
      previewText={`Confirm your subscription to ${siteName} private previews`}
      heading="Confirm Your Subscription"
      contactEmail={contactEmail}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Thank you for requesting private collection dispatches and gemological notes from {siteName}
        .
      </Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        To complete your subscription and confirm consent to receive occasional previews, please
        click the confirmation button below within 48 hours.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={confirmUrl} style={EMAIL_BUTTON_STYLE}>
          Confirm Subscription
        </Button>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        If you did not request this email, you can ignore it or{" "}
        <Link
          href={unsubscribeUrl}
          style={{ color: BRAND_PALETTE.light.accentText, textDecoration: "underline" }}
        >
          unsubscribe immediately
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}
