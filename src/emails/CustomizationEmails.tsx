import { Button, Hr, Section, Text } from "@react-email/components";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/emails/EmailLayout";
import { BRAND_PALETTE } from "@/lib/brand-palette";

export interface EmailSelectionLine {
  label: string;
  value: string;
}

const CARD_STYLE = {
  border: `1px solid ${BRAND_PALETTE.light.border}`,
  borderRadius: "8px",
  padding: "16px",
  backgroundColor: BRAND_PALETTE.light.surface2,
  margin: "16px 0",
};

const LABEL_STYLE = {
  fontSize: "12px",
  color: BRAND_PALETTE.light.textMuted,
  margin: "0 0 2px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const VALUE_STYLE = {
  fontSize: "14px",
  color: BRAND_PALETTE.light.text,
  margin: "0 0 10px",
  fontWeight: "600" as const,
};

function SelectionsSummary({ selections }: { selections: EmailSelectionLine[] }) {
  if (selections.length === 0) return null;
  return (
    <Section style={CARD_STYLE}>
      {selections.map((line) => (
        <div key={line.label}>
          <Text style={LABEL_STYLE}>{line.label}</Text>
          <Text style={VALUE_STYLE}>{line.value}</Text>
        </div>
      ))}
    </Section>
  );
}

export function CustomizationSubmittedCustomerEmail(props: {
  siteName: string;
  contactEmail?: string;
  customerName: string;
  requestNumber: string;
  productName: string;
  indicativeRangeDisplay: string;
  selections: EmailSelectionLine[];
  requestUrl: string;
  chatUrl: string;
}) {
  return (
    <EmailLayout
      siteName={props.siteName}
      contactEmail={props.contactEmail}
      previewText={`We received your custom request ${props.requestNumber}`}
      heading={`We received your custom request ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Thank you for your custom design request for <strong>{props.productName}</strong> with{" "}
        {props.siteName}. Our jewelers are reviewing your choices and will send you a price quote
        soon.
      </Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        <strong>Indicative estimate:</strong> {props.indicativeRangeDisplay} (your final price is
        confirmed once we select your stones)
      </Text>
      <SelectionsSummary selections={props.selections} />
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.requestUrl} style={EMAIL_BUTTON_STYLE}>
          View your request
        </Button>
      </Section>
      <Text
        style={{ ...EMAIL_PARAGRAPH_STYLE, fontSize: "13px", color: BRAND_PALETTE.light.text2 }}
      >
        Have more ideas or photos to share? You can also message us in{" "}
        <a
          href={props.chatUrl}
          style={{ color: BRAND_PALETTE.light.accentText, textDecoration: "underline" }}
        >
          live chat
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export function CustomizationSubmittedAdminEmail(props: {
  siteName: string;
  requestNumber: string;
  productName: string;
  customerName: string;
  customerEmail: string;
  indicativeRangeBase: string;
  selections: EmailSelectionLine[];
  adminUrl: string;
}) {
  return (
    <EmailLayout
      siteName={props.siteName}
      previewText={`New custom request ${props.requestNumber}`}
      heading={`New custom request ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        <strong>Customer:</strong> {props.customerName} ({props.customerEmail})
        <br />
        <strong>Piece:</strong> {props.productName}
        <br />
        <strong>Estimated range (base currency):</strong> {props.indicativeRangeBase}
      </Text>
      <SelectionsSummary selections={props.selections} />
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.adminUrl} style={EMAIL_BUTTON_STYLE}>
          Review request in admin
        </Button>
      </Section>
    </EmailLayout>
  );
}

