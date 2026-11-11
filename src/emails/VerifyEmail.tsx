import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/emails/EmailLayout";

interface VerifyEmailProps {
  siteName: string;
  recipientName: string;
  verifyUrl: string;
  contactEmail?: string;
}

export function VerifyEmail({
  siteName,
  recipientName,
  verifyUrl,
  contactEmail,
}: VerifyEmailProps) {
  return (
    <EmailLayout
      siteName={siteName}
      previewText={`Confirm your ${siteName} account email address`}
      heading="Verify Your Email Address"
      contactEmail={contactEmail}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {recipientName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Thank you for creating an account with {siteName}. Please confirm your email address so you
        can manage your wishlist, saved jewellery dossiers, and insured deliveries.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={verifyUrl} style={EMAIL_BUTTON_STYLE}>
          Verify Email
        </Button>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        If you did not request an account, you may safely ignore this message.
      </Text>
    </EmailLayout>
  );
}
