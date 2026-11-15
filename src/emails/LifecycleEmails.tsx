import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/emails/EmailLayout";

/** Sent once, a few hours after a signed-in shopper leaves items in their cart. */
export function CartReminderEmail({
  siteName,
  recipientName,
  itemNames,
  cartUrl,
  contactEmail,
}: {
  siteName: string;
  recipientName: string;
  itemNames: string[];
  cartUrl: string;
  contactEmail?: string;
}) {
  const shown = itemNames.slice(0, 3);
  const more = itemNames.length - shown.length;
  return (
    <EmailLayout
      siteName={siteName}
      previewText="Your pieces are still waiting in your cart"
      heading="Still thinking it over?"
      contactEmail={contactEmail}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {recipientName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        You left {itemNames.length === 1 ? "a piece" : "a few pieces"} in your cart:
      </Text>
      {shown.map((name) => (
        <Text key={name} style={{ ...EMAIL_PARAGRAPH_STYLE, margin: "4px 0", fontWeight: 600 }}>
          • {name}
        </Text>
      ))}
      {more > 0 && <Text style={EMAIL_PARAGRAPH_STYLE}>and {more} more.</Text>}
      <Section style={{ margin: "24px 0" }}>
        <Button href={cartUrl} style={EMAIL_BUTTON_STYLE}>
          Return to your cart
        </Button>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Have a question about sizing, metal or the stone? Just reply to this email and our jewelers
        will help.
      </Text>
    </EmailLayout>
  );
}

/** Sent once, about a week after an order is marked delivered. */
export function FeedbackRequestEmail({
  siteName,
  recipientName,
  orderNumber,
  shopUrl,
  contactEmail,
}: {
  siteName: string;
  recipientName: string;
  orderNumber: string;
  shopUrl: string;
  contactEmail?: string;
}) {
  return (
    <EmailLayout
      siteName={siteName}
      previewText="How are you enjoying your new jewelry?"
      heading="How is your new piece?"
      contactEmail={contactEmail}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {recipientName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Your order {orderNumber} arrived about a week ago, and we hope you love it. We are a small
        team of jewelers, and your feedback helps other shoppers buy with confidence.
      </Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Simply reply to this email with a few words about your piece. A photo of it being worn is
        always welcome. If anything is not perfect, tell us and we will make it right.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={shopUrl} style={EMAIL_BUTTON_STYLE}>
          Visit {siteName}
        </Button>
      </Section>
    </EmailLayout>
  );
}
