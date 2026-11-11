"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentCartSummary } from "@/modules/cart/cart.service";
import { calculateCheckoutQuote } from "@/modules/orders/checkout-quote";
import {
  confirmSandboxPaymentSchema,
  createCheckoutOrderSchema,
  quoteCheckoutSchema,
  retryOrderPaymentSchema,
} from "@/modules/orders/order.schemas";
import {
  confirmSandboxOrderPayment,
  createOrderAndPayment,
  resolveCheckoutActorsForAction,
  retryOrderPayment,
} from "@/modules/orders/order.service";
import { getAllShippingZones, getPublicStoreSettings } from "@/modules/settings/settings.service";
import { CACHE_TAGS } from "@/server/cache-tags";
import { createAction } from "@/server/create-action";
import { ValidationError } from "@/server/errors";

function revalidateProductStockCaches(productIds: string[]) {
  revalidateTag(CACHE_TAGS.products, "max");
  for (const productId of productIds) {
    revalidateTag(CACHE_TAGS.product(productId), "max");
  }
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

export const quoteCheckoutAction = createAction(
  {
    name: "checkout.quote",
    schema: quoteCheckoutSchema,
    auth: "public",
  },
  async ({ shippingCountry, shippingZoneId }) => {
    const [cart, settings, zones] = await Promise.all([
      getCurrentCartSummary(),
      getPublicStoreSettings(),
      getAllShippingZones(true),
    ]);

    const result = calculateCheckoutQuote({
      items: cart.items,
      shippingCountry,
      shippingZoneId,
      zones,
      settings,
    });

    if (!result.ok) {
      throw new ValidationError(result.message);
    }

    return result.quote;
  },
);

export const createCheckoutOrderAction = createAction(
  {
    name: "checkout.createOrder",
    schema: createCheckoutOrderSchema,
    auth: "public",
    rateLimit: { tier: "checkout" },
  },
  async (input, { auth }) => {
    const actors = await resolveCheckoutActorsForAction();
    const effectiveUserId = auth?.user.id ?? actors.userId;

    const created = await createOrderAndPayment(input, {
      userId: effectiveUserId,
      cartOwner: actors.cartOwner,
    });

    revalidateProductStockCaches(created.productIds);
    return created;
  },
);

export const retryOrderPaymentAction = createAction(
  {
    name: "checkout.retryPayment",
    schema: retryOrderPaymentSchema,
    auth: "public",
    rateLimit: { tier: "checkout" },
  },
  async (input, { auth }) => {
    const retried = await retryOrderPayment(input, auth?.user.id ?? null);
    revalidatePath(`/orders/${input.orderNumber}/confirmation`);
    return retried;
  },
);

export const confirmSandboxPaymentAction = createAction(
  {
    name: "checkout.confirmSandboxPayment",
    schema: confirmSandboxPaymentSchema,
    auth: "public",
    rateLimit: { tier: "checkout" },
  },
  async (input, { auth }) => {
    const settled = await confirmSandboxOrderPayment(input, auth?.user.id ?? null);
    revalidateProductStockCaches(settled.productIds);
    revalidatePath(`/orders/${settled.orderNumber}/confirmation`);
    return {
      orderNumber: settled.orderNumber,
      status: settled.status,
    };
  },
);
