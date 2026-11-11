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
      heading="Password Reset Request"
      contactEmail={contactEmail}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {recipientName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        We received a request to reset the password for your {siteName} account. Select the button
        below to choose a new password.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={resetUrl} style={EMAIL_BUTTON_STYLE}>
          Reset Password
        </Button>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        This link expires shortly for your security. If you did not ask to reset your password, no
        changes have been made to your account.
      </Text>
    </EmailLayout>
  );
}
