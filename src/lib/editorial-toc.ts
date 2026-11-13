export interface TocEntry {
  id: string;
  text: string;
}

export interface FaqQuestionItem {
  id: string;
  question: string;
  answerHtml: string;
}

export interface FaqSectionGroup {
  id: string;
  heading: string;
  items: FaqQuestionItem[];
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "")).trim();
}

function slugifyHeading(text: string, seen: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

/**
 * Adds deterministic `id` attributes to <h2> elements in sanitized HTML
 * and returns Table of Contents entries.
 */
export function injectHeadingIdsAndExtractToc(html: string): {
  html: string;
  toc: TocEntry[];
} {
  const seen = new Map<string, number>();
  const toc: TocEntry[] = [];

  const updated = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (full, attrs = "", inner) => {
    const text = stripTags(inner);
    if (!text) return full;

    const existingIdMatch = attrs.match(/\sid=(["'])([^"']+)\1/i);
    const id = existingIdMatch?.[2] ?? slugifyHeading(text, seen);
    toc.push({ id, text });

    if (existingIdMatch) {
      return full;
    }
    return `<h2 id="${id}"${attrs}>${inner}</h2>`;
  });

  return { html: updated, toc };
}

/**
 * Extracts category groups (<h2>) and question accordions (<h3> + body)
 * from rendered FAQ markdown HTML.
 */
export function extractFaqGroups(html: string): {
  introHtml: string;
  groups: FaqSectionGroup[];
} {
  const seen = new Map<string, number>();
  const h2Parts = html.split(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const introHtml = (h2Parts[0] ?? "").trim();
  const groups: FaqSectionGroup[] = [];

  for (let i = 1; i < h2Parts.length; i += 2) {
    const headingRaw = h2Parts[i] ?? "";
    const sectionBody = h2Parts[i + 1] ?? "";
    const heading = stripTags(headingRaw);
    const h3Parts = sectionBody.split(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const items: FaqQuestionItem[] = [];

    for (let j = 1; j < h3Parts.length; j += 2) {
      const question = stripTags(h3Parts[j] ?? "");
      const answerHtml = (h3Parts[j + 1] ?? "").trim();
      if (question) {
        items.push({
          id: slugifyHeading(question, seen),
          question,
          answerHtml,
        });
      }
    }

    if (heading && items.length > 0) {
      groups.push({
        id: slugifyHeading(heading, seen),
        heading,
        items,
      });
    }
  }

  return { introHtml, groups };
}
