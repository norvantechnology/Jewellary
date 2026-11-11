import type { Thing, WithContext } from "schema-dts";

export function serializeJsonLd<T extends Thing>(data: WithContext<T>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

interface JsonLdProps<T extends Thing> {
  data: WithContext<T>;
}

/**
 * XSS-safe structured data renderer (escapes `<` as `\u003c` per Next.js & OWASP guidance).
 */
export function JsonLd<T extends Thing>({ data }: JsonLdProps<T>) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
