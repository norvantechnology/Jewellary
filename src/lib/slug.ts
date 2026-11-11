/**
 * Generates a lowercase, hyphenated URL-safe slug suitable for SEO routes.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Joins category segments cleanly into a canonical path (e.g., "rings/engagement-rings").
 */
export function buildCategoryPath(slug: string, parentPath?: string | null): string {
  const cleanSlug = slugify(slug);
  if (!parentPath) return cleanSlug;
  const cleanParent = parentPath.replace(/^\/+|\/+$/g, "");
  return cleanParent ? `${cleanParent}/${cleanSlug}` : cleanSlug;
}
