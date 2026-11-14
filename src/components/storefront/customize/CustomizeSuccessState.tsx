"use client";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openAtelierChat } from "@/lib/atelier-events";
import type { CustomizationRequestDetailDTO } from "@/modules/customization/customization.service";

interface CustomizeSuccessStateProps {
  detail: CustomizationRequestDetailDTO;
  productSlug: string;
  signedInUser: boolean;
  variant: "page" | "drawer";
  onDone?: () => void;
}

export function CustomizeSuccessState({
  detail,
  productSlug,
  signedInUser,
  variant,
  onDone,
}: CustomizeSuccessStateProps) {
  const ui = useUiText();
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(detail.requestNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  }

  return (
    <div
      data-testid="customization-confirmation"
      className="mx-auto flex w-full max-w-md flex-col items-center py-8 text-center sm:py-12"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="size-6 stroke-[2]" aria-hidden="true" />
      </div>

      {variant === "page" ? (
        <h1 className="mt-4 font-sans text-2xl font-semibold tracking-tight text-foreground">
          {ui.customize.success.title}
        </h1>
      ) : (
        <h2 className="mt-4 font-sans text-2xl font-semibold tracking-tight text-foreground">
          {ui.customize.success.title}
        </h2>
      )}

      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3.5 py-1.5">
        <span className="tabular-nums-price text-sm font-medium text-foreground">
          {detail.requestNumber}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={copied ? ui.customize.success.copied : ui.customize.success.copy}
          className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {copied ? (
            <Check className="size-3.5 text-success" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{ui.customize.success.emailNote}</p>

      <div className="mt-7 flex w-full flex-col gap-2.5">
        <Button asChild size="lg" className="min-h-12 w-full">
          <Link
            href={signedInUser ? `/account/customizations/${detail.id}` : "/account/customizations"}
            onClick={() => onDone?.()}
          >
            {ui.customize.success.viewRequests}
          </Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-12 w-full gap-2"
          onClick={() =>
            openAtelierChat({
              conversationId: detail.conversationId ?? undefined,
              contextType: "CUSTOMIZATION_REQUEST",
              contextRefId: detail.id,
              title: detail.requestNumber,
            })
          }
        >
          <MessagesSquare className="size-4 shrink-0" aria-hidden="true" />
          <span>{ui.customize.success.chat}</span>
        </Button>

        {onDone ? (
          <Button
            type="button"
            variant="link"
            onClick={onDone}
            className="mx-auto mt-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {ui.customize.success.continue}
          </Button>
        ) : (
          <Button
            asChild
            variant="link"
            className="mx-auto mt-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Link href={`/products/${productSlug}`}>{ui.customize.success.continue}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
