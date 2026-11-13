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
      previewText={`Bespoke request ${props.requestNumber} received`}
      heading={`We have received request ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Thank you for commissioning a bespoke variation of <strong>{props.productName}</strong> with{" "}
        {props.siteName}. Our master gemologists and bench jewelers are reviewing your
        specifications and will return a formal quotation shortly.
      </Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        <strong>Indicative estimate:</strong> {props.indicativeRangeDisplay} (final atelier quote
        confirmed upon gemstone allocation)
      </Text>
      <SelectionsSummary selections={props.selections} />
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.requestUrl} style={EMAIL_BUTTON_STYLE}>
          View Customization Request
        </Button>
      </Section>
      <Text
        style={{ ...EMAIL_PARAGRAPH_STYLE, fontSize: "13px", color: BRAND_PALETTE.light.text2 }}
      >
        Have additional inspiration notes? You can also continue the conversation directly via{" "}
        <a
          href={props.chatUrl}
          style={{ color: BRAND_PALETTE.light.accentText, textDecoration: "underline" }}
        >
          Atelier Concierge Chat
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
      previewText={`New bespoke request ${props.requestNumber}`}
      heading={`New Customization Request ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        <strong>Customer:</strong> {props.customerName} ({props.customerEmail})
        <br />
        <strong>Piece:</strong> {props.productName}
        <br />
        <strong>Indicative Range (Base):</strong> {props.indicativeRangeBase}
      </Text>
      <SelectionsSummary selections={props.selections} />
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.adminUrl} style={EMAIL_BUTTON_STYLE}>
          Review Request in Admin
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
      previewText={`Your bespoke quote for ${props.requestNumber} is ready`}
      heading={`Atelier Quotation Ready — ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Our atelier has finalized specifications and stone sourcing for your bespoke{" "}
        <strong>{props.productName}</strong>.
      </Text>
      <Section style={CARD_STYLE}>
        <Text style={LABEL_STYLE}>Approved Quotation Price</Text>
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
        <Text style={LABEL_STYLE}>Quote Valid Until</Text>
        <Text style={VALUE_STYLE}>{props.expiresAtFormatted}</Text>
        {props.estimatedDeliveryDays ? (
          <>
            <Text style={LABEL_STYLE}>Estimated Bench Crafting</Text>
            <Text style={{ ...VALUE_STYLE, marginBottom: 0 }}>
              Approximately {props.estimatedDeliveryDays} days from confirmation
            </Text>
          </>
        ) : null}
      </Section>
      {props.adminMessage ? (
        <Text style={EMAIL_PARAGRAPH_STYLE}>
          <strong>Atelier Note:</strong> {props.adminMessage}
        </Text>
      ) : null}
      <SelectionsSummary selections={props.selections} />
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.acceptUrl} style={EMAIL_BUTTON_STYLE}>
          Review &amp; Complete Your Order
        </Button>
      </Section>
      <Hr style={{ borderColor: BRAND_PALETTE.light.border, margin: "16px 0" }} />
      <Text
        style={{ ...EMAIL_PARAGRAPH_STYLE, fontSize: "12px", color: BRAND_PALETTE.light.textMuted }}
      >
        This private quotation link is single-use and expires on {props.expiresAtFormatted}. Your
        approved configuration price is locked server-side upon confirmation.
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
      previewText={`Update on bespoke request ${props.requestNumber}`}
      heading={`Update Regarding Request ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Thank you for sharing your vision for <strong>{props.productName}</strong>. Unfortunately,
        our bench cannot fulfill this exact specification at present:
      </Text>
      <Section style={CARD_STYLE}>
        <Text style={{ ...EMAIL_PARAGRAPH_STYLE, margin: 0 }}>{props.reason}</Text>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        If you would like to explore alternative proportions, metals, or gemstone pairings with our
        senior concierge, we would be delighted to assist.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.chatUrl} style={EMAIL_BUTTON_STYLE}>
          Speak With an Atelier Specialist
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
      previewText={`Atelier question regarding ${props.requestNumber}`}
      heading={`Quick Question on Request ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Before finalizing your quotation for <strong>{props.productName}</strong>, our atelier
        concierge sent a message in your thread:
      </Text>
      <Section style={CARD_STYLE}>
        <Text style={{ ...EMAIL_PARAGRAPH_STYLE, margin: 0 }}>{props.question}</Text>
      </Section>
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.threadUrl} style={EMAIL_BUTTON_STYLE}>
          Reply in Atelier Chat
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
      previewText={`Quotation ${props.requestNumber} expires in 24 hours`}
      heading={`Quotation Expiring Soon — ${props.requestNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        A gentle reminder that your atelier quotation of <strong>{props.finalPriceDisplay}</strong>{" "}
        for your bespoke <strong>{props.productName}</strong> will expire on{" "}
        <strong>{props.expiresAtFormatted}</strong>.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.reviewUrl} style={EMAIL_BUTTON_STYLE}>
          Review &amp; Accept Quotation
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
      previewText={`Bespoke commission ${props.orderNumber} entered production`}
      heading={`Bespoke Commission Confirmed — ${props.orderNumber}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {props.customerName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Your order <strong>{props.orderNumber}</strong> for bespoke request{" "}
        <strong>{props.requestNumber}</strong> ({props.productName} ·{" "}
        <strong>{props.lockedPriceDisplay}</strong>) has been commissioned and placed with our bench
        team.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.orderUrl} style={EMAIL_BUTTON_STYLE}>
          Track Commission Progress
        </Button>
      </Section>
    </EmailLayout>
  );
}
