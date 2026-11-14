"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

type Section = Exclude<keyof ReturnType<typeof useUiText>, `_${string}`>;

/**
 * Renders one interface string from site-content.json → ui inside a server component,
 * e.g. <UiText section="common" name="exploreInstead" />.
 */
export function UiText<S extends Section>({
  section,
  name,
}: {
  section: S;
  name: Exclude<keyof ReturnType<typeof useUiText>[S], `_${string}`> & string;
}) {
  const ui = useUiText();
  return <>{(ui[section] as Record<string, string>)[name]}</>;
}
