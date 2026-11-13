"use client";

import * as React from "react";
import { MessagesSquare } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { openAtelierChat, type AtelierChatContextType } from "@/lib/atelier-events";
import { cn } from "@/lib/utils";

interface OpenAtelierChatButtonProps {
  label?: string;
  contextType?: AtelierChatContextType;
  contextRefId?: string | null;
  title?: string | null;
  conversationId?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

/**
 * Leaf client trigger that opens the floating Atelier Chat widget anchored to
 * an optional product, customization request, or order conversation.
 */
export function OpenAtelierChatButton({
  label = "Chat with atelier",
  contextType = "GENERAL",
  contextRefId = null,
  title = null,
  conversationId,
  variant = "outline",
  size = "sm",
  className,
}: OpenAtelierChatButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() =>
        openAtelierChat({
          conversationId,
          contextType,
          contextRefId,
          title,
        })
      }
      className={cn("min-h-11 gap-1.5 sm:min-h-10", className)}
    >
      <MessagesSquare className="size-4 shrink-0 stroke-[1.5]" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}
