import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { logger } from "@/server/logger";

export interface OutboxRecord {
  to: string;
  subject: string;
  html: string;
  text: string;
  tag?: string;
  sentAt: string;
}

const globalForOutbox = globalThis as unknown as {
  devEmailOutbox?: OutboxRecord[];
};

const outbox = (globalForOutbox.devEmailOutbox ??= []);

export function getEmailOutbox(): OutboxRecord[] {
  return [...outbox];
}

export function clearEmailOutbox(): void {
  outbox.length = 0;
}

let cachedResend: Resend | null = null;
function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!cachedResend) {
    cachedResend = new Resend(env.RESEND_API_KEY);
  }
  return cachedResend;
}

let cachedTransporter: nodemailer.Transporter | null = null;
function getSmtpTransporter(): nodemailer.Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
    });
  }
  return cachedTransporter;
}

export async function dispatchEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  tag?: string;
}): Promise<{ deliveredVia: "resend" | "smtp" | "memory" }> {
  const fromAddress = `${env.NEXT_PUBLIC_SITE_NAME} <${env.EMAIL_FROM}>`;

  if (env.NODE_ENV === "test") {
    outbox.push({
      ...input,
      sentAt: new Date().toISOString(),
    });
    if (outbox.length > 50) outbox.shift();
    return { deliveredVia: "memory" };
  }

  const resend = getResendClient();
  if (resend) {
    const result = await resend.emails.send({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: input.tag ? [{ name: "category", value: input.tag }] : undefined,
    });
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
    return { deliveredVia: "resend" };
  }

  const smtp = getSmtpTransporter();
  if (smtp) {
    try {
      await smtp.sendMail({
        from: fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { deliveredVia: "smtp" };
    } catch (error) {
      if (env.NODE_ENV === "production") {
        throw error;
      }
      logger.warn(
        {
          to: input.to,
          subject: input.subject,
          err: error instanceof Error ? error.message : error,
        },
        "SMTP transport unreachable in development; email recorded in dev outbox",
      );
      outbox.push({
        ...input,
        sentAt: new Date().toISOString(),
      });
      if (outbox.length > 50) outbox.shift();
      return { deliveredVia: "memory" };
    }
  }

  outbox.push({
    ...input,
    sentAt: new Date().toISOString(),
  });
  if (outbox.length > 50) outbox.shift();
  logger.info({ to: input.to, subject: input.subject }, "Email recorded in memory outbox");
  return { deliveredVia: "memory" };
}
