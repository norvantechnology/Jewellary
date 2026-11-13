import "server-only";
import { render } from "@react-email/render";
import { ChatOfflineReplyEmail } from "@/emails/ChatOfflineReplyEmail";
import {
  CustomizationMoreInfoEmail,
  CustomizationOrderPlacedEmail,
  CustomizationQuoteApprovedEmail,
  CustomizationQuoteExpiringEmail,
  CustomizationRejectedEmail,
  CustomizationSubmittedAdminEmail,
  CustomizationSubmittedCustomerEmail,
  type EmailSelectionLine,
} from "@/emails/CustomizationEmails";
import { env } from "@/lib/env";
import { dispatchEmail } from "@/server/email/client";
import { logger } from "@/server/logger";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function fallbackTextFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function dispatchEmailWithRetry(
  input: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    tag: string;
  },
  maxAttempts = 3,
): Promise<boolean> {
  const backoffBaseMs = process.env.NODE_ENV === "test" ? 0 : 250;
  const payload = {
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text ?? fallbackTextFromHtml(input.html),
    tag: input.tag,
  };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await dispatchEmail(payload);
      return true;
    } catch (err) {
      logger.warn(
        {
          tag: input.tag,
          attempt,
          maxAttempts,
          error: err instanceof Error ? err.message : String(err),
        },
        "Email dispatch attempt failed",
      );
      if (attempt < maxAttempts && backoffBaseMs > 0) {
        await sleep(backoffBaseMs * attempt);
      }
    }
  }
  return false;
}

function formatSelectionsPlainText(selections: EmailSelectionLine[]): string {
  if (selections.length === 0) return "";
  return selections.map((s) => `- ${s.label}: ${s.value}`).join("\n");
}

export async function sendCustomizationSubmittedEmails(input: {
  requestId: string;
  requestNumber: string;
  productName: string;
  customerName: string;
  customerEmail: string;
  indicativeRangeDisplay: string;
  indicativeRangeBase: string;
  selections: EmailSelectionLine[];
}): Promise<void> {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const requestUrl = `${siteUrl}/account/customizations/${encodeURIComponent(input.requestId)}`;
  const chatUrl = `${siteUrl}/account/customizations/${encodeURIComponent(input.requestId)}#chat`;
  const adminUrl = `${siteUrl}/admin/customizations/${encodeURIComponent(input.requestId)}`;

  const customerHtml = await render(
    CustomizationSubmittedCustomerEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      contactEmail: env.EMAIL_FROM,
      customerName: input.customerName,
      requestNumber: input.requestNumber,
      productName: input.productName,
      indicativeRangeDisplay: input.indicativeRangeDisplay,
      selections: input.selections,
      requestUrl,
      chatUrl,
    }),
  );

  const customerText = [
    `Dear ${input.customerName},`,
    `We have received bespoke request ${input.requestNumber} for ${input.productName}.`,
    `Indicative estimate: ${input.indicativeRangeDisplay}`,
    formatSelectionsPlainText(input.selections),
    `View request: ${requestUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const adminHtml = await render(
    CustomizationSubmittedAdminEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      requestNumber: input.requestNumber,
      productName: input.productName,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      indicativeRangeBase: input.indicativeRangeBase,
      selections: input.selections,
      adminUrl,
    }),
  );

  const adminText = [
    `New Customization Request ${input.requestNumber}`,
    `Customer: ${input.customerName} (${input.customerEmail})`,
    `Product: ${input.productName}`,
    `Indicative Base Range: ${input.indicativeRangeBase}`,
    formatSelectionsPlainText(input.selections),
    `Review in admin: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  await Promise.all([
    dispatchEmailWithRetry({
      to: input.customerEmail,
      subject: `Customization Request ${input.requestNumber} Received — ${env.NEXT_PUBLIC_SITE_NAME}`,
      html: customerHtml,
      text: customerText,
      tag: "customization-submitted-customer",
    }),
    dispatchEmailWithRetry({
      to: env.ADMIN_NOTIFY_EMAIL,
      subject: `[Bespoke Request] ${input.requestNumber} — ${input.productName}`,
      html: adminHtml,
      text: adminText,
      tag: "customization-submitted-admin",
    }),
  ]);
}

