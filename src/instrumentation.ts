import type { Instrumentation } from "next";
import * as Sentry from "@sentry/nextjs";

export function register() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      beforeSend(event) {
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }
        return event;
      },
    });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureRequestError(err, request, context);
  }
  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      msg: "Next.js request error",
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      digest,
      error: message,
    }),
  );
};
