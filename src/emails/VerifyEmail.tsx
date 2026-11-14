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
      heading="Confirm your email address"
      contactEmail={contactEmail}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {recipientName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Thank you for creating an account with {siteName}. Please confirm your email address so you
        can save favorites, track orders and manage your account.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={verifyUrl} style={EMAIL_BUTTON_STYLE}>
          Confirm email
        </Button>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        If you didn’t create an account, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
