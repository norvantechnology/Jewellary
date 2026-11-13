"use client";

import * as React from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const emptySubscribe = () => () => {};

export function CurrentYear() {
  const year = React.useSyncExternalStore(
    emptySubscribe,
    () => String(new Date().getFullYear()),
    () => "2026",
  );
  return <>{year}</>;
}

export interface FooterSectionGroup {
  id: string;
  heading: string;
  links: Array<{ label: string; href: string }>;
}

export function FooterLinkAccordion({ sections }: { sections: FooterSectionGroup[] }) {
  return (
    <Accordion type="multiple" className="w-full md:hidden">
      {sections.map((section) => (
        <AccordionItem
          key={section.id}
          value={section.id}
          className="border-b border-footer-border"
        >
          <AccordionTrigger className="min-h-12 py-3 text-sm font-semibold text-footer-text hover:text-footer-accent hover:no-underline [&_svg]:text-footer-muted">
            {section.heading}
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <ul className="space-y-1">
              {section.links.map((item) => (
                <li key={item.href} className="min-w-0">
                  <Link
                    href={item.href}
                    prefetch={false}
                    title={item.label}
                    className="flex min-h-11 max-w-full min-w-0 items-center text-sm text-footer-body transition-colors hover:text-footer-accent focus-visible:text-footer-accent"
                  >
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
