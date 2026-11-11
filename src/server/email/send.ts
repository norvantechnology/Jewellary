import "server-only";
import type * as React from "react";
import { render } from "@react-email/render";
import { EnquiryNotificationEmail } from "@/emails/EnquiryNotificationEmail";
import {
  OrderConfirmationEmail,
  type OrderConfirmationLine,
} from "@/emails/OrderConfirmationEmail";
import { OrderStatusEmail } from "@/emails/OrderStatusEmail";
import { ResetPasswordEmail } from "@/emails/ResetPasswordEmail";
import { VerifyEmail } from "@/emails/VerifyEmail";
import { env } from "@/lib/env";
import { dispatchEmail } from "@/server/email/client";
import { logger } from "@/server/logger";

async function sendTemplate(input: {
  to: string;
  subject: string;
  element: React.ReactElement;
  tag: string;
}) {
  const [html, text] = await Promise.all([
    render(input.element),
    render(input.element, { plainText: true }),
  ]);

  try {
    return await dispatchEmail({
      to: input.to,
      subject: input.subject,
      html,
      text,
      tag: input.tag,
    });
  } catch (error) {
    logger.error(
      {
        to: input.to,
        tag: input.tag,
        err: error instanceof Error ? error.message : String(error),
      },
      "Failed to send email template",
    );
    throw error;
  }
}

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  verifyUrl: string;
}) {
  return sendTemplate({
    to: input.to,
    subject: `Verify your ${env.NEXT_PUBLIC_SITE_NAME} account`,
    tag: "auth-verify",
    element: VerifyEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      recipientName: input.name,
      verifyUrl: input.verifyUrl,
      contactEmail: env.EMAIL_FROM,
    }),
  });
}

export async function sendResetPasswordEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  return sendTemplate({
    to: input.to,
    subject: `Reset your ${env.NEXT_PUBLIC_SITE_NAME} password`,
    tag: "auth-reset",
    element: ResetPasswordEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      recipientName: input.name,
      resetUrl: input.resetUrl,
      contactEmail: env.EMAIL_FROM,
    }),
  });
}

export async function sendOrderConfirmationEmail(input: {
  to: string;
  recipientName: string;
  orderNumber: string;
  lines: OrderConfirmationLine[];
  subtotalFormatted: string;
  shippingFormatted: string;
  taxFormatted: string;
  totalFormatted: string;
  trackingUrl: string;
  signatureRequired: boolean;
}) {
  return sendTemplate({
    to: input.to,
    subject: `Order ${input.orderNumber} Confirmed — ${env.NEXT_PUBLIC_SITE_NAME}`,
    tag: "order-confirmation",
    element: OrderConfirmationEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      recipientName: input.recipientName,
      orderNumber: input.orderNumber,
      lines: input.lines,
      subtotalFormatted: input.subtotalFormatted,
      shippingFormatted: input.shippingFormatted,
      taxFormatted: input.taxFormatted,
      totalFormatted: input.totalFormatted,
      trackingUrl: input.trackingUrl,
      signatureRequired: input.signatureRequired,
      contactEmail: env.EMAIL_FROM,
    }),
  });
}

export async function sendOrderStatusEmail(input: {
  to: string;
  recipientName: string;
  orderNumber: string;
  statusLabel: string;
  message: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  orderUrl: string;
}) {
  return sendTemplate({
    to: input.to,
    subject: `Order ${input.orderNumber}: ${input.statusLabel}`,
    tag: "order-status",
    element: OrderStatusEmail({
      siteName: env.NEXT_PUBLIC_SITE_NAME,
      recipientName: input.recipientName,
      orderNumber: input.orderNumber,
      statusLabel: input.statusLabel,
      message: input.message,
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      orderUrl: input.orderUrl,
      contactEmail: env.EMAIL_FROM,
    }),
  });
}

export async function sendEnquiryNotificationEmails(input: {
  customerName: string;
  customerEmail: string;
  enquiryType: string;
  productName?: string | null;
  message: string;
}) {
  await Promise.all([
    sendTemplate({
      to: input.customerEmail,
      subject: `We received your enquiry — ${env.NEXT_PUBLIC_SITE_NAME}`,
      tag: "enquiry-ack",
      element: EnquiryNotificationEmail({
        siteName: env.NEXT_PUBLIC_SITE_NAME,
        mode: "customer-ack",
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        enquiryType: input.enquiryType,
        productName: input.productName,
        message: input.message,
        contactEmail: env.EMAIL_FROM,
      }),
    }),
    sendTemplate({
      to: env.ADMIN_NOTIFY_EMAIL,
      subject: `[Enquiry] ${input.enquiryType} from ${input.customerName}`,
      tag: "enquiry-admin",
      element: EnquiryNotificationEmail({
        siteName: env.NEXT_PUBLIC_SITE_NAME,
        mode: "admin-alert",
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        enquiryType: input.enquiryType,
        productName: input.productName,
        message: input.message,
        contactEmail: env.EMAIL_FROM,
      }),
    }),
  ]);
}
