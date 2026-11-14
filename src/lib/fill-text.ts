/** Replaces {name} placeholders in JSON text: fill("Hi {name}", { name: "Ana" }). Server- and client-safe. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
