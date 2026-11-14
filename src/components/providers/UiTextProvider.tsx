"use client";

import { Fragment, createContext, useContext } from "react";
import type { SiteContent } from "@/modules/site-content/site-content.shared";

/** Interface text (data/frontend/site-content.json → ui) for client components. */
export type UiText = SiteContent["ui"];

const UiTextContext = createContext<UiText | null>(null);

export function UiTextProvider({ value, children }: { value: UiText; children: React.ReactNode }) {
  return <UiTextContext.Provider value={value}>{children}</UiTextContext.Provider>;
}

/** Read interface text in any client component: `const t = useUiText(); t.cart.heading`. */
export function useUiText(): UiText {
  const value = useContext(UiTextContext);
  if (!value) throw new Error("useUiText must be used inside UiTextProvider (root layout).");
  return value;
}

export { fill } from "@/lib/fill-text";

/**
 * Like fill(), but values may be React elements (e.g. <strong>):
 * fillNodes("Quote {number} expired", { number: <strong>Q-1</strong> }).
 */
export function fillNodes(
  template: string,
  values: Record<string, React.ReactNode>,
): React.ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key && key in values ? <Fragment key={i}>{values[key]}</Fragment> : part;
  });
}
