"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center font-sans text-foreground">
        <p className="text-xs font-medium tracking-widest text-destructive uppercase">
          System Error
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium">
          We Experienced a Temporary Interruption
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Please refresh the page to restore your session.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 cursor-pointer rounded-sm bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Reload Page
        </button>
      </body>
    </html>
  );
}
