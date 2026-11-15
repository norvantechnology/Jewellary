export const PAGINATION_PAGE_SIZE = 24;
export const ADMIN_PAGE_SIZE = 20;
export const SEARCH_SUGGEST_LIMIT = 8;
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_CUSTOMER_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_CUSTOMIZATION_FILES = 5;
export const MAX_CHAT_FILES = 5;
export const MAX_PRODUCT_IMAGES = 12;
export const ORDER_RESERVATION_MINUTES = 30;
export const GUEST_COOKIE_NAME = "shinora_guest_id";
export const GUEST_TRACKING_COOKIE_NAME = "shinora_order_track";
export const CONSENT_COOKIE_NAME = "shinora_consent";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const VIEWPORT_TEST_MATRIX = [
  { name: "mobile-360", width: 360, height: 740 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 },
] as const;
