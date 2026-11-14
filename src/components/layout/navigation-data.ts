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

/** Menu labels from data/frontend/site-content.json → site.header (passed down from the server). */
export interface NavLabels {
  allJewellery: string;
  collections: string;
  guides: string;
  atelier: string;
  concierge: string;
  shopByCategory: string;
  mobileShopByCategory: string;
  viewAllCollections: string;
  mobileAbout: string;
  mobileContact: string;
  account: string;
  orders: string;
  trackOrder: string;
  wishlist: string;
}

/**
 * Normalizes backend categories into uniform category groups and concise collection links
 * shared between the desktop mega-menu and mobile navigation drawer.
 */
export function buildNavigationSections(categories: NavCategoryItem[]): {
  categoryGroups: NavCategoryGroup[];
  collections: NavCollectionLink[];
} {
  // Categories arrive in the order set in Admin > Categories (sortOrder).
  const sortedRoots = categories;

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
