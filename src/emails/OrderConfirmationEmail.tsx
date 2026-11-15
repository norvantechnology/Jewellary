import * as React from "react";
import { Button, Column, Hr, Row, Section, Text } from "@react-email/components";
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

const CELL = {
  fontSize: "15px",
  lineHeight: "1.5",
  color: BRAND_PALETTE.light.text,
  fontFamily: "Helvetica, Arial, sans-serif",
  margin: "0",
};
const LABEL = {
  fontSize: "12px",
  fontWeight: "700",
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: BRAND_PALETTE.light.textMuted,
  margin: "8px 0 8px 0",
};

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

      <Text style={{ ...EMAIL_PARAGRAPH_STYLE, ...LABEL }}>Order summary</Text>
      <Section
        style={{
          border: `1px solid ${BRAND_PALETTE.light.border}`,
          borderRadius: "8px",
          padding: "4px 18px",
          margin: "0 0 20px 0",
        }}
      >
        {lines.map((line, idx) => (
          <Row
            key={idx}
            style={{
              borderBottom:
                idx < lines.length - 1 ? `1px solid ${BRAND_PALETTE.light.border}` : "none",
            }}
          >
            <Column style={{ padding: "14px 0", verticalAlign: "top" }}>
              <Text style={{ ...CELL, fontWeight: "600", color: BRAND_PALETTE.light.text }}>
                {line.title}
              </Text>
              <Text style={{ ...CELL, fontSize: "13px", color: BRAND_PALETTE.light.textMuted }}>
                {line.variantTitle} &middot; Qty {line.quantity}
              </Text>
            </Column>
            <Column
              style={{ padding: "14px 0 14px 12px", verticalAlign: "top", textAlign: "right" }}
            >
              <Text style={{ ...CELL, fontWeight: "600", whiteSpace: "nowrap" }}>
                {line.lineTotalFormatted}
              </Text>
            </Column>
          </Row>
        ))}
      </Section>

      <Section
        style={{
          backgroundColor: BRAND_PALETTE.light.surface2,
          borderRadius: "8px",
          padding: "14px 18px",
          margin: "0 0 20px 0",
        }}
      >
        {[
          ["Subtotal", subtotalFormatted],
          ["Shipping", shippingFormatted],
          ["Tax", taxFormatted],
        ].map(([label, value]) => (
          <Row key={label}>
            <Column style={{ padding: "3px 0" }}>
              <Text style={{ ...CELL, color: BRAND_PALETTE.light.textMuted }}>{label}</Text>
            </Column>
            <Column style={{ padding: "3px 0", textAlign: "right" }}>
              <Text style={CELL}>{value}</Text>
            </Column>
          </Row>
        ))}
        <Hr style={{ borderColor: BRAND_PALETTE.light.borderStrong, margin: "10px 0" }} />
        <Row>
          <Column>
            <Text style={{ ...CELL, fontSize: "16px", fontWeight: "700" }}>Total paid</Text>
          </Column>
          <Column style={{ textAlign: "right" }}>
            <Text style={{ ...CELL, fontSize: "16px", fontWeight: "700" }}>{totalFormatted}</Text>
          </Column>
        </Row>
      </Section>

      {signatureRequired && (
        <Text style={EMAIL_PARAGRAPH_STYLE}>
          <strong>Signature required:</strong> An adult will need to sign for this package when it
          arrives.
        </Text>
      )}

      <Section style={{ margin: "24px 0" }}>
        <Button href={trackingUrl} style={EMAIL_BUTTON_STYLE}>
          Track your order
        </Button>
      </Section>
    </EmailLayout>
  );
}
