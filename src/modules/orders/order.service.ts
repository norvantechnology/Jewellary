import "server-only";
import crypto from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentProviderType } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { formatMoneyExact, multiplyMoney, toDecimal } from "@/lib/money";
import { getCurrentCartSummary, type CartOwner } from "@/modules/cart/cart.service";
import { calculateCheckoutQuote, type CheckoutQuoteDTO } from "@/modules/orders/checkout-quote";
import type {
  CheckoutAddressInput,
  ConfirmSandboxPaymentInput,
  CreateCheckoutOrderInput,
  RetryOrderPaymentInput,
} from "@/modules/orders/order.schemas";
import { isCancellableBeforeSettlement } from "@/modules/orders/state-machine";
import {
  getCheckoutPaymentClientConfig,
  getPaymentProvider,
  type CheckoutClientPaymentConfig,
} from "@/modules/payments";
import type {
  CreatePaymentIntentResult,
  VerifiedWebhookEvent,
} from "@/modules/payments/payment.types";
import { buildSignedSandboxRazorpayWebhook } from "@/modules/payments/razorpay.adapter";
import { buildSignedSandboxStripeWebhook } from "@/modules/payments/stripe.adapter";
import {
  getAllShippingZones,
  getPublicStoreSettings,
  type PublicStoreSettings,
  type ShippingZoneDTO,
} from "@/modules/settings/settings.service";
import { getOptionalSession } from "@/server/dal";
import { db } from "@/server/db";
import { sendOrderConfirmationEmail } from "@/server/email/send";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  OutOfStockError,
  PaymentError,
  ValidationError,
} from "@/server/errors";
import { readGuestTokenFromCookies } from "@/server/guest-token";
import { logger } from "@/server/logger";

const RESERVATION_MINUTES = 30;

export function hashGuestOrderToken(rawToken: string): string {
  return crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`guest_order:${rawToken}`)
    .digest("hex");
}

