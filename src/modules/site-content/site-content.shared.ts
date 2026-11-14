import defaults from "../../../data/frontend/site-content.json";

/** Shape of data/frontend/site-content.json (the defaults). Admin edits must keep this shape. */
export type SiteContent = typeof defaults;
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

export const SITE_CONTENT_DEFAULTS: SiteContent = defaults;

/** Root sections read only from the file (never from admin overrides). */
export const FILE_ONLY_SECTIONS = ["siteConfig"] as const;

/** Nested blocks that are also file-only (read synchronously by SEO code). */
export const FILE_ONLY_PATHS: ReadonlyArray<readonly string[]> = [["site", "seoTemplates"]];

function isFileOnlyPath(path: readonly string[]): boolean {
  if (path.length === 1 && (FILE_ONLY_SECTIONS as readonly string[]).includes(path[0]!))
    return true;
  return FILE_ONLY_PATHS.some((p) => p.length === path.length && p.every((k, i) => k === path[i]));
}

/** Keys starting with "_" are editor notes in the JSON: never shown on the site or editable. */
export function isCommentKey(key: string): boolean {
  return key.startsWith("_");
}

/** Drops comment keys and file-only sections, leaving only what admin may store. */
export function stripNonEditable(value: unknown, path: readonly string[] = []): unknown {
  if (Array.isArray(value)) return value.map((item) => stripNonEditable(item, [...path, "[]"]));
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isCommentKey(key) && !isFileOnlyPath([...path, key]))
      .map(([key, child]) => [key, stripNonEditable(child, [...path, key])]),
  );
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges an admin override over the defaults. Objects merge key by key, so keys added to
 * the JSON file later still appear; arrays and strings from the override replace the default.
 * Override values whose type does not match the default are ignored.
 */
export function mergeSiteContent(base: JsonValue, override: unknown): JsonValue {
  if (override === undefined || override === null) return base;
  if (isObject(base)) {
    if (!isObject(override)) return base;
    const out: JsonObject = {};
    for (const [key, value] of Object.entries(base)) {
      out[key] = isCommentKey(key) ? value : mergeSiteContent(value, override[key]);
    }
    return out;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(override)) return base;
    const template = base[0];
    return template === undefined
      ? base
      : override.map((item) => mergeSiteContent(template, item) as JsonValue);
  }
  return typeof override === typeof base ? (override as JsonValue) : base;
}

/**
 * Lists problems that make `candidate` unusable as page content: unknown keys, wrong types,
 * or over-long text. Returns an empty array when it is valid.
 */
export function validateSiteContent(candidate: unknown): string[] {
  const errors: string[] = [];
  const walk = (base: JsonValue, value: unknown, path: string) => {
    if (errors.length >= 20) return;
    if (isObject(base)) {
      if (!isObject(value)) return void errors.push(`${path || "content"} must be an object`);
      for (const key of Object.keys(value)) {
        if (isCommentKey(key)) continue;
        if (!(key in base)) errors.push(`${path ? `${path}.` : ""}${key} is not a known field`);
      }
      for (const key of Object.keys(base)) {
        if (!isCommentKey(key) && key in value)
          walk(base[key] as JsonValue, value[key], path ? `${path}.${key}` : key);
      }
      return;
    }
    if (Array.isArray(base)) {
      if (!Array.isArray(value)) return void errors.push(`${path} must be a list`);
      if (value.length > 50) errors.push(`${path} can have at most 50 items`);
      const template = base[0];
      if (template !== undefined) value.forEach((item, i) => walk(template, item, `${path}[${i}]`));
      return;
    }
    if (typeof value !== typeof base) return void errors.push(`${path} must be ${typeof base}`);
    if (typeof value === "string" && value.length > 60_000) errors.push(`${path} is too long`);
  };
  walk(SITE_CONTENT_DEFAULTS as unknown as JsonValue, candidate, "");
  return errors;
}