export async function sendCustomizationQuoteEmail(input: {
  customerEmail: string;
  customerName: string;
  requestNumber: string;
  productName: string;
  finalPriceDisplay: string;
  basePriceNote?: string | null;
  expiresAtFormatted: string;
  estimatedDeliveryDays?: number | null;
  adminMessage?: string | null;
  selections: EmailSelectionLine[];
  rawAcceptToken: string;
}): Promise<boolean> {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const acceptUrl = `${siteUrl}/customize/accept/${encodeURIComponent(input.rawAcceptToken)}`;

  const html = await render(
    CustomizationQuoteApprovedEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      contactEmail: env.EMAIL_FROM,
      customerName: input.customerName,
      requestNumber: input.requestNumber,
      productName: input.productName,
      finalPriceDisplay: input.finalPriceDisplay,
      basePriceNote: input.basePriceNote,
      expiresAtFormatted: input.expiresAtFormatted,
      estimatedDeliveryDays: input.estimatedDeliveryDays,
      adminMessage: input.adminMessage,
      selections: input.selections,
      acceptUrl,
    }),
  );

  const text = [
    `Dear ${input.customerName},`,
    `Your bespoke quotation for ${input.requestNumber} (${input.productName}) is ready.`,
    `Final Quotation Price: ${input.finalPriceDisplay}${input.basePriceNote ? ` (${input.basePriceNote})` : ""}`,
    `Valid Until: ${input.expiresAtFormatted}`,
    input.estimatedDeliveryDays
      ? `Estimated Bench Lead Time: ${input.estimatedDeliveryDays} days`
      : null,
    input.adminMessage ? `Atelier Note: ${input.adminMessage}` : null,
    formatSelectionsPlainText(input.selections),
    `Review & Complete Your Order: ${acceptUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return dispatchEmailWithRetry({
    to: input.customerEmail,
    subject: `Your Bespoke Quote ${input.requestNumber} Is Ready — ${env.NEXT_PUBLIC_SITE_NAME}`,
    html,
    text,
    tag: "customization-quote-approved",
  });
}

export async function sendCustomizationRejectedEmail(input: {
  requestId: string;
  customerEmail: string;
  customerName: string;
  requestNumber: string;
  productName: string;
  reason: string;
}): Promise<boolean> {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const chatUrl = `${siteUrl}/account/customizations/${encodeURIComponent(input.requestId)}#chat`;

  const html = await render(
    CustomizationRejectedEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      contactEmail: env.EMAIL_FROM,
      customerName: input.customerName,
      requestNumber: input.requestNumber,
      productName: input.productName,
      reason: input.reason,
      chatUrl,
    }),
  );

  const text = [
    `Dear ${input.customerName},`,
    `Regarding bespoke request ${input.requestNumber} (${input.productName}):`,
    input.reason,
    `Continue discussing alternatives: ${chatUrl}`,
  ].join("\n\n");

  return dispatchEmailWithRetry({
    to: input.customerEmail,
    subject: `Update on Bespoke Request ${input.requestNumber} — ${env.NEXT_PUBLIC_SITE_NAME}`,
    html,
    text,
    tag: "customization-rejected",
  });
}

export async function sendCustomizationMoreInfoEmail(input: {
  requestId: string;
  customerEmail: string;
  customerName: string;
  requestNumber: string;
  productName: string;
  question: string;
}): Promise<boolean> {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const threadUrl = `${siteUrl}/account/customizations/${encodeURIComponent(input.requestId)}#chat`;

  const html = await render(
    CustomizationMoreInfoEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      contactEmail: env.EMAIL_FROM,
      customerName: input.customerName,
      requestNumber: input.requestNumber,
      productName: input.productName,
      question: input.question,
      threadUrl,
    }),
  );

  const text = [
    `Dear ${input.customerName},`,
    `Our atelier has a question about customization request ${input.requestNumber} (${input.productName}):`,
    input.question,
    `Reply in chat: ${threadUrl}`,
  ].join("\n\n");

  return dispatchEmailWithRetry({
    to: input.customerEmail,
    subject: `Additional Details Needed for ${input.requestNumber} — ${env.NEXT_PUBLIC_SITE_NAME}`,
    html,
    text,
    tag: "customization-more-info",
  });
}

