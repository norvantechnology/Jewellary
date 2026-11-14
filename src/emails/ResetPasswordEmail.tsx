import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/emails/EmailLayout";

interface ResetPasswordEmailProps {
  siteName: string;
  recipientName: string;
  resetUrl: string;
  contactEmail?: string;
}

export function ResetPasswordEmail({
  siteName,
  recipientName,
  resetUrl,
  contactEmail,
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout
      siteName={siteName}
      previewText={`Reset your ${siteName} account password`}
      heading="Reset your password"
      contactEmail={contactEmail}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {recipientName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        We received a request to reset the password for your {siteName} account. Tap the button
        below to choose a new one.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={resetUrl} style={EMAIL_BUTTON_STYLE}>
          Reset password
        </Button>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        For your security, this link expires soon. If you didn’t ask to reset your password, you can
        ignore this email. Your account hasn’t changed.
      </Text>
    </EmailLayout>
  );
}
