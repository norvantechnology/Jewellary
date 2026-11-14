import * as React from "react";
import { Button, Hr, Section, Text } from "@react-email/components";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/emails/EmailLayout";
import { BRAND_PALETTE } from "@/lib/brand-palette";

export interface OrderConfirmationLine {
  title: string;
  variantTitle: string;
  quantity: number;
  lineTotalFormatted: string;
}

interface OrderConfirmationEmailProps {
  siteName: string;
  recipientName: string;
  orderNumber: string;
  lines: OrderConfirmationLine[];
  subtotalFormatted: string;
  shippingFormatted: string;
  taxFormatted: string;
  totalFormatted: string;
  trackingUrl: string;
  signatureRequired: boolean;
  contactEmail?: string;
}

export function OrderConfirmationEmail({
  siteName,
  recipientName,
  orderNumber,
  lines,
  subtotalFormatted,
  shippingFormatted,
  taxFormatted,
  totalFormatted,
  trackingUrl,
  signatureRequired,
  contactEmail,
}: OrderConfirmationEmailProps) {
  return (
    <EmailLayout
      siteName={siteName}
      previewText={`Order ${orderNumber} confirmed — ${siteName}`}
      heading={`Thank you! Order ${orderNumber} is confirmed`}
      contactEmail={contactEmail}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {recipientName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Thank you for your order with {siteName}. We’re now making your jewelry by hand. Making
        takes 7–10 business days, and we’ll email you when it ships.
      </Text>

      <Section
        style={{
          backgroundColor: BRAND_PALETTE.light.surface2,
          border: `1px solid ${BRAND_PALETTE.light.border}`,
          borderRadius: "4px",
          padding: "16px 20px",
          margin: "20px 0",
        }}
      >
        {lines.map((line, idx) => (
          <Text key={idx} style={{ ...EMAIL_PARAGRAPH_STYLE, margin: "0 0 8px 0" }}>
            <strong>{line.title}</strong> ({line.variantTitle}) &times; {line.quantity} &mdash;{" "}
            {line.lineTotalFormatted}
          </Text>
        ))}
        <Hr style={{ borderColor: BRAND_PALETTE.light.border, margin: "12px 0" }} />
        <Text style={{ ...EMAIL_PARAGRAPH_STYLE, margin: "0 0 4px 0", fontSize: "13px" }}>
          Subtotal: {subtotalFormatted} &bull; Shipping: {shippingFormatted} &bull; Tax:{" "}
          {taxFormatted}
        </Text>
        <Text style={{ ...EMAIL_PARAGRAPH_STYLE, margin: "4px 0 0 0", fontWeight: "700" }}>
          Total paid: {totalFormatted}
        </Text>
      </Section>

      {signatureRequired && (
        <Text style={EMAIL_PARAGRAPH_STYLE}>
          <strong>Signature required:</strong> An adult will need to sign for this package when it
          arrives.
        </Text>
      )}

      <Section style={{ margin: "24px 0" }}>
        <Button href={trackingUrl} style={EMAIL_BUTTON_STYLE}>
          View order status
        </Button>
      </Section>
    </EmailLayout>
  );
}
