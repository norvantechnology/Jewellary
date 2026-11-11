import * as React from "react";
import { Text } from "@react-email/components";
import { EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/emails/EmailLayout";

interface EnquiryNotificationEmailProps {
  siteName: string;
  mode: "customer-ack" | "admin-alert";
  customerName: string;
  customerEmail: string;
  enquiryType: string;
  productName?: string | null;
  message: string;
  contactEmail?: string;
}

export function EnquiryNotificationEmail({
  siteName,
  mode,
  customerName,
  customerEmail,
  enquiryType,
  productName,
  message,
  contactEmail,
}: EnquiryNotificationEmailProps) {
  const isAck = mode === "customer-ack";

  return (
    <EmailLayout
      siteName={siteName}
      previewText={
        isAck
          ? `We received your enquiry — ${siteName}`
          : `New ${enquiryType} enquiry from ${customerName}`
      }
      heading={isAck ? "Private Concierge Received Your Note" : `New ${enquiryType} Enquiry`}
      contactEmail={contactEmail}
    >
      {isAck ? (
        <>
          <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {customerName},</Text>
          <Text style={EMAIL_PARAGRAPH_STYLE}>
            Thank you for reaching out to our gemology &amp; bespoke concierge. A specialist will
            respond to you within one business day.
          </Text>
          {productName && (
            <Text style={EMAIL_PARAGRAPH_STYLE}>
              <strong>Piece referenced:</strong> {productName}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={EMAIL_PARAGRAPH_STYLE}>
            <strong>Client:</strong> {customerName} ({customerEmail})
          </Text>
          <Text style={EMAIL_PARAGRAPH_STYLE}>
            <strong>Type:</strong> {enquiryType}
            {productName ? ` — Piece: ${productName}` : ""}
          </Text>
          <Text style={EMAIL_PARAGRAPH_STYLE}>{message}</Text>
        </>
      )}
    </EmailLayout>
  );
}
