"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center font-sans text-foreground">
        <h1 className="type-h2 font-semibold">Something Went Wrong</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
          Please refresh the page or return shortly.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          Reload application
        </button>
      </body>
    </html>
  );
}