export async function sendCustomizationQuoteExpiringEmail(input: {
  requestId: string;
  customerEmail: string;
  customerName: string;
  requestNumber: string;
  productName: string;
  finalPriceDisplay: string;
  expiresAtFormatted: string;
}): Promise<boolean> {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const reviewUrl = `${siteUrl}/account/customizations/${encodeURIComponent(input.requestId)}`;

  const html = await render(
    CustomizationQuoteExpiringEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      contactEmail: env.EMAIL_FROM,
      customerName: input.customerName,
      requestNumber: input.requestNumber,
      productName: input.productName,
      finalPriceDisplay: input.finalPriceDisplay,
      expiresAtFormatted: input.expiresAtFormatted,
      reviewUrl,
    }),
  );

  const text = [
    `Dear ${input.customerName},`,
    `Your quotation of ${input.finalPriceDisplay} for bespoke request ${input.requestNumber} (${input.productName}) expires on ${input.expiresAtFormatted}.`,
    `Review & accept: ${reviewUrl}`,
  ].join("\n\n");

  return dispatchEmailWithRetry({
    to: input.customerEmail,
    subject: `24-Hour Reminder: Quotation ${input.requestNumber} — ${env.NEXT_PUBLIC_SITE_NAME}`,
    html,
    text,
    tag: "customization-quote-expiring",
  });
}

export async function sendCustomizationOrderPlacedEmail(input: {
  customerEmail: string;
  customerName: string;
  requestNumber: string;
  orderNumber: string;
  productName: string;
  lockedPriceDisplay: string;
}): Promise<boolean> {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const orderUrl = `${siteUrl}/orders/${encodeURIComponent(input.orderNumber)}`;

  const html = await render(
    CustomizationOrderPlacedEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      contactEmail: env.EMAIL_FROM,
      customerName: input.customerName,
      requestNumber: input.requestNumber,
      orderNumber: input.orderNumber,
      productName: input.productName,
      lockedPriceDisplay: input.lockedPriceDisplay,
      orderUrl,
    }),
  );

  const text = [
    `Dear ${input.customerName},`,
    `Order ${input.orderNumber} for customization request ${input.requestNumber} (${input.productName}) at locked price ${input.lockedPriceDisplay} is confirmed.`,
    `Track your commission: ${orderUrl}`,
  ].join("\n\n");

  return dispatchEmailWithRetry({
    to: input.customerEmail,
    subject: `Bespoke Commission Confirmed (${input.orderNumber}) — ${env.NEXT_PUBLIC_SITE_NAME}`,
    html,
    text,
    tag: "customization-order-placed",
  });
}

export async function sendChatOfflineReplyEmail(input: {
  recipientEmail: string;
  recipientName: string;
  conversationId: string;
  subjectLabel: string;
  messagePreview: string;
}): Promise<boolean> {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const conversationUrl = `${siteUrl}/account?chat=${encodeURIComponent(input.conversationId)}`;

  const html = await render(
    ChatOfflineReplyEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      contactEmail: env.EMAIL_FROM,
      recipientName: input.recipientName,
      subjectLabel: input.subjectLabel,
      messagePreview: input.messagePreview,
      conversationUrl,
    }),
  );

  const text = [
    `Dear ${input.recipientName},`,
    `New reply from ${env.NEXT_PUBLIC_SITE_NAME} Atelier Concierge (${input.subjectLabel}):`,
    input.messagePreview,
    `Open conversation: ${conversationUrl}`,
  ].join("\n\n");

  return dispatchEmailWithRetry({
    to: input.recipientEmail,
    subject: `New Message From ${env.NEXT_PUBLIC_SITE_NAME} Concierge`,
    html,
    text,
    tag: "chat-offline-reply",
  });
}