export function CustomizationQuoteApprovedEmail(props: {
  siteName: string;
  contactEmail?: string;
  customerName: string;
  requestNumber: string;
  productName: string;
  finalPriceDisplay: string;
  basePriceNote?: string | null;
  expiresAtFormatted: string;
  estimatedDeliveryDays?: number | null;
  adminMessage?: string | null;
  selections: EmailSelectionLine[];
  acceptUrl: string;
}) {
  return (
    <EmailLayout
      siteName={props.siteName}
      contactEmail={props.contactEmail}
      previewText={`Your custom design quote ${props.requestNumber} is ready`}
      heading={`Your quote is ready — ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Our jewelers have finalized the details and stones for your custom{" "}
        <strong>{props.productName}</strong>.
      </Text>
      <Section style={CARD_STYLE}>
        <Text style={LABEL_STYLE}>Your price</Text>
        <Text style={{ ...VALUE_STYLE, fontSize: "20px", marginBottom: "6px" }}>
          {props.finalPriceDisplay}
        </Text>
        {props.basePriceNote ? (
          <Text
            style={{
              ...EMAIL_PARAGRAPH_STYLE,
              fontSize: "12px",
              color: BRAND_PALETTE.light.text2,
              margin: "0 0 8px",
            }}
          >
            {props.basePriceNote}
          </Text>
        ) : null}
        <Text style={LABEL_STYLE}>Quote valid until</Text>
        <Text style={VALUE_STYLE}>{props.expiresAtFormatted}</Text>
        {props.estimatedDeliveryDays ? (
          <>
            <Text style={LABEL_STYLE}>Estimated time to make</Text>
            <Text style={{ ...VALUE_STYLE, marginBottom: 0 }}>
              Approximately {props.estimatedDeliveryDays} days from confirmation
            </Text>
          </>
        ) : null}
      </Section>
      {props.adminMessage ? (
        <Text style={EMAIL_PARAGRAPH_STYLE}>
          <strong>Note from our jewelers:</strong> {props.adminMessage}
        </Text>
      ) : null}
      <SelectionsSummary selections={props.selections} />
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.acceptUrl} style={EMAIL_BUTTON_STYLE}>
          Review and place your order
        </Button>
      </Section>
      <Hr style={{ borderColor: BRAND_PALETTE.light.border, margin: "16px 0" }} />
      <Text
        style={{ ...EMAIL_PARAGRAPH_STYLE, fontSize: "12px", color: BRAND_PALETTE.light.textMuted }}
      >
        This quote link is just for you, can be used once and expires on {props.expiresAtFormatted}.
        Your price is locked in when you confirm.
      </Text>
    </EmailLayout>
  );
}

export function CustomizationRejectedEmail(props: {
  siteName: string;
  contactEmail?: string;
  customerName: string;
  requestNumber: string;
  productName: string;
  reason: string;
  chatUrl: string;
}) {
  return (
    <EmailLayout
      siteName={props.siteName}
      contactEmail={props.contactEmail}
      previewText={`Update on your custom request ${props.requestNumber}`}
      heading={`Update on your request ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Thank you for sharing your ideas for <strong>{props.productName}</strong>. Unfortunately, we
        can’t make this exact design right now:
      </Text>
      <Section style={CARD_STYLE}>
        <Text style={{ ...EMAIL_PARAGRAPH_STYLE, margin: 0 }}>{props.reason}</Text>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        If you’d like to try a different size, metal or stone, our jewelers would be happy to help
        you find an option that works.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.chatUrl} style={EMAIL_BUTTON_STYLE}>
          Talk to a jeweler
        </Button>
      </Section>
    </EmailLayout>
  );
}

export function CustomizationMoreInfoEmail(props: {
  siteName: string;
  contactEmail?: string;
  customerName: string;
  requestNumber: string;
  productName: string;
  question: string;
  threadUrl: string;
}) {
  return (
    <EmailLayout
      siteName={props.siteName}
      contactEmail={props.contactEmail}
      previewText={`A quick question about your request ${props.requestNumber}`}
      heading={`A quick question about request ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Before we finish your quote for <strong>{props.productName}</strong>, our team has a
        question for you:
      </Text>
      <Section style={CARD_STYLE}>
        <Text style={{ ...EMAIL_PARAGRAPH_STYLE, margin: 0 }}>{props.question}</Text>
      </Section>
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.threadUrl} style={EMAIL_BUTTON_STYLE}>
          Reply in chat
        </Button>
      </Section>
    </EmailLayout>
  );
}

export function CustomizationQuoteExpiringEmail(props: {
  siteName: string;
  contactEmail?: string;
  customerName: string;
  requestNumber: string;
  productName: string;
  finalPriceDisplay: string;
  expiresAtFormatted: string;
  reviewUrl: string;
}) {
  return (
    <EmailLayout
      siteName={props.siteName}
      contactEmail={props.contactEmail}
      previewText={`Your quote ${props.requestNumber} expires in 24 hours`}
      heading={`Your quote expires soon — ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Just a reminder: your quote of <strong>{props.finalPriceDisplay}</strong> for your custom{" "}
        <strong>{props.productName}</strong> expires on <strong>{props.expiresAtFormatted}</strong>.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.reviewUrl} style={EMAIL_BUTTON_STYLE}>
          Review and accept quote
        </Button>
      </Section>
    </EmailLayout>
  );
}

export function CustomizationOrderPlacedEmail(props: {
  siteName: string;
  contactEmail?: string;
  customerName: string;
  requestNumber: string;
  orderNumber: string;
  productName: string;
  lockedPriceDisplay: string;
  orderUrl: string;
}) {
  return (
    <EmailLayout
      siteName={props.siteName}
      contactEmail={props.contactEmail}
      previewText={`Your custom order ${props.orderNumber} is now being made`}
      heading={`Custom order confirmed — ${props.orderNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Hi {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Your order <strong>{props.orderNumber}</strong> for custom request{" "}
        <strong>{props.requestNumber}</strong> ({props.productName} ·{" "}
        <strong>{props.lockedPriceDisplay}</strong>) is confirmed. Our jewelers have started making
        your piece.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.orderUrl} style={EMAIL_BUTTON_STYLE}>
          Track your order
        </Button>
      </Section>
    </EmailLayout>
  );
}