export function verifyGuestOrderToken(
  rawToken: string | null | undefined,
  storedHash: string | null | undefined,
): boolean {
  if (!rawToken || !storedHash) return false;
  const candidate = Buffer.from(hashGuestOrderToken(rawToken), "utf8");
  const expected = Buffer.from(storedHash, "utf8");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export interface SavedAddressDTO {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface CheckoutBootstrapDTO {
  cart: Awaited<ReturnType<typeof getCurrentCartSummary>>;
  settings: PublicStoreSettings;
  shippingZones: ShippingZoneDTO[];
  initialQuote: CheckoutQuoteDTO | null;
  userEmail: string | null;
  userName: string | null;
  savedAddresses: SavedAddressDTO[];
  paymentConfig: CheckoutClientPaymentConfig;
}

export interface CreatedOrderResultDTO {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  subtotal: string;
  shippingCost: string;
  taxAmount: string;
  total: string;
  reservedUntil: string | null;
  guestToken: string | null;
  productIds: string[];
  payment: {
    provider: PaymentProviderType;
    providerIntentId: string;
    clientSecret: string | null;
    razorpayOrderId: string | null;
    keyId: string | null;
    mode: "live" | "sandbox";
  };
}

export interface OrderConfirmationDTO {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  subtotal: string;
  shippingCost: string;
  taxAmount: string;
  discountAmount: string;
  total: string;
  shippingMethodName: string;
  shippingAddress: CheckoutAddressInput;
  billingAddress: CheckoutAddressInput;
  giftNote: string | null;
  signatureRequired: boolean;
  reservedUntil: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  trackingUrl: string | null;
  createdAt: string;
  contactEmail: string;
  sandboxMode: boolean;
  paymentProvider: PaymentProviderType | null;
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    skuSnapshot: string;
    titleSnapshot: string;
    variantTitleSnapshot: string;
    imageUrlSnapshot: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  events: Array<{
    id: string;
    toStatus: OrderStatus;
    note: string | null;
    createdAt: string;
  }>;
}

async function loadSettingsAndZonesInTx(tx: Prisma.TransactionClient) {
  const [settingsRow, zoneRows] = await Promise.all([
    tx.storeSetting.findUnique({ where: { id: "default" } }),
    tx.shippingZone.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const settings: PublicStoreSettings = settingsRow
    ? {
        storeName: settingsRow.storeName,
        tagline: settingsRow.tagline,
        contactEmail: settingsRow.contactEmail,
        contactPhone: settingsRow.contactPhone,
        supportHours: settingsRow.supportHours,
        currency: settingsRow.currency,
        defaultCountry: settingsRow.defaultCountry,
        supportedCountries: settingsRow.supportedCountries,
        taxRate: settingsRow.taxRate.toString(),
        taxLabel: settingsRow.taxLabel,
        taxInclusive: settingsRow.taxInclusive,
        freeShippingThreshold: settingsRow.freeShippingThreshold?.toString() ?? null,
        signatureThreshold: settingsRow.signatureThreshold.toString(),
        returnWindowDays: settingsRow.returnWindowDays,
        announcementBarEnabled: settingsRow.announcementBarEnabled,
        announcementBarText: settingsRow.announcementBarText,
        announcementBarHref: settingsRow.announcementBarHref,
        logoUrl: settingsRow.logoUrl,
        socialLinks: Array.isArray(settingsRow.socialLinks)
          ? (settingsRow.socialLinks as Array<{ label: string; href: string }>)
          : [],
        physicalStore:
          settingsRow.physicalStore && typeof settingsRow.physicalStore === "object"
            ? (settingsRow.physicalStore as PublicStoreSettings["physicalStore"])
            : null,
        allowAiCrawlers: settingsRow.allowAiCrawlers,
        seoDefaultTitlePattern: settingsRow.seoDefaultTitlePattern,
        seoDefaultDescription: settingsRow.seoDefaultDescription,
        defaultOgImageUrl: settingsRow.defaultOgImageUrl,
      }
    : await getPublicStoreSettings();

  const zones: ShippingZoneDTO[] = zoneRows.map((z) => ({
    id: z.id,
    name: z.name,
    countries: z.countries,
    flatRate: z.flatRate.toString(),
    freeThreshold: z.freeThreshold?.toString() ?? null,
    estimatedDaysMin: z.estimatedDaysMin,
    estimatedDaysMax: z.estimatedDaysMax,
    isInsured: z.isInsured,
    isActive: z.isActive,
    sortOrder: z.sortOrder,
  }));

  return { settings, zones };
}

export async function getCheckoutBootstrapData(): Promise<CheckoutBootstrapDTO> {
  const [cart, settings, shippingZones, session] = await Promise.all([
    getCurrentCartSummary(),
    getPublicStoreSettings(),
    getAllShippingZones(true),
    getOptionalSession(),
  ]);

  const savedAddresses = session?.user
    ? await db.address.findMany({
        where: { userId: session.user.id },
        orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          label: true,
          fullName: true,
          phone: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          isDefaultShipping: true,
          isDefaultBilling: true,
        },
      })
    : [];

  const defaultCountry = savedAddresses[0]?.country ?? settings.defaultCountry;
  const quoteRes =
    cart.items.length > 0
      ? calculateCheckoutQuote({
          items: cart.items,
          shippingCountry: defaultCountry,
          zones: shippingZones,
          settings,
        })
      : null;

  return {
    cart,
    settings,
    shippingZones,
    initialQuote: quoteRes?.ok ? quoteRes.quote : null,
    userEmail: session?.user.email ?? null,
    userName: session?.user.name ?? null,
    savedAddresses,
    paymentConfig: getCheckoutPaymentClientConfig(),
  };
}

export async function releaseOrderReservationById(
  tx: Prisma.TransactionClient,
  orderId: string,
  targetStatus: "CANCELLED" | "PAYMENT_FAILED",
  note: string,
  actorId: string | null = null,
): Promise<boolean> {
  const lockedOrders = await tx.$queryRaw<
    Array<{ id: string; orderNumber: string; status: OrderStatus }>
  >`
    SELECT id, "orderNumber", status
    FROM "Order"
    WHERE id = ${orderId}
    FOR UPDATE
  `;

  const lockedOrder = lockedOrders[0];
  if (!lockedOrder || !isCancellableBeforeSettlement(lockedOrder.status)) {
    return false;
  }

  const orderItems = await tx.orderItem.findMany({
    where: { orderId },
    orderBy: { variantId: "asc" },
    select: { variantId: true, quantity: true },
  });

  if (targetStatus === "CANCELLED") {
    for (const item of orderItems) {
      const updatedVariants = await tx.$queryRaw<Array<{ stockQty: number; reservedQty: number }>>`
        UPDATE "ProductVariant"
        SET "reservedQty" = GREATEST(0, "reservedQty" - ${item.quantity}),
            "updatedAt" = NOW()
        WHERE id = ${item.variantId}
        RETURNING "stockQty", "reservedQty"
      `;

      const uv = updatedVariants[0];
      if (uv) {
        await tx.inventoryTransaction.create({
          data: {
            variantId: item.variantId,
            reason: "RELEASE",
            delta: item.quantity,
            balanceAfter: Math.max(0, uv.stockQty - uv.reservedQty),
            referenceType: "ORDER",
            referenceId: orderId,
            note,
            actorId,
          },
        });
      }
    }
  }

  await tx.order.update({
    where: { id: orderId },
    data: {
      status: targetStatus,
      ...(targetStatus === "CANCELLED" ? { cancelledAt: new Date(), reservedUntil: null } : {}),
    },
  });

  await tx.orderEvent.create({
    data: {
      orderId,
      fromStatus: lockedOrder.status,
      toStatus: targetStatus,
      note,
      actorId,
    },
  });

  return true;
}

/**
 * Concurrency-safe, server-priced checkout transaction (§8.6):
 * 1. Re-validates active products, variants, and cart contents under row-level FOR UPDATE lock.
 * 2. Computes pricing, shipping, and taxes exclusively from DB records.
 * 3. Reserves inventory (`reservedQty += qty`) and records INVENTORY RESERVATION ledger rows.
 * 4. Clears the owner's cart and creates the provider PaymentIntent with compensation cleanup on outage.
 */
export async function createOrderAndPayment(
  input: CreateCheckoutOrderInput,
  owner: { cartOwner: CartOwner | null; userId: string | null },
): Promise<CreatedOrderResultDTO> {
  // Check idempotency early
  const existingOrder = await db.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: {
      items: { select: { productId: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (existingOrder) {
    const ownerMatches =
      (owner.userId && existingOrder.userId === owner.userId) ||
      (!existingOrder.userId &&
        existingOrder.guestEmail?.toLowerCase() === input.email.toLowerCase());
    if (!ownerMatches) {
      throw new ConflictError(
        "This checkout idempotency key is already associated with another order.",
      );
    }

    const latestPayment = existingOrder.payments[0];
    if (latestPayment) {
      const paymentConfig = getCheckoutPaymentClientConfig();
      return {
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        status: existingOrder.status,
        currency: existingOrder.currency,
        subtotal: existingOrder.subtotal.toFixed(2),
        shippingCost: existingOrder.shippingCost.toFixed(2),
        taxAmount: existingOrder.taxAmount.toFixed(2),
        total: existingOrder.total.toFixed(2),
        reservedUntil: existingOrder.reservedUntil?.toISOString() ?? null,
        guestToken: null,
        productIds: Array.from(new Set(existingOrder.items.map((i) => i.productId))),
        payment: {
          provider: latestPayment.provider,
          providerIntentId: latestPayment.providerIntentId,
          clientSecret: null,
          razorpayOrderId:
            latestPayment.provider === "RAZORPAY" ? latestPayment.providerIntentId : null,
          keyId:
            latestPayment.provider === "RAZORPAY"
              ? paymentConfig.razorpayKeyId
              : paymentConfig.stripePublishableKey,
          mode: paymentConfig.sandboxMode ? "sandbox" : "live",
        },
      };
    }
  }

  if (!owner.cartOwner) {
    throw new ValidationError("Your shopping bag is empty.");
  }

  const rawGuestToken = crypto.randomBytes(24).toString("hex");
  const guestLookupTokenHash = hashGuestOrderToken(rawGuestToken);
  const billingSnapshot = input.billingSameAsShipping
    ? input.shippingAddress
    : (input.billingAddress ?? input.shippingAddress);

  const txResult = await db.$transaction(
    async (tx) => {
      const cart = await tx.cart.findFirst({
        where:
          owner.cartOwner?.kind === "user"
            ? { userId: owner.cartOwner.userId }
            : { guestToken: owner.cartOwner?.guestToken ?? "" },
        include: {
          items: {
            orderBy: { variantId: "asc" },
            select: { variantId: true, quantity: true },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new ValidationError("Your shopping bag is empty.");
      }

      const { settings, zones } = await loadSettingsAndZonesInTx(tx);
      const sortedVariantIds = Array.from(new Set(cart.items.map((i) => i.variantId))).sort();

      // Lock variants in deterministic ascending ID order to avoid deadlocks under concurrency
      const lockedVariants = await tx.$queryRaw<
        Array<{
          id: string;
          sku: string;
          title: string;
          priceOverride: Prisma.Decimal | null;
          stockQty: number;
          reservedQty: number;
          isActive: boolean;
          productId: string;
          productName: string;
          productStatus: string;
          deletedAt: Date | null;
          priceMode: string;
          basePrice: Prisma.Decimal;
        }>
      >`
        SELECT pv.id,
               pv.sku,
               pv.title,
               pv."priceOverride",
               pv."stockQty",
               pv."reservedQty",
               pv."isActive",
               pv."productId",
               p.name AS "productName",
               p.status AS "productStatus",
               p."deletedAt",
               p."priceMode",
               p."basePrice"
        FROM "ProductVariant" pv
        JOIN "Product" p ON p.id = pv."productId"
        WHERE pv.id = ANY(${sortedVariantIds}::text[])
        ORDER BY pv.id
        FOR UPDATE OF pv
      `;

      const variantMap = new Map(lockedVariants.map((v) => [v.id, v]));
      const productIds = Array.from(new Set(lockedVariants.map((v) => v.productId)));

      const primaryImages = await tx.productImage.findMany({
        where: { productId: { in: productIds } },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: { productId: true, thumbUrl: true, mediumUrl: true, url: true },
      });
      const imageByProductId = new Map<string, string>();
      for (const img of primaryImages) {
        if (!imageByProductId.has(img.productId)) {
          imageByProductId.set(img.productId, img.mediumUrl ?? img.thumbUrl ?? img.url);
        }
      }

      const verifiedLines: Array<{
        variantId: string;
        productId: string;
        skuSnapshot: string;
        titleSnapshot: string;
        variantTitleSnapshot: string;
        imageUrlSnapshot: string | null;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
      }> = [];

      for (const cartItem of cart.items) {
        const variant = variantMap.get(cartItem.variantId);
        if (
          !variant ||
          !variant.isActive ||
          variant.productStatus !== "ACTIVE" ||
          variant.deletedAt !== null
        ) {
          throw new ConflictError(
            "One or more pieces in your bag are no longer available for purchase.",
          );
        }
        if (variant.priceMode !== "FIXED") {
          throw new ValidationError(
            `${variant.productName} is Price Upon Request and must be ordered via Private Concierge.`,
          );
        }

        const available = variant.stockQty - variant.reservedQty;
        if (available < cartItem.quantity) {
          throw new OutOfStockError(
            available <= 0
              ? `${variant.productName} (${variant.title}) is no longer in stock.`
              : `Only ${available} piece${available === 1 ? "" : "s"} remaining for ${variant.productName} (${variant.title}).`,
          );
        }

        const liveUnitPrice = toDecimal((variant.priceOverride ?? variant.basePrice).toString());
        const lineTotal = multiplyMoney(liveUnitPrice, cartItem.quantity);

        verifiedLines.push({
          variantId: variant.id,
          productId: variant.productId,
          skuSnapshot: variant.sku,
          titleSnapshot: variant.productName,
          variantTitleSnapshot: variant.title,
          imageUrlSnapshot: imageByProductId.get(variant.productId) ?? null,
          quantity: cartItem.quantity,
          unitPrice: liveUnitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        });
      }

      const quoteResult = calculateCheckoutQuote({
        items: verifiedLines,
        shippingCountry: input.shippingAddress.country,
        shippingZoneId: input.shippingZoneId,
        zones,
        settings,
      });

      if (!quoteResult.ok) {
        throw new ValidationError(quoteResult.message);
      }
      const { quote } = quoteResult;

      // Monotonic sequential order number from Postgres sequence
      const seqRows = await tx.$queryRaw<Array<{ seq: bigint }>>`
        SELECT nextval('order_number_seq')::bigint AS seq
      `;
      const seqValue = seqRows[0]?.seq;
      if (seqValue === undefined) {
        throw new Error("Order number sequence unavailable.");
      }
      const orderNumber = `ORD-${new Date().getUTCFullYear()}-${seqValue.toString().padStart(5, "0")}`;
      const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: owner.userId,
          guestEmail: owner.userId ? null : input.email.toLowerCase(),
          guestLookupTokenHash,
          status: "PENDING_PAYMENT",
          currency: quote.currency,
          subtotal: new Prisma.Decimal(quote.subtotal),
          shippingCost: new Prisma.Decimal(quote.shippingCost),
          taxAmount: new Prisma.Decimal(quote.taxAmount),
          taxRateSnapshot: new Prisma.Decimal(quote.taxRateDecimal),
          discountAmount: new Prisma.Decimal("0.00"),
          total: new Prisma.Decimal(quote.total),
          shippingMethodName: quote.selectedZone.name,
          shippingZoneId: quote.selectedZone.id,
          shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
          billingAddress: billingSnapshot as unknown as Prisma.InputJsonValue,
          giftNote: input.giftNote ?? null,
          customerNote: input.customerNote ?? null,
          signatureRequired: quote.signatureRequired,
          idempotencyKey: input.idempotencyKey,
          reservedUntil,
          items: {
            create: verifiedLines.map((line) => ({
              variantId: line.variantId,
              productId: line.productId,
              skuSnapshot: line.skuSnapshot,
              titleSnapshot: line.titleSnapshot,
              variantTitleSnapshot: line.variantTitleSnapshot,
              imageUrlSnapshot: line.imageUrlSnapshot,
              quantity: line.quantity,
              unitPrice: new Prisma.Decimal(line.unitPrice),
              lineTotal: new Prisma.Decimal(line.lineTotal),
            })),
          },
          events: {
            create: {
              fromStatus: null,
              toStatus: "PENDING_PAYMENT",
              note: "Vault inventory reserved for 30 minutes pending payment authorization.",
              actorId: owner.userId,
            },
          },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          currency: true,
          subtotal: true,
          shippingCost: true,
          taxAmount: true,
          total: true,
          reservedUntil: true,
        },
      });

      // Increment reservedQty on each locked variant & append INVENTORY RESERVATION ledger rows
      for (const line of verifiedLines) {
        const updatedVariants = await tx.$queryRaw<
          Array<{ stockQty: number; reservedQty: number }>
        >`
          UPDATE "ProductVariant"
          SET "reservedQty" = "reservedQty" + ${line.quantity},
              "updatedAt" = NOW()
          WHERE id = ${line.variantId}
            AND ("stockQty" - "reservedQty") >= ${line.quantity}
          RETURNING "stockQty", "reservedQty"
        `;

        const updated = updatedVariants[0];
        if (!updated) {
          throw new OutOfStockError(`Unable to reserve ${line.titleSnapshot}; please retry.`);
        }

        await tx.inventoryTransaction.create({
          data: {
            variantId: line.variantId,
            reason: "RESERVATION",
            delta: -line.quantity,
            balanceAfter: Math.max(0, updated.stockQty - updated.reservedQty),
            referenceType: "ORDER",
            referenceId: createdOrder.id,
            note: `Reserved ${line.quantity} unit(s) for ${orderNumber}`,
            actorId: owner.userId,
          },
        });
      }

      // Optionally save shipping address to customer's account book
      if (owner.userId && input.saveAddressToAccount) {
        const existingAddressCount = await tx.address.count({ where: { userId: owner.userId } });
        await tx.address.create({
          data: {
            userId: owner.userId,
            fullName: input.shippingAddress.fullName,
            phone: input.shippingAddress.phone,
            line1: input.shippingAddress.line1,
            line2: input.shippingAddress.line2,
            city: input.shippingAddress.city,
            state: input.shippingAddress.state,
            postalCode: input.shippingAddress.postalCode,
            country: input.shippingAddress.country,
            isDefaultShipping: existingAddressCount === 0,
            isDefaultBilling: existingAddressCount === 0 && input.billingSameAsShipping,
          },
        });
      }

      // Clear cart lines atomically inside the same order creation transaction
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return {
        order: createdOrder,
        productIds: Array.from(new Set(verifiedLines.map((l) => l.productId))),
      };
    },
    { timeout: 10000 },
  );

  // Create provider payment intent outside DB lock; compensate synchronously if provider throws
  const adapter = getPaymentProvider();
  let paymentIntent: CreatePaymentIntentResult;
  try {
    paymentIntent = await adapter.createPaymentIntent({
      orderId: txResult.order.id,
      orderNumber: txResult.order.orderNumber,
      amountDecimal: txResult.order.total.toFixed(2),
      currency: txResult.order.currency,
      customerEmail: input.email,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (err) {
    logger.error(
      { orderId: txResult.order.id, orderNumber: txResult.order.orderNumber, err },
      "Payment intent creation failed; releasing stock reservation synchronously.",
    );
    await db.$transaction(async (tx) => {
      await releaseOrderReservationById(
        tx,
        txResult.order.id,
        "CANCELLED",
        "Payment gateway unavailable; stock reservation released automatically.",
      );
    });
    throw new PaymentError(
      "Payment gateway could not be reached. Your bag inventory has not been charged.",
    );
  }

  await db.paymentTransaction.create({
    data: {
      orderId: txResult.order.id,
      provider: paymentIntent.provider,
      providerIntentId: paymentIntent.providerIntentId,
      amount: txResult.order.total,
      currency: txResult.order.currency,
      status: "REQUIRES_PAYMENT",
      rawResponse: (paymentIntent.rawResponse ?? {}) as Prisma.InputJsonValue,
    },
  });

  return {
    orderId: txResult.order.id,
    orderNumber: txResult.order.orderNumber,
    status: txResult.order.status,
    currency: txResult.order.currency,
    subtotal: txResult.order.subtotal.toFixed(2),
    shippingCost: txResult.order.shippingCost.toFixed(2),
    taxAmount: txResult.order.taxAmount.toFixed(2),
    total: txResult.order.total.toFixed(2),
    reservedUntil: txResult.order.reservedUntil?.toISOString() ?? null,
    guestToken: rawGuestToken,
    productIds: txResult.productIds,
    payment: {
      provider: paymentIntent.provider,
      providerIntentId: paymentIntent.providerIntentId,
      clientSecret: paymentIntent.clientSecret,
      razorpayOrderId: paymentIntent.razorpayOrderId,
      keyId: paymentIntent.keyId,
      mode: paymentIntent.mode,
    },
  };
}

export async function retryOrderPayment(
  input: RetryOrderPaymentInput,
  currentUserId: string | null,
): Promise<CreatedOrderResultDTO> {
  const order = await db.order.findUnique({
    where: { orderNumber: input.orderNumber },
    include: {
      user: { select: { email: true } },
      items: { select: { productId: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order) {
    throw new NotFoundError("Order could not be found.");
  }

  const authorized =
    (currentUserId && order.userId === currentUserId) ||
    verifyGuestOrderToken(input.guestToken, order.guestLookupTokenHash);
  if (!authorized) {
    throw new ForbiddenError("You are not authorized to retry payment for this order.");
  }

  if (!isCancellableBeforeSettlement(order.status)) {
    throw new ConflictError(`Order ${order.orderNumber} does not require payment.`);
  }

  if (order.reservedUntil && order.reservedUntil <= new Date()) {
    await db.$transaction((tx) =>
      releaseOrderReservationById(
        tx,
        order.id,
        "CANCELLED",
        "Reservation expired before payment retry could complete.",
      ),
    );
    throw new ConflictError(
      "Your 30-minute reservation expired. Please add these pieces to a new bag to check current availability.",
    );
  }

  const contactEmail = order.user?.email ?? order.guestEmail ?? env.EMAIL_FROM;
  const adapter = getPaymentProvider(order.payments[0]?.provider);
  const retryIdempotencyKey = `${order.id}_retry_${createId().slice(0, 10)}`;

  const paymentIntent = await adapter.createPaymentIntent({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amountDecimal: order.total.toFixed(2),
    currency: order.currency,
    customerEmail: contactEmail,
    idempotencyKey: retryIdempotencyKey,
  });

  await db.paymentTransaction.create({
    data: {
      orderId: order.id,
      provider: paymentIntent.provider,
      providerIntentId: paymentIntent.providerIntentId,
      amount: order.total,
      currency: order.currency,
      status: "REQUIRES_PAYMENT",
      rawResponse: (paymentIntent.rawResponse ?? {}) as Prisma.InputJsonValue,
    },
  });

  if (order.status === "PAYMENT_FAILED") {
    await db.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: "PENDING_PAYMENT" } });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: "PAYMENT_FAILED",
          toStatus: "PENDING_PAYMENT",
          note: "Customer initiated a new payment attempt.",
          actorId: currentUserId,
        },
      });
    });
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: "PENDING_PAYMENT",
    currency: order.currency,
    subtotal: order.subtotal.toFixed(2),
    shippingCost: order.shippingCost.toFixed(2),
    taxAmount: order.taxAmount.toFixed(2),
    total: order.total.toFixed(2),
    reservedUntil: order.reservedUntil?.toISOString() ?? null,
    guestToken: input.guestToken ?? null,
    productIds: Array.from(new Set(order.items.map((i) => i.productId))),
    payment: {
      provider: paymentIntent.provider,
      providerIntentId: paymentIntent.providerIntentId,
      clientSecret: paymentIntent.clientSecret,
      razorpayOrderId: paymentIntent.razorpayOrderId,
      keyId: paymentIntent.keyId,
      mode: paymentIntent.mode,
    },
  };
}

/**
 * Idempotently handles verified Stripe or Razorpay webhook events.
 * Uses PostgreSQL `ON CONFLICT DO NOTHING` on `(provider, eventId)` + row lock on `Order`
 * so parallel or replayed webhooks can never double-deduct stock or double-send confirmation emails.
 */
export async function processVerifiedWebhookEvent(event: VerifiedWebhookEvent): Promise<{
  duplicate: boolean;
  processedOrderId: string | null;
  productIds: string[];
}> {
  const emailPayloadRef: {
    payload: Parameters<typeof sendOrderConfirmationEmail>[0] | null;
  } = { payload: null };

  const txResult = await db.$transaction(
    async (tx) => {
      const inserted = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "WebhookEvent" (id, provider, "eventId", "eventType", payload, status, "createdAt")
        VALUES (
          ${createId()},
          ${event.provider}::"PaymentProviderType",
          ${event.eventId},
          ${event.eventType},
          ${JSON.stringify(event.rawPayload ?? {})}::jsonb,
          'PROCESSING',
          NOW()
        )
        ON CONFLICT (provider, "eventId") DO NOTHING
        RETURNING id
      `;

      const webhookRow = inserted[0];
      if (!webhookRow) {
        return { duplicate: true, orderId: null, productIds: [] as string[] };
      }

      if (event.status === "ignored") {
        await tx.webhookEvent.update({
          where: { id: webhookRow.id },
          data: { status: "IGNORED", processedAt: new Date() },
        });
        return { duplicate: false, orderId: null, productIds: [] as string[] };
      }

      let orderId = event.orderIdFromMetadata;
      if (!orderId && event.intentId) {
        const paymentRow = await tx.paymentTransaction.findUnique({
          where: { providerIntentId: event.intentId },
          select: { orderId: true },
        });
        orderId = paymentRow?.orderId ?? null;
      }

      if (!orderId) {
        await tx.webhookEvent.update({
          where: { id: webhookRow.id },
          data: {
            status: "UNMATCHED",
            error: "No matching order or payment intent found.",
            processedAt: new Date(),
          },
        });
        return { duplicate: false, orderId: null, productIds: [] as string[] };
      }

      const lockedOrders = await tx.$queryRaw<
        Array<{
          id: string;
          orderNumber: string;
          status: OrderStatus;
          currency: string;
          subtotal: Prisma.Decimal;
          shippingCost: Prisma.Decimal;
          taxAmount: Prisma.Decimal;
          total: Prisma.Decimal;
          signatureRequired: boolean;
          userId: string | null;
          guestEmail: string | null;
          shippingAddress: Prisma.JsonValue;
        }>
      >`
        SELECT id,
               "orderNumber",
               status,
               currency,
               subtotal,
               "shippingCost",
               "taxAmount",
               total,
               "signatureRequired",
               "userId",
               "guestEmail",
               "shippingAddress"
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `;

      const lockedOrder = lockedOrders[0];
      if (!lockedOrder) {
        await tx.webhookEvent.update({
          where: { id: webhookRow.id },
          data: { status: "NOT_FOUND", processedAt: new Date() },
        });
        return { duplicate: false, orderId: null, productIds: [] as string[] };
      }

      const orderItems = await tx.orderItem.findMany({
        where: { orderId },
        orderBy: { variantId: "asc" },
      });
      const productIds = Array.from(new Set(orderItems.map((i) => i.productId)));

      if (event.status === "succeeded") {
        if (event.intentId) {
          await tx.paymentTransaction.updateMany({
            where: { providerIntentId: event.intentId },
            data: {
              status: "SUCCEEDED",
              providerChargeId: event.chargeId ?? undefined,
            },
          });
        }

        if (isCancellableBeforeSettlement(lockedOrder.status)) {
          // Normal reservation settlement: deduct stockQty and release reservedQty together
          for (const item of orderItems) {
            const updatedVariants = await tx.$queryRaw<
              Array<{ stockQty: number; reservedQty: number }>
            >`
              UPDATE "ProductVariant"
              SET "stockQty" = GREATEST(0, "stockQty" - ${item.quantity}),
                  "reservedQty" = GREATEST(0, "reservedQty" - LEAST("reservedQty", ${item.quantity})),
                  "updatedAt" = NOW()
              WHERE id = ${item.variantId}
              RETURNING "stockQty", "reservedQty"
            `;

            const uv = updatedVariants[0];
            if (uv) {
              await tx.inventoryTransaction.create({
                data: {
                  variantId: item.variantId,
                  reason: "SALE",
                  delta: -item.quantity,
                  balanceAfter: Math.max(0, uv.stockQty - uv.reservedQty),
                  referenceType: "ORDER",
                  referenceId: lockedOrder.id,
                  note: `Settled sale for ${lockedOrder.orderNumber}`,
                },
              });
            }
          }

          await tx.order.update({
            where: { id: lockedOrder.id },
            data: {
              status: "PAID",
              paidAt: new Date(),
              reservedUntil: null,
            },
          });

          await tx.orderEvent.create({
            data: {
              orderId: lockedOrder.id,
              fromStatus: lockedOrder.status,
              toStatus: "PAID",
              note: `Payment settled via ${event.provider}.`,
            },
          });

          let recipientEmail = lockedOrder.guestEmail;
          let recipientName =
            ((lockedOrder.shippingAddress as Record<string, unknown> | null)?.fullName as
              string | undefined) ?? "Valued Patron";
          if (!recipientEmail && lockedOrder.userId) {
            const user = await tx.user.findUnique({
              where: { id: lockedOrder.userId },
              select: { email: true, name: true },
            });
            recipientEmail = user?.email ?? null;
            if (user?.name) recipientName = user.name;
          }

          if (recipientEmail) {
            emailPayloadRef.payload = {
              to: recipientEmail,
              recipientName,
              orderNumber: lockedOrder.orderNumber,
              lines: orderItems.map((item) => ({
                title: item.titleSnapshot,
                variantTitle: item.variantTitleSnapshot,
                quantity: item.quantity,
                lineTotalFormatted: formatMoneyExact(
                  item.lineTotal.toFixed(2),
                  lockedOrder.currency,
                ),
              })),
              subtotalFormatted: formatMoneyExact(
                lockedOrder.subtotal.toFixed(2),
                lockedOrder.currency,
              ),
              shippingFormatted:
                lockedOrder.shippingCost.toFixed(2) === "0.00"
                  ? "Complimentary"
                  : formatMoneyExact(lockedOrder.shippingCost.toFixed(2), lockedOrder.currency),
              taxFormatted: formatMoneyExact(
                lockedOrder.taxAmount.toFixed(2),
                lockedOrder.currency,
              ),
              totalFormatted: formatMoneyExact(lockedOrder.total.toFixed(2), lockedOrder.currency),
              trackingUrl: `${env.NEXT_PUBLIC_SITE_URL}/orders/track`,
              signatureRequired: lockedOrder.signatureRequired,
            };
          }
        } else if (lockedOrder.status === "CANCELLED") {
          await tx.orderEvent.create({
            data: {
              orderId: lockedOrder.id,
              fromStatus: "CANCELLED",
              toStatus: "CANCELLED",
              note: "Late payment webhook received after reservation expired; review required for fulfillment or refund.",
            },
          });
        }
      } else if (event.status === "failed") {
        if (event.intentId) {
          await tx.paymentTransaction.updateMany({
            where: { providerIntentId: event.intentId },
            data: { status: "FAILED" },
          });
        }

        if (lockedOrder.status === "PENDING_PAYMENT") {
          await releaseOrderReservationById(
            tx,
            lockedOrder.id,
            "PAYMENT_FAILED",
            event.failureReason ??
              "Payment authorization declined; customer may retry within reservation window.",
          );
        }
      } else if (event.status === "refunded") {
        if (lockedOrder.status !== "REFUNDED" && lockedOrder.status !== "CANCELLED") {
          await tx.order.update({
            where: { id: lockedOrder.id },
            data: {
              status: "REFUNDED",
              refundedAt: new Date(),
              refundedAmount: lockedOrder.total,
            },
          });
          await tx.orderEvent.create({
            data: {
              orderId: lockedOrder.id,
              fromStatus: lockedOrder.status,
              toStatus: "REFUNDED",
              note: `Refund processed via ${event.provider} webhook.`,
            },
          });
        }
      }

      await tx.webhookEvent.update({
        where: { id: webhookRow.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });

      return { duplicate: false, orderId: lockedOrder.id, productIds };
    },
    { timeout: 10000 },
  );

  // Send order confirmation email safely outside transaction so local SMTP downtime never fails settlement
  if (emailPayloadRef.payload) {
    try {
      await sendOrderConfirmationEmail(emailPayloadRef.payload);
    } catch (emailErr) {
      logger.warn(
        { orderNumber: emailPayloadRef.payload.orderNumber, emailErr },
        "Order confirmation email failed to dispatch cleanly; order settlement preserved.",
      );
    }
  }

  return {
    duplicate: txResult.duplicate,
    processedOrderId: txResult.orderId,
    productIds: txResult.productIds,
  };
}

/**
 * Sandbox-only test harness endpoint (strictly disabled unless PAYMENT_TEST_SANDBOX="true")
 * that emits a cryptographically signed webhook payload through the real webhook pipeline.
 */
export async function confirmSandboxOrderPayment(
  input: ConfirmSandboxPaymentInput,
  currentUserId: string | null,
) {
  if (env.PAYMENT_TEST_SANDBOX !== "true") {
    throw new ForbiddenError("Test payment simulation is disabled when sandbox mode is off.");
  }

  const order = await db.order.findUnique({
    where: { orderNumber: input.orderNumber },
    include: {
      items: { select: { productId: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order) {
    throw new NotFoundError("Order could not be found.");
  }

  const authorized =
    (currentUserId && order.userId === currentUserId) ||
    verifyGuestOrderToken(input.guestToken, order.guestLookupTokenHash);
  if (!authorized) {
    throw new ForbiddenError("You are not authorized to confirm this order.");
  }

  const latestPayment = order.payments[0];
  if (!latestPayment) {
    throw new ConflictError("No payment attempt found for this order.");
  }

  const adapter = getPaymentProvider(latestPayment.provider);

  if (latestPayment.provider === "RAZORPAY") {
    const signed = buildSignedSandboxRazorpayWebhook({
      eventType: input.outcome === "succeed" ? "payment.captured" : "payment.failed",
      razorpayOrderId: latestPayment.providerIntentId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      failureMessage: input.outcome === "fail" ? "Card declined in test sandbox." : undefined,
    });
    const verified = await adapter.verifyWebhookSignature(signed.rawBody, signed.signatureHeader);
    await processVerifiedWebhookEvent(verified);
  } else {
    const signed = buildSignedSandboxStripeWebhook({
      eventType:
        input.outcome === "succeed" ? "payment_intent.succeeded" : "payment_intent.payment_failed",
      intentId: latestPayment.providerIntentId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      failureMessage: input.outcome === "fail" ? "Card declined in test sandbox." : undefined,
    });
    const verified = await adapter.verifyWebhookSignature(signed.rawBody, signed.signatureHeader);
    await processVerifiedWebhookEvent(verified);
  }

  const updated = await db.order.findUniqueOrThrow({
    where: { id: order.id },
    select: { status: true, orderNumber: true },
  });

  return {
    orderNumber: updated.orderNumber,
    status: updated.status,
    productIds: Array.from(new Set(order.items.map((i) => i.productId))),
  };
}

export async function releaseExpiredOrderReservations(batchSize = 50): Promise<{
  releasedCount: number;
  orderNumbers: string[];
  productIds: string[];
}> {
  const candidates = await db.order.findMany({
    where: {
      status: { in: ["PENDING_PAYMENT", "PAYMENT_FAILED"] },
      reservedUntil: { lte: new Date() },
    },
    orderBy: { reservedUntil: "asc" },
    take: batchSize,
    select: {
      id: true,
      orderNumber: true,
      items: { select: { productId: true } },
    },
  });

  const releasedOrderNumbers: string[] = [];
  const affectedProductIds = new Set<string>();

  for (const candidate of candidates) {
    const didRelease = await db.$transaction((tx) =>
      releaseOrderReservationById(
        tx,
        candidate.id,
        "CANCELLED",
        "Stock reservation expired after 30 minutes without settled payment.",
      ),
    );
    if (didRelease) {
      releasedOrderNumbers.push(candidate.orderNumber);
      for (const item of candidate.items) {
        affectedProductIds.add(item.productId);
      }
    }
  }

  return {
    releasedCount: releasedOrderNumbers.length,
    orderNumbers: releasedOrderNumbers,
    productIds: Array.from(affectedProductIds),
  };
}

export async function getOrderConfirmation(
  orderNumber: string,
  guestToken: string | null | undefined,
): Promise<OrderConfirmationDTO> {
  const [session, settings, order] = await Promise.all([
    getOptionalSession(),
    getPublicStoreSettings(),
    db.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        events: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  if (!order) {
    throw new NotFoundError("Order confirmation record was not found.");
  }

  const isOwner = Boolean(session?.user && order.userId && order.userId === session.user.id);
  const isStaff = session?.user.role === "ADMIN" || session?.user.role === "STAFF";
  const hasValidToken = verifyGuestOrderToken(guestToken, order.guestLookupTokenHash);

  if (!isOwner && !isStaff && !hasValidToken) {
    throw new ForbiddenError(
      "Use the private confirmation link or sign into the purchasing account to view this order.",
    );
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    subtotal: order.subtotal.toFixed(2),
    shippingCost: order.shippingCost.toFixed(2),
    taxAmount: order.taxAmount.toFixed(2),
    discountAmount: order.discountAmount.toFixed(2),
    total: order.total.toFixed(2),
    shippingMethodName: order.shippingMethodName,
    shippingAddress: order.shippingAddress as unknown as CheckoutAddressInput,
    billingAddress: order.billingAddress as unknown as CheckoutAddressInput,
    giftNote: order.giftNote,
    signatureRequired: order.signatureRequired,
    reservedUntil: order.reservedUntil?.toISOString() ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    trackingNumber: order.trackingNumber,
    carrier: order.carrier,
    trackingUrl: order.trackingUrl,
    createdAt: order.createdAt.toISOString(),
    contactEmail: settings.contactEmail,
    sandboxMode: env.PAYMENT_TEST_SANDBOX === "true",
    paymentProvider: order.payments[0]?.provider ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      skuSnapshot: item.skuSnapshot,
      titleSnapshot: item.titleSnapshot,
      variantTitleSnapshot: item.variantTitleSnapshot,
      imageUrlSnapshot: item.imageUrlSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
    events: order.events.map((evt) => ({
      id: evt.id,
      toStatus: evt.toStatus,
      note: evt.note,
      createdAt: evt.createdAt.toISOString(),
    })),
  };
}

export async function resolveCheckoutActorsForAction() {
  const [session, guestToken] = await Promise.all([
    getOptionalSession(),
    readGuestTokenFromCookies(),
  ]);
  const cartOwner: CartOwner | null = session?.user
    ? { kind: "user", userId: session.user.id }
    : guestToken
      ? { kind: "guest", guestToken }
      : null;

  return {
    userId: session?.user.id ?? null,
    cartOwner,
  };
}
