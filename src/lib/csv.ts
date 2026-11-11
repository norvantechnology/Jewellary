const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  // Guard against spreadsheet formula injection (CWE-1236)
  if (FORMULA_TRIGGER_RE.test(str) || FORMULA_TRIGGER_RE.test(str.trimStart())) {
    str = `'${str}`;
  }

  if (/[",\n\r']/.test(str) || str.startsWith(" ") || str.endsWith(" ")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function buildCsvDocument(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map((h) => escapeCsvCell(h)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
