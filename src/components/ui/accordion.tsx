"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Accordion as RadixAccordion } from "radix-ui";
import { cn } from "@/lib/utils";

export const Accordion = RadixAccordion.Root;

export function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof RadixAccordion.Item>) {
  return <RadixAccordion.Item className={cn("border-b border-border", className)} {...props} />;
}

export function AccordionTrigger({
  className,
  children,
  headingLevel = "h3",
  ...props
}: React.ComponentProps<typeof RadixAccordion.Trigger> & {
  headingLevel?: "h2" | "h3" | "h4";
}) {
  const HeadingTag = headingLevel;
  return (
    <RadixAccordion.Header asChild>
      <HeadingTag className="flex">
        <RadixAccordion.Trigger
          className={cn(
            "transition-ui flex min-h-12 flex-1 cursor-pointer items-center justify-between gap-4 py-3 text-left font-sans text-sm font-semibold text-text hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&[data-state=open]>svg]:rotate-180",
            className,
          )}
          {...props}
        >
          {children}
          <ChevronDown
            className="size-5 shrink-0 text-text-muted transition-transform duration-200 ease-out"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </RadixAccordion.Trigger>
      </HeadingTag>
    </RadixAccordion.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixAccordion.Content>) {
  return (
    <RadixAccordion.Content
      forceMount
      className={cn("ma-accordion-content text-sm text-text-2", className)}
      {...props}
    >
      <div className="ma-accordion-inner">
        <div className="pt-0 pb-4">{children}</div>
      </div>
    </RadixAccordion.Content>
  );
}
