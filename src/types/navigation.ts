export interface NavCategoryItem {
  id: string;
  name: string;
  slug: string;
  path: string;
  description?: string | null;
  children: {
    id: string;
    name: string;
    slug: string;
    path: string;
  }[];
}

export interface SiteHeaderConfig {
  siteName: string;
  announcementEnabled: boolean;
  announcementText?: string | null;
  announcementHref?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  socialLinks?: { label: string; href: string }[];
  categories: NavCategoryItem[];
}
