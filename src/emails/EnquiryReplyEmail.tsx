import * as React from "react";
import { Text } from "@react-email/components";
import { EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/emails/EmailLayout";

interface EnquiryReplyEmailProps {
  siteName: string;
  recipientName: string;
  enquiryType: string;
  replyMessage: string;
  productName?: string | null;
  contactEmail?: string;
}

export function EnquiryReplyEmail({
  siteName,
  recipientName,
  enquiryType,
  replyMessage,
  productName,
  contactEmail,
}: EnquiryReplyEmailProps) {
  return (
    <EmailLayout
      siteName={siteName}
      previewText={`Concierge response regarding your ${enquiryType.toLowerCase()} enquiry`}
      heading="Private Concierge Response"
      contactEmail={contactEmail}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {recipientName},</Text>
      {productName && (
        <Text style={EMAIL_PARAGRAPH_STYLE}>
          <strong>Piece referenced:</strong> {productName}
        </Text>
      )}
      {replyMessage
        .split(/\n{2,}/)
        .filter((part) => part.trim().length > 0)
        .map((paragraph, idx) => (
          <Text key={idx} style={EMAIL_PARAGRAPH_STYLE}>
            {paragraph}
          </Text>
        ))}
    </EmailLayout>
  );
}
