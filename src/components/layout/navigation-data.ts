import type { NavCategoryItem } from "@/types/navigation";

export interface NavCategoryGroup {
  id: string;
  title: string;
  href: string;
  items: Array<{
    id: string;
    title: string;
    href: string;
  }>;
}

export interface NavCollectionLink {
  id: string;
  title: string;
  href: string;
}

export const PRIMARY_NAV_ITEMS = [
  { label: "All Jewellery", href: "/collections", exact: true },
  { label: "Collections", href: "/collections", kind: "megamenu" as const },
  { label: "Guides", href: "/guides" },
  { label: "Atelier", href: "/about" },
  { label: "Concierge", href: "/contact" },
] as const;

const GROUP_PRIORITY: Record<string, number> = {
  rings: 1,
  necklaces: 2,
  earrings: 3,
  bracelets: 4,
};

/**
 * Normalizes backend categories into uniform category groups and concise collection links
 * shared between the desktop mega-menu and mobile navigation drawer.
 */
export function buildNavigationSections(categories: NavCategoryItem[]): {
  categoryGroups: NavCategoryGroup[];
  collections: NavCollectionLink[];
} {
  const sortedRoots = [...categories].sort((a, b) => {
    const aOrder = GROUP_PRIORITY[a.slug.toLowerCase()] ?? 50;
    const bOrder = GROUP_PRIORITY[b.slug.toLowerCase()] ?? 50;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });

  const categoryGroups: NavCategoryGroup[] = sortedRoots.slice(0, 4).map((root) => ({
    id: root.id,
    title: root.name,
    href: `/collections/${root.path}`,
    items:
      root.children.length > 0
        ? root.children.map((child) => ({
            id: child.id,
            title: child.name,
            href: `/collections/${child.path}`,
          }))
        : [
            {
              id: `${root.id}-all`,
              title: `All ${root.name}`,
              href: `/collections/${root.path}`,
            },
          ],
  }));

  const seenHrefs = new Set<string>();
  const collections: NavCollectionLink[] = [];

  for (const root of sortedRoots) {
    for (const child of root.children) {
      const href = `/collections/${child.path}`;
      if (!seenHrefs.has(href)) {
        seenHrefs.add(href);
        collections.push({ id: child.id, title: child.name, href });
      }
    }
  }

  for (const root of sortedRoots) {
    const href = `/collections/${root.path}`;
    if (!seenHrefs.has(href)) {
      seenHrefs.add(href);
      collections.push({ id: root.id, title: root.name, href });
    }
  }

  return {
    categoryGroups,
    collections: collections.slice(0, 6),
  };
}
