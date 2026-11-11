import "server-only";
import pino from "pino";

const REDACT_PATHS = [
  "email",
  "*.email",
  "customerEmail",
  "phone",
  "*.phone",
  "password",
  "*.password",
  "token",
  "*.token",
  "authorization",
  "headers.authorization",
  "headers.cookie",
  "shippingAddress",
  "billingAddress",
  "*.shippingAddress",
  "*.billingAddress",
  "address",
  "*.address",
];

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  base: {
    service: "jewellery-platform",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
