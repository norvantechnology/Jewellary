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
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {recipientName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>{message}</Text>
      {(carrier || trackingNumber) && (
        <Text style={EMAIL_PARAGRAPH_STYLE}>
          <strong>Courier:</strong> {carrier ?? "Insured Express"} &bull;{" "}
          <strong>Tracking Number:</strong> {trackingNumber ?? "Pending assignment"}
        </Text>
      )}
      <Section style={{ margin: "24px 0" }}>
        <Button href={orderUrl} style={EMAIL_BUTTON_STYLE}>
          Track Order
        </Button>
      </Section>
    </EmailLayout>
  );
}
