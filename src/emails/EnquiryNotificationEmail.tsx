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
          ? `We received your message — ${siteName}`
          : `New ${enquiryType} inquiry from ${customerName}`
      }
      heading={isAck ? "Thanks, we received your message" : `New ${enquiryType} inquiry`}
      contactEmail={contactEmail}
    >
      {isAck ? (
        <>
          <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {customerName},</Text>
          <Text style={EMAIL_PARAGRAPH_STYLE}>
            Thank you for contacting us. One of our jewelry experts will reply within one business
            day.
          </Text>
          {productName && (
            <Text style={EMAIL_PARAGRAPH_STYLE}>
              <strong>Item:</strong> {productName}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={EMAIL_PARAGRAPH_STYLE}>
            <strong>Customer:</strong> {customerName} ({customerEmail})
          </Text>
          <Text style={EMAIL_PARAGRAPH_STYLE}>
            <strong>Type:</strong> {enquiryType}
            {productName ? ` — Item: ${productName}` : ""}
          </Text>
          <Text style={EMAIL_PARAGRAPH_STYLE}>{message}</Text>
        </>
      )}
    </EmailLayout>
  );
}
