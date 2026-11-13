export type AtelierChatContextType = "GENERAL" | "PRODUCT" | "CUSTOMIZATION_REQUEST" | "ORDER";

export interface OpenCustomizationEventDetail {
  productSlug: string;
}

export interface OpenAtelierChatEventDetail {
  conversationId?: string;
  contextType?: AtelierChatContextType;
  contextRefId?: string | null;
  title?: string | null;
  prefillMessage?: string;
  openSharePicker?: boolean;
}

export const ATELIER_CUSTOMIZE_EVENT = "atelier:open-customization";
export const ATELIER_CHAT_EVENT = "atelier:open-chat";
export const ATELIER_DRAWER_STATE_EVENT = "atelier:customize-drawer-toggle";

let pendingCustomizationDetail: OpenCustomizationEventDetail | null = null;
let pendingChatDetail: OpenAtelierChatEventDetail | null = null;

/**
 * Triggers the storefront bespoke customization sheet for the given product slug.
 * Buffers the latest request so cold clicks during async sheet hydration still open.
 */
export function openAtelierCustomization(productSlug: string): void {
  if (typeof window === "undefined") return;
  const detail: OpenCustomizationEventDetail = { productSlug };
  pendingCustomizationDetail = detail;
  window.dispatchEvent(
    new CustomEvent<OpenCustomizationEventDetail>(ATELIER_CUSTOMIZE_EVENT, {
      detail,
    }),
  );
}

export function consumePendingAtelierCustomization(): OpenCustomizationEventDetail | null {
  const next = pendingCustomizationDetail;
  pendingCustomizationDetail = null;
  return next;
}

export function hasPendingAtelierCustomization(): boolean {
  return pendingCustomizationDetail !== null;
}

/**
 * Triggers the storefront concierge chat popover / bottom sheet with optional context.
 * Buffers the latest request so cold clicks during async chat hydration still open.
 */
export function openAtelierChat(detail: OpenAtelierChatEventDetail = {}): void {
  if (typeof window === "undefined") return;
  pendingCustomizationDetail = null;
  pendingChatDetail = detail;
  window.dispatchEvent(
    new CustomEvent<OpenAtelierChatEventDetail>(ATELIER_CHAT_EVENT, {
      detail,
    }),
  );
}

export function consumePendingAtelierChat(): OpenAtelierChatEventDetail | null {
  const next = pendingChatDetail;
  pendingChatDetail = null;
  return next;
}
