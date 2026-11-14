import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/emails/EmailLayout";

interface OrderStatusEmailProps {
  siteName: string;
  recipientName: string;
  orderNumber: string;
  statusLabel: string;
  message: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  orderUrl: string;
  contactEmail?: string;
}

export function OrderStatusEmail({
  siteName,
  recipientName,
  orderNumber,
  statusLabel,
  message,
  carrier,
  trackingNumber,
  orderUrl,
  contactEmail,
}: OrderStatusEmailProps) {
  return (
    <EmailLayout
      siteName={siteName}
      previewText={`Order ${orderNumber}: ${statusLabel}`}
      heading={`Order ${orderNumber}: ${statusLabel}`}
      contactEmail={contactEmail}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {recipientName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>{message}</Text>
      {(carrier || trackingNumber) && (
        <Text style={EMAIL_PARAGRAPH_STYLE}>
          <strong>Carrier:</strong> {carrier ?? "Standard shipping"} &bull;{" "}
          <strong>Tracking number:</strong> {trackingNumber ?? "Coming soon"}
        </Text>
      )}
      <Section style={{ margin: "24px 0" }}>
        <Button href={orderUrl} style={EMAIL_BUTTON_STYLE}>
          Track your order
        </Button>
      </Section>
    </EmailLayout>
  );
}
