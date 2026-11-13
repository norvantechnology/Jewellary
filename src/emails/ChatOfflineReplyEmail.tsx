import { Button, Section, Text } from "@react-email/components";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/emails/EmailLayout";
import { BRAND_PALETTE } from "@/lib/brand-palette";

export function ChatOfflineReplyEmail(props: {
  siteName: string;
  contactEmail?: string;
  recipientName: string;
  subjectLabel: string;
  messagePreview: string;
  conversationUrl: string;
}) {
  return (
    <EmailLayout
      siteName={props.siteName}
      contactEmail={props.contactEmail}
      previewText={`New reply from ${props.siteName} Atelier Concierge`}
      heading="New Message From Our Atelier Concierge"
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>Dear {props.recipientName},</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        Our concierge responded to your conversation ({props.subjectLabel}):
      </Text>
      <Section
        style={{
          border: `1px solid ${BRAND_PALETTE.light.border}`,
          borderRadius: "8px",
          padding: "16px",
          backgroundColor: BRAND_PALETTE.light.surface2,
          margin: "16px 0",
        }}
      >
        <Text style={{ ...EMAIL_PARAGRAPH_STYLE, margin: 0 }}>{props.messagePreview}</Text>
      </Section>
      <Section style={{ margin: "24px 0" }}>
        <Button href={props.conversationUrl} style={EMAIL_BUTTON_STYLE}>
          Open Conversation
        </Button>
      </Section>
    </EmailLayout>
  );
}
