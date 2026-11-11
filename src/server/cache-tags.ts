import "server-only";

export const CACHE_TAGS = {
  products: "products",
  product: (id: string) => `product:${id}`,
  productSlug: (slug: string) => `product-slug:${slug}`,
  categories: "categories",
  category: (id: string) => `category:${id}`,
  facets: "facets",
  banners: "banners",
  articles: "articles",
  article: (slug: string) => `article:${slug}`,
  settings: "settings",
  shipping: "shipping",
} as const;
