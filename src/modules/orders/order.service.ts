import "server-only";
import crypto from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentProviderType } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import {
  convertAmountFromBase,
  resolveGatewayChargeTarget,
  type PublicCurrencyDTO,
} from "@/lib/currency";
import {
  formatMoneyExact,
  fromMinorUnits,
  multiplyMoney,
  toDecimal,
  toMinorUnits,
} from "@/lib/money";
import { getCurrentCartSummary, type CartOwner } from "@/modules/cart/cart.service";
import {
  getServerRequestCurrency,
  resolveActiveCurrencyByCode,
} from "@/modules/currencies/currency.service";
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
import { parseOrderCustomizationSnapshot } from "@/modules/customization/customization.validation";
import { getOptionalSession } from "@/server/dal";
import { db } from "@/server/db";
import { sendCustomizationOrderPlacedEmail } from "@/server/email/customization-send";
import {
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendPaymentAlertEmail,
} from "@/server/email/send";
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

export function createOrderTrackToken(orderNumber: string, ttlSeconds = 2 * 60 * 60): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${orderNumber.toUpperCase()}.${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`track_order:${payload}`)
    .digest("hex");
  return `trk_${expiresAt}.${sig}`;
}

export function verifyOrderTrackToken(
  orderNumber: string,
  rawToken: string | null | undefined,
): boolean {
  if (!rawToken || !rawToken.startsWith("trk_")) return false;
  const rest = rawToken.slice(4);
  const dotIdx = rest.indexOf(".");
  if (dotIdx <= 0) return false;
  const expStr = rest.slice(0, dotIdx);
  const sig = rest.slice(dotIdx + 1);
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expectedSig = crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`track_order:${orderNumber.toUpperCase()}.${exp}`)
    .digest("hex");
  const candBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (candBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(candBuf, expBuf);
}

export function hasValidGuestOrderAccess(
  orderNumber: string,
  guestToken: string | null | undefined,
  storedHash: string | null | undefined,
): boolean {
  return (
    verifyGuestOrderToken(guestToken, storedHash) || verifyOrderTrackToken(orderNumber, guestToken)
  );
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
  currencies: PublicCurrencyDTO[];
  selectedCurrency: PublicCurrencyDTO;
  shippingZones: ShippingZoneDTO[];
  initialQuote: CheckoutQuoteDTO | null;
  chargeInBaseFallback: boolean;
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
  currencyDecimals: number;
  baseCurrency: string;
  exchangeRate: string;
  subtotal: string;
  shippingCost: string;
  taxAmount: string;
  total: string;
  baseTotal: string;
  chargedCurrency: string;
  chargedAmount: string;
  chargeInBaseFallback: boolean;
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
  currencyDecimals: number;
  baseCurrency: string;
  exchangeRate: string;
  subtotal: string;
  shippingCost: string;
  taxAmount: string;
  discountAmount: string;
  total: string;
  baseSubtotal: string;
  baseShippingCost: string;
  baseTaxAmount: string;
  baseDiscountAmount: string;
  baseTotal: string;
  chargedCurrency: string;
  chargedAmount: string | null;
  refundedAmount: string;
  refundedAt: string | null;
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
  paymentStatus: string | null;
  items: Array<{
    id: string;
    productId: string;
    productSlug: string | null;
    variantId: string;
    skuSnapshot: string;
    titleSnapshot: string;
    variantTitleSnapshot: string;
    imageUrlSnapshot: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    customizationRequestId?: string | null;
    customizationRequestNumber?: string | null;
    customizationSummaryLines?: Array<{ label: string; value: string }>;
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
        legalName: settingsRow.legalName ?? null,
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
        requireAdminTwoFactor: settingsRow.requireAdminTwoFactor,
        seoDefaultTitlePattern: settingsRow.seoDefaultTitlePattern,
        seoDefaultDescription: settingsRow.seoDefaultDescription,
        defaultOgImageUrl: settingsRow.defaultOgImageUrl,
        seoTemplates: null,
        seoSettings: null,
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
  const [cart, settings, shippingZones, session, currencyCtx] = await Promise.all([
    getCurrentCartSummary(),
    getPublicStoreSettings(),
    getAllShippingZones(true),
    getOptionalSession(),
    getServerRequestCurrency(),
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

  const defaultAddr = savedAddresses.find((a) => a.isDefaultShipping) ?? savedAddresses[0];
  const defaultCountry = defaultAddr?.country ?? settings.defaultCountry;
  const quoteRes =
    cart.items.length > 0
      ? calculateCheckoutQuote({
          items: cart.items,
          shippingCountry: defaultCountry,
          zones: shippingZones,
          settings,
          targetCurrency: currencyCtx.currency,
        })
      : null;

  const paymentConfig = getCheckoutPaymentClientConfig();
  const chargeTarget = resolveGatewayChargeTarget({
    provider: paymentConfig.provider,
    orderCurrency: currencyCtx.currency.code,
    orderTotal: quoteRes?.ok ? quoteRes.quote.total : "0",
    baseCurrency: settings.currency,
    baseTotal: quoteRes?.ok ? quoteRes.quote.baseTotal : "0",
  });

  return {
    cart,
    settings,
    currencies: currencyCtx.currencies,
    selectedCurrency: currencyCtx.currency,
    shippingZones,
    initialQuote: quoteRes?.ok ? quoteRes.quote : null,
    chargeInBaseFallback: chargeTarget.chargeInBaseFallback,
    userEmail: session?.user.email ?? null,
    userName: session?.user.name ?? null,
    savedAddresses,
    paymentConfig,
  };
}

/** Payment statuses that mean "this intent can still be charged". */
const OPEN_PAYMENT_STATUSES = ["REQUIRES_PAYMENT"];
/** Statuses whose provider session could still be confirmed by the customer (a declined Stripe
 * intent accepts a new card), so they must be voided before abandoning them. */
const VOIDABLE_PAYMENT_STATUSES = ["REQUIRES_PAYMENT", "FAILED"];
/** Payment statuses for captures that were automatically refunded (not part of order totals). */
const AUTO_REFUND_STATUSES = ["REFUND_PENDING", "AUTO_REFUNDED", "REFUND_FAILED"];

type PaymentFollowUp =
  | {
      kind: "alert";
      orderId: string;
      orderNumber: string;
      title: string;
      message: string;
    }
  | {
      kind: "refund";
      orderId: string;
      orderNumber: string;
      orderStatus: OrderStatus;
      paymentId: string;
      provider: PaymentProviderType;
      providerIntentId: string;
      providerChargeId: string | null;
      amountDecimal: string;
      currency: string;
      reason: string;
      customerEmail: string | null;
      customerName: string;
    };

/**
 * Verifies a captured amount against the PaymentTransaction we created. Returns a human-readable
 * problem, or null when it matches. Sandbox events may omit amounts.
 */
function describeCapturedAmountIssue(
  event: VerifiedWebhookEvent,
  payment: { amount: Prisma.Decimal; currency: string; provider: PaymentProviderType } | null,
): string | null {
  if (!payment) {
    return "captured payment does not match any payment attempt on this order";
  }
  if (event.amountMinor === null) {
    return env.PAYMENT_TEST_SANDBOX === "true" ? null : "provider did not report a captured amount";
  }
  const expectedCurrency = payment.currency.toUpperCase();
  if (event.currency && event.currency !== expectedCurrency) {
    return `captured currency ${event.currency} differs from expected ${expectedCurrency}`;
  }
  const expectedMinor = toMinorUnits(
    payment.amount.toString(),
    expectedCurrency,
    payment.provider === "STRIPE",
  );
  if (event.amountMinor !== expectedMinor) {
    return `captured ${event.amountMinor} minor units but expected ${expectedMinor} ${expectedCurrency}`;
  }
  return null;
}

/**
 * Voids every still-chargeable intent on an order (best effort, outside DB transactions).
 * Returns true if any intent turned out to be already captured; the webhook settles or refunds it.
 */
async function voidOpenPaymentIntents(orderId: string): Promise<boolean> {
  const open = await db.paymentTransaction.findMany({
    where: { orderId, status: { in: VOIDABLE_PAYMENT_STATUSES } },
    select: { id: true, provider: true, providerIntentId: true },
  });
  let capturedMeanwhile = false;
  for (const payment of open) {
    try {
      const voided = await getPaymentProvider(payment.provider).cancelPaymentIntent(
        payment.providerIntentId,
      );
      if (voided) {
        await db.paymentTransaction.updateMany({
          where: { id: payment.id, status: { in: VOIDABLE_PAYMENT_STATUSES } },
          data: { status: "CANCELLED" },
        });
      } else {
        capturedMeanwhile = true;
      }
    } catch (err) {
      logger.error(
        { orderId, providerIntentId: payment.providerIntentId, err },
        "Could not void payment intent; a late capture will be auto-refunded by the webhook.",
      );
    }
  }
  return capturedMeanwhile;
}

/** Runs refunds and alerts collected during webhook processing, after the DB commit. */
async function runPaymentFollowUps(followUps: PaymentFollowUp[]): Promise<void> {
  for (const followUp of followUps) {
    if (followUp.kind === "alert") {
      await sendPaymentAlertEmail(followUp).catch((err) =>
        logger.error({ orderNumber: followUp.orderNumber, err }, "Payment alert email failed."),
      );
      continue;
    }

    const amountLabel = formatMoneyExact(followUp.amountDecimal, followUp.currency);
    try {
      const refund = await getPaymentProvider(followUp.provider).createRefund({
        providerIntentId: followUp.providerIntentId,
        providerChargeId: followUp.providerChargeId,
        amountDecimal: followUp.amountDecimal,
        currency: followUp.currency,
        reason: followUp.reason,
      });
      await db.$transaction([
        db.paymentTransaction.update({
          where: { id: followUp.paymentId },
          data: { status: "AUTO_REFUNDED" },
        }),
        db.orderEvent.create({
          data: {
            orderId: followUp.orderId,
            fromStatus: followUp.orderStatus,
            toStatus: followUp.orderStatus,
            note: `Automatic refund ${amountLabel} issued (${refund.refundId}): ${followUp.reason}`,
          },
        }),
      ]);
      if (followUp.customerEmail) {
        await sendOrderStatusEmail({
          to: followUp.customerEmail,
          recipientName: followUp.customerName,
          orderNumber: followUp.orderNumber,
          statusLabel: "Payment refunded",
          message: `We received a payment of ${amountLabel} that could not be applied to this order, so it has been refunded in full to your original payment method. Refunds usually appear within 5–10 business days. No action is needed.`,
          orderUrl: `${env.NEXT_PUBLIC_SITE_URL}/orders/track`,
        }).catch((err) =>
          logger.warn({ orderNumber: followUp.orderNumber, err }, "Refund email failed."),
        );
      }
      await sendPaymentAlertEmail({
        orderId: followUp.orderId,
        orderNumber: followUp.orderNumber,
        title: "Payment auto-refunded",
        message: `${amountLabel} was captured but could not be applied (${followUp.reason}). It was refunded automatically (${refund.refundId}). No action needed.`,
      }).catch(() => undefined);
    } catch (err) {
      logger.error(
        { orderNumber: followUp.orderNumber, providerIntentId: followUp.providerIntentId, err },
        "Automatic refund failed; manual refund required.",
      );
      await db
        .$transaction([
          db.paymentTransaction.update({
            where: { id: followUp.paymentId },
            data: { status: "REFUND_FAILED" },
          }),
          db.orderEvent.create({
            data: {
              orderId: followUp.orderId,
              fromStatus: followUp.orderStatus,
              toStatus: followUp.orderStatus,
              note: `Automatic refund of ${amountLabel} FAILED. Refund manually in the ${followUp.provider} dashboard (${followUp.providerIntentId}).`,
            },
          }),
        ])
        .catch(() => undefined);
      await sendPaymentAlertEmail({
        orderId: followUp.orderId,
        orderNumber: followUp.orderNumber,
        title: "ACTION REQUIRED: automatic refund failed",
        message: `${amountLabel} was captured (${followUp.reason}) and the automatic refund failed. Refund it manually in the ${followUp.provider} dashboard: ${followUp.providerIntentId}.`,
      }).catch(() => undefined);
    }
  }
}

/** Extracts the provider refund id (Razorpay refund entity) for de-duplication. */
function extractRefundId(rawPayload: unknown): string | null {
  const payload = (rawPayload as { payload?: { refund?: { entity?: { id?: unknown } } } })?.payload;
  const id = payload?.refund?.entity?.id;
  return typeof id === "string" ? id : null;
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
    select: { variantId: true, quantity: true, customizationRequestId: true },
  });

  if (targetStatus === "CANCELLED") {
    const txEntries: Array<{
      variantId: string;
      reason: "RELEASE";
      delta: number;
      balanceAfter: number;
      referenceType: "ORDER";
      referenceId: string;
      note: string;
      actorId: string | null;
    }> = [];

    for (const item of orderItems) {
      if (item.customizationRequestId) {
        continue;
      }
      const updatedVariants = await tx.$queryRaw<Array<{ stockQty: number; reservedQty: number }>>`
        UPDATE "ProductVariant"
        SET "reservedQty" = GREATEST(0, "reservedQty" - ${item.quantity}),
            "updatedAt" = NOW()
        WHERE id = ${item.variantId}
        RETURNING "stockQty", "reservedQty"
      `;

      const uv = updatedVariants[0];
      if (uv) {
        txEntries.push({
          variantId: item.variantId,
          reason: "RELEASE",
          delta: item.quantity,
          balanceAfter: Math.max(0, uv.stockQty - uv.reservedQty),
          referenceType: "ORDER",
          referenceId: orderId,
          note,
          actorId: actorId ?? null,
        });
      }
    }

    if (txEntries.length > 0) {
      await tx.inventoryTransaction.createMany({ data: txEntries });
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
  try {
    return await createOrderAndPaymentOnce(input, owner);
  } catch (err) {
    // Two truly concurrent submits with the same key: the loser replays the winner's order.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await db.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true },
      });
      if (winner) return createOrderAndPaymentOnce(input, owner);
    }
    throw err;
  }
}

async function createOrderAndPaymentOnce(
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

    if (!isCancellableBeforeSettlement(existingOrder.status) && existingOrder.status !== "PAID") {
      throw new ConflictError(
        "This checkout attempt has expired. Please review your bag and place the order again.",
      );
    }

    const latestPayment = existingOrder.payments[0];
    if (latestPayment) {
      const paymentConfig = getCheckoutPaymentClientConfig();
      // Replayed submit (double tap / network retry): hand back a usable payment session.
      const recoveredClientSecret =
        latestPayment.provider === "STRIPE" && isCancellableBeforeSettlement(existingOrder.status)
          ? await getPaymentProvider("STRIPE")
              .getClientSecret(latestPayment.providerIntentId)
              .catch(() => null)
          : null;
      const dp = existingOrder.currencyDecimals ?? 2;
      const chargedCurr = existingOrder.chargedCurrency || existingOrder.currency;
      const chargedAmt = (existingOrder.chargedAmount ?? existingOrder.total).toFixed(
        chargedCurr === existingOrder.currency ? dp : 2,
      );
      return {
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        status: existingOrder.status,
        currency: existingOrder.currency,
        currencyDecimals: dp,
        baseCurrency: existingOrder.baseCurrency,
        exchangeRate: existingOrder.exchangeRate.toFixed(8),
        subtotal: existingOrder.subtotal.toFixed(dp),
        shippingCost: existingOrder.shippingCost.toFixed(dp),
        taxAmount: existingOrder.taxAmount.toFixed(dp),
        total: existingOrder.total.toFixed(dp),
        baseTotal: existingOrder.baseTotal.toFixed(2),
        chargedCurrency: chargedCurr,
        chargedAmount: chargedAmt,
        chargeInBaseFallback: chargedCurr !== existingOrder.currency,
        reservedUntil: existingOrder.reservedUntil?.toISOString() ?? null,
        guestToken: null,
        productIds: Array.from(new Set(existingOrder.items.map((i) => i.productId))),
        payment: {
          provider: latestPayment.provider,
          providerIntentId: latestPayment.providerIntentId,
          clientSecret: recoveredClientSecret,
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

  const resolvedCurrCtx = input.currency
    ? await resolveActiveCurrencyByCode(input.currency)
    : await getServerRequestCurrency();
  const targetCurrency = resolvedCurrCtx.currency;
  const adapter = getPaymentProvider();

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
            select: {
              variantId: true,
              quantity: true,
              customizationRequestId: true,
              customizationSnapshot: true,
              customUnitPriceBase: true,
            },
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
        baseUnitPrice: string;
        baseLineTotal: string;
        unitPrice: string;
        lineTotal: string;
        isCustomized: boolean;
        customizationRequestId: string | null;
        customizationSnapshot: Prisma.InputJsonValue | null;
        quotedBasePrice: string | null;
        quoteCurrency: string | null;
        quoteExchangeRate: string | null;
      }> = [];

      const dp = Math.min(4, Math.max(0, Math.trunc(targetCurrency.decimalPlaces)));
      const isBaseTarget =
        targetCurrency.code === settings.currency.trim().toUpperCase() &&
        Number(targetCurrency.exchangeRate) === 1;

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

        let baseUnitPrice: ReturnType<typeof toDecimal>;
        let isCustomized = false;
        let customizationRequestId: string | null = null;
        let customizationSnapshot: Prisma.InputJsonValue | null = null;
        let quotedBasePrice: string | null = null;

        if (cartItem.customizationRequestId) {
          const lockedCustomRows = await tx.$queryRaw<
            Array<{
              id: string;
              requestNumber: string;
              status: string;
              quotedPriceBase: Prisma.Decimal | null;
              quoteExpiresAt: Date | null;
              userId: string | null;
              guestToken: string | null;
            }>
          >`
            SELECT id, "requestNumber", status, "quotedPriceBase", "quoteExpiresAt", "userId", "guestToken"
            FROM "customization_requests"
            WHERE id = ${cartItem.customizationRequestId}
            FOR UPDATE
          `;
          const custReq = lockedCustomRows[0];
          if (!custReq || custReq.status !== "ACCEPTED" || custReq.quotedPriceBase === null) {
            throw new ConflictError(
              `Bespoke quotation for ${variant.productName} is no longer active or already ordered.`,
            );
          }
          if (custReq.quoteExpiresAt && custReq.quoteExpiresAt < new Date()) {
            throw new ConflictError(
              `Quotation ${custReq.requestNumber} for ${variant.productName} has expired.`,
            );
          }
          if (custReq.userId && owner.userId !== custReq.userId) {
            throw new ForbiddenError("You are not authorized to purchase this bespoke quotation.");
          }
          isCustomized = true;
          customizationRequestId = custReq.id;
          customizationSnapshot =
            (cartItem.customizationSnapshot as Prisma.InputJsonValue | null) ?? null;
          baseUnitPrice = toDecimal(custReq.quotedPriceBase.toString(), 2);
          quotedBasePrice = baseUnitPrice.toFixed(2);
        } else {
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

          baseUnitPrice = toDecimal((variant.priceOverride ?? variant.basePrice).toString(), 2);
        }

        const effectiveQty = isCustomized ? 1 : cartItem.quantity;
        const baseLineTotal = multiplyMoney(baseUnitPrice, effectiveQty, 2);
        const convertedUnit = isBaseTarget
          ? baseUnitPrice
          : convertAmountFromBase(baseUnitPrice, targetCurrency);
        const convertedLineTotal = multiplyMoney(convertedUnit, effectiveQty, dp);

        verifiedLines.push({
          variantId: variant.id,
          productId: variant.productId,
          skuSnapshot: variant.sku,
          titleSnapshot: variant.productName,
          variantTitleSnapshot: isCustomized
            ? `${variant.title} (Bespoke Custom Specification)`
            : variant.title,
          imageUrlSnapshot: imageByProductId.get(variant.productId) ?? null,
          quantity: effectiveQty,
          baseUnitPrice: baseUnitPrice.toFixed(2),
          baseLineTotal: baseLineTotal.toFixed(2),
          unitPrice: convertedUnit.toFixed(dp),
          lineTotal: convertedLineTotal.toFixed(dp),
          isCustomized,
          customizationRequestId,
          customizationSnapshot,
          quotedBasePrice,
          quoteCurrency: isCustomized ? targetCurrency.code : null,
          quoteExchangeRate: isCustomized ? targetCurrency.exchangeRate : null,
        });
      }

      const quoteResult = calculateCheckoutQuote({
        items: verifiedLines.map((line) => ({
          unitPrice: line.baseUnitPrice,
          quantity: line.quantity,
          lineTotal: line.baseLineTotal,
        })),
        shippingCountry: input.shippingAddress.country,
        shippingZoneId: input.shippingZoneId,
        zones,
        settings,
        targetCurrency,
      });

      if (!quoteResult.ok) {
        throw new ValidationError(quoteResult.message);
      }
      const { quote } = quoteResult;
      const chargeTarget = resolveGatewayChargeTarget({
        provider: adapter.provider,
        orderCurrency: quote.currency,
        orderTotal: quote.total,
        baseCurrency: quote.baseCurrency,
        baseTotal: quote.baseTotal,
      });

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
          currencyDecimals: quote.currencyDecimals,
          baseCurrency: quote.baseCurrency,
          exchangeRate: new Prisma.Decimal(quote.exchangeRate),
          subtotal: new Prisma.Decimal(quote.subtotal),
          shippingCost: new Prisma.Decimal(quote.shippingCost),
          taxAmount: new Prisma.Decimal(quote.taxAmount),
          taxRateSnapshot: new Prisma.Decimal(quote.taxRateDecimal),
          discountAmount: new Prisma.Decimal("0.00"),
          total: new Prisma.Decimal(quote.total),
          baseSubtotal: new Prisma.Decimal(quote.baseSubtotal),
          baseShippingCost: new Prisma.Decimal(quote.baseShippingCost),
          baseTaxAmount: new Prisma.Decimal(quote.baseTaxAmount),
          baseDiscountAmount: new Prisma.Decimal("0.00"),
          baseTotal: new Prisma.Decimal(quote.baseTotal),
          chargedCurrency: chargeTarget.chargedCurrency,
          chargedAmount: new Prisma.Decimal(chargeTarget.chargedAmount),
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
              customizationRequestId: line.customizationRequestId,
              customizationSnapshot: line.customizationSnapshot ?? Prisma.JsonNull,
              quotedBasePrice: line.quotedBasePrice
                ? new Prisma.Decimal(line.quotedBasePrice)
                : null,
              quoteCurrency: line.quoteCurrency,
              quoteExchangeRate: line.quoteExchangeRate
                ? new Prisma.Decimal(line.quoteExchangeRate)
                : null,
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
          currencyDecimals: true,
          baseCurrency: true,
          exchangeRate: true,
          subtotal: true,
          shippingCost: true,
          taxAmount: true,
          total: true,
          baseTotal: true,
          chargedCurrency: true,
          chargedAmount: true,
          reservedUntil: true,
        },
      });

      // Increment reservedQty on each locked variant & append INVENTORY RESERVATION ledger rows (skip custom bespoke commissions)
      for (const line of verifiedLines) {
        if (line.isCustomized) {
          continue;
        }
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
        if (existingAddressCount < 10) {
          await tx.address.create({
            data: {
              userId: owner.userId,
              label: "Home",
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
      }

      return {
        cartId: cart.id,
        order: createdOrder,
        chargeInBaseFallback: chargeTarget.chargeInBaseFallback,
        chargedCurrency: chargeTarget.chargedCurrency,
        chargedAmount: chargeTarget.chargedAmount,
        productIds: Array.from(new Set(verifiedLines.map((l) => l.productId))),
      };
    },
    { timeout: 10000 },
  );

  // Create provider payment intent outside DB lock; compensate synchronously if provider throws
  let paymentIntent: CreatePaymentIntentResult;
  try {
    paymentIntent = await adapter.createPaymentIntent({
      orderId: txResult.order.id,
      orderNumber: txResult.order.orderNumber,
      amountDecimal: txResult.chargedAmount,
      currency: txResult.chargedCurrency,
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
    await voidOpenPaymentIntents(txResult.order.id);
    throw new PaymentError(
      "Payment gateway could not be reached. You have not been charged and your bag is unchanged — please try again.",
    );
  }

  // Clear the bag only once a payment session exists, so a gateway outage never empties it.
  await db.cartItem.deleteMany({ where: { cartId: txResult.cartId } });

  await db.paymentTransaction.create({
    data: {
      orderId: txResult.order.id,
      provider: paymentIntent.provider,
      providerIntentId: paymentIntent.providerIntentId,
      amount: new Prisma.Decimal(txResult.chargedAmount),
      currency: txResult.chargedCurrency,
      status: "REQUIRES_PAYMENT",
      rawResponse: {
        ...((paymentIntent.rawResponse as Record<string, unknown> | undefined) ?? {}),
        chargeInBaseFallback: txResult.chargeInBaseFallback,
        orderCurrency: txResult.order.currency,
      } as Prisma.InputJsonValue,
    },
  });

  const dp = txResult.order.currencyDecimals;
  return {
    orderId: txResult.order.id,
    orderNumber: txResult.order.orderNumber,
    status: txResult.order.status,
    currency: txResult.order.currency,
    currencyDecimals: dp,
    baseCurrency: txResult.order.baseCurrency,
    exchangeRate: txResult.order.exchangeRate.toFixed(8),
    subtotal: txResult.order.subtotal.toFixed(dp),
    shippingCost: txResult.order.shippingCost.toFixed(dp),
    taxAmount: txResult.order.taxAmount.toFixed(dp),
    total: txResult.order.total.toFixed(dp),
    baseTotal: txResult.order.baseTotal.toFixed(2),
    chargedCurrency: txResult.chargedCurrency,
    chargedAmount: txResult.chargedAmount,
    chargeInBaseFallback: txResult.chargeInBaseFallback,
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
    hasValidGuestOrderAccess(order.orderNumber, input.guestToken, order.guestLookupTokenHash);
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
    await voidOpenPaymentIntents(order.id);
    throw new ConflictError(
      "Your 30-minute reservation expired. Please add these pieces to a new bag to check current availability.",
    );
  }

  const contactEmail = order.user?.email ?? order.guestEmail ?? env.EMAIL_FROM;
  const adapter = getPaymentProvider(order.payments[0]?.provider);
  const retryIdempotencyKey = `${order.id}_retry_${createId().slice(0, 10)}`;
  const dp = order.currencyDecimals ?? 2;
  const chargeTarget = resolveGatewayChargeTarget({
    provider: adapter.provider,
    orderCurrency: order.currency,
    orderTotal: order.total.toFixed(dp),
    baseCurrency: order.baseCurrency,
    baseTotal: order.baseTotal.toFixed(2),
  });

  // Reuse the open payment session when possible: one chargeable intent per order prevents
  // double charges from parallel tabs or a slow first attempt that later succeeds.
  const openPayments = await db.paymentTransaction.findMany({
    where: { orderId: order.id, status: { in: OPEN_PAYMENT_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
  let paymentIntent: CreatePaymentIntentResult | null = null;
  const reusable = openPayments.find(
    (p) =>
      p.provider === adapter.provider &&
      p.currency === chargeTarget.chargedCurrency &&
      p.amount.equals(new Prisma.Decimal(chargeTarget.chargedAmount)),
  );
  if (reusable) {
    const paymentConfig = getCheckoutPaymentClientConfig();
    const clientSecret =
      reusable.provider === "STRIPE"
        ? await adapter.getClientSecret(reusable.providerIntentId).catch(() => null)
        : null;
    if (reusable.provider === "RAZORPAY" || clientSecret) {
      paymentIntent = {
        provider: reusable.provider,
        providerIntentId: reusable.providerIntentId,
        clientSecret,
        razorpayOrderId: reusable.provider === "RAZORPAY" ? reusable.providerIntentId : null,
        keyId:
          reusable.provider === "RAZORPAY"
            ? paymentConfig.razorpayKeyId
            : paymentConfig.stripePublishableKey,
        mode: paymentConfig.sandboxMode ? "sandbox" : "live",
      };
    }
  }

  if (!paymentIntent) {
    // Void any stale sessions first; if one was captured meanwhile, let the webhook settle it.
    const capturedMeanwhile = await voidOpenPaymentIntents(order.id);
    if (capturedMeanwhile) {
      throw new ConflictError(
        "Your payment is already being confirmed. Please wait a moment and refresh this page.",
      );
    }
    paymentIntent = await adapter.createPaymentIntent({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountDecimal: chargeTarget.chargedAmount,
      currency: chargeTarget.chargedCurrency,
      customerEmail: contactEmail,
      idempotencyKey: retryIdempotencyKey,
    });

    await db.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: paymentIntent.provider,
        providerIntentId: paymentIntent.providerIntentId,
        amount: new Prisma.Decimal(chargeTarget.chargedAmount),
        currency: chargeTarget.chargedCurrency,
        status: "REQUIRES_PAYMENT",
        rawResponse: (paymentIntent.rawResponse ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

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
    currencyDecimals: dp,
    baseCurrency: order.baseCurrency,
    exchangeRate: order.exchangeRate.toFixed(8),
    subtotal: order.subtotal.toFixed(dp),
    shippingCost: order.shippingCost.toFixed(dp),
    taxAmount: order.taxAmount.toFixed(dp),
    total: order.total.toFixed(dp),
    baseTotal: order.baseTotal.toFixed(2),
    chargedCurrency: chargeTarget.chargedCurrency,
    chargedAmount: chargeTarget.chargedAmount,
    chargeInBaseFallback: chargeTarget.chargeInBaseFallback,
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
    customPlacements: Array<Parameters<typeof sendCustomizationOrderPlacedEmail>[0]>;
  } = { payload: null, customPlacements: [] };
  const followUps: PaymentFollowUp[] = [];

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
          currencyDecimals: number;
          subtotal: Prisma.Decimal;
          shippingCost: Prisma.Decimal;
          taxAmount: Prisma.Decimal;
          total: Prisma.Decimal;
          refundedAmount: Prisma.Decimal;
          signatureRequired: boolean;
          userId: string | null;
          guestEmail: string | null;
          shippingAddress: Prisma.JsonValue;
        }>
      >`
        SELECT id,
               "refundedAmount",
               "orderNumber",
               status,
               currency,
               "currencyDecimals",
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
        const paymentRow = event.intentId
          ? await tx.paymentTransaction.findUnique({ where: { providerIntentId: event.intentId } })
          : null;

        // 1. Never settle on a capture whose amount/currency differs from what we asked for.
        const amountIssue = describeCapturedAmountIssue(event, paymentRow);
        if (amountIssue) {
          if (paymentRow) {
            await tx.paymentTransaction.update({
              where: { id: paymentRow.id },
              data: { status: "AMOUNT_MISMATCH", providerChargeId: event.chargeId ?? undefined },
            });
          }
          await tx.orderEvent.create({
            data: {
              orderId: lockedOrder.id,
              fromStatus: lockedOrder.status,
              toStatus: lockedOrder.status,
              note: `Payment NOT applied: ${amountIssue}. Manual review required.`,
            },
          });
          await tx.webhookEvent.update({
            where: { id: webhookRow.id },
            data: { status: "REVIEW_REQUIRED", error: amountIssue, processedAt: new Date() },
          });
          followUps.push({
            kind: "alert",
            orderId: lockedOrder.id,
            orderNumber: lockedOrder.orderNumber,
            title: "Payment amount mismatch",
            message: `A ${event.provider} payment (${event.intentId ?? "unknown intent"}) was captured but not applied because ${amountIssue}. Review it and refund or settle manually.`,
          });
          return { duplicate: false, orderId: lockedOrder.id, productIds };
        }

        // paymentRow is guaranteed non-null past the amount check.
        const capturedPayment = paymentRow!;
        const otherCapturedCount = await tx.paymentTransaction.count({
          where: {
            orderId: lockedOrder.id,
            id: { not: capturedPayment.id },
            status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] },
          },
        });
        const alreadyHandled = AUTO_REFUND_STATUSES.includes(capturedPayment.status);

        if (!alreadyHandled) {
          await tx.paymentTransaction.update({
            where: { id: capturedPayment.id },
            data: { status: "SUCCEEDED", providerChargeId: event.chargeId ?? undefined },
          });
        }

        if (alreadyHandled) {
          // Second notification (e.g. Razorpay payment.captured + order.paid) for a capture we are
          // already refunding: nothing to do.
        } else if (isCancellableBeforeSettlement(lockedOrder.status)) {
          // Normal reservation settlement: deduct stockQty and release reservedQty together
          for (const item of orderItems) {
            if (item.customizationRequestId) {
              const reqRow = await tx.customizationRequest.findUnique({
                where: { id: item.customizationRequestId },
                select: {
                  id: true,
                  requestNumber: true,
                  status: true,
                  customerEmail: true,
                  customerName: true,
                },
              });
              if (reqRow && reqRow.status !== "ORDERED") {
                await tx.customizationRequest.update({
                  where: { id: reqRow.id },
                  data: {
                    status: "ORDERED",
                    orderedAt: new Date(),
                    orderId: lockedOrder.id,
                  },
                });
                await tx.quoteToken.updateMany({
                  where: { requestId: reqRow.id, usedAt: null },
                  data: { usedAt: new Date(), usedByUserId: lockedOrder.userId },
                });
                await tx.customizationRequestEvent.create({
                  data: {
                    requestId: reqRow.id,
                    fromStatus: reqRow.status,
                    toStatus: "ORDERED",
                    eventType: "ORDER_PLACED",
                    message: `Commission confirmed on Order ${lockedOrder.orderNumber}`,
                    actorId: lockedOrder.userId,
                    actorRole: "CUSTOMER",
                  },
                });
                const emailDpCustom = lockedOrder.currencyDecimals ?? 2;
                emailPayloadRef.customPlacements.push({
                  customerEmail: reqRow.customerEmail,
                  customerName: reqRow.customerName,
                  requestNumber: reqRow.requestNumber,
                  orderNumber: lockedOrder.orderNumber,
                  productName: item.titleSnapshot,
                  lockedPriceDisplay: formatMoneyExact(
                    item.lineTotal.toFixed(emailDpCustom),
                    lockedOrder.currency,
                    "en-US",
                    emailDpCustom,
                  ),
                });
              }
              continue;
            }
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
            const emailDp = lockedOrder.currencyDecimals ?? 2;
            emailPayloadRef.payload = {
              to: recipientEmail,
              recipientName,
              orderNumber: lockedOrder.orderNumber,
              lines: orderItems.map((item) => ({
                title: item.titleSnapshot,
                variantTitle: item.variantTitleSnapshot,
                quantity: item.quantity,
                lineTotalFormatted: formatMoneyExact(
                  item.lineTotal.toFixed(emailDp),
                  lockedOrder.currency,
                  "en-US",
                  emailDp,
                ),
              })),
              subtotalFormatted: formatMoneyExact(
                lockedOrder.subtotal.toFixed(emailDp),
                lockedOrder.currency,
                "en-US",
                emailDp,
              ),
              shippingFormatted: lockedOrder.shippingCost.equals(0)
                ? "Complimentary"
                : formatMoneyExact(
                    lockedOrder.shippingCost.toFixed(emailDp),
                    lockedOrder.currency,
                    "en-US",
                    emailDp,
                  ),
              taxFormatted: formatMoneyExact(
                lockedOrder.taxAmount.toFixed(emailDp),
                lockedOrder.currency,
                "en-US",
                emailDp,
              ),
              totalFormatted: formatMoneyExact(
                lockedOrder.total.toFixed(emailDp),
                lockedOrder.currency,
                "en-US",
                emailDp,
              ),
              trackingUrl: `${env.NEXT_PUBLIC_SITE_URL}/orders/track`,
              signatureRequired: lockedOrder.signatureRequired,
            };
          }
        } else if (lockedOrder.status === "CANCELLED" || otherCapturedCount > 0) {
          // 2. Late capture on an expired order, or a second capture on an already-paid order:
          //    the money cannot be applied, so refund it automatically after commit.
          const reason =
            lockedOrder.status === "CANCELLED"
              ? "payment arrived after the 30-minute reservation expired and the order was cancelled"
              : "order was already paid by an earlier payment (duplicate charge)";
          await tx.paymentTransaction.update({
            where: { id: capturedPayment.id },
            data: { status: "REFUND_PENDING" },
          });
          await tx.orderEvent.create({
            data: {
              orderId: lockedOrder.id,
              fromStatus: lockedOrder.status,
              toStatus: lockedOrder.status,
              note: `Captured payment ${capturedPayment.providerIntentId} not applied: ${reason}. Automatic refund queued.`,
            },
          });
          const user = lockedOrder.userId
            ? await tx.user.findUnique({
                where: { id: lockedOrder.userId },
                select: { email: true, anonymizedAt: true },
              })
            : null;
          const shipping = lockedOrder.shippingAddress as { fullName?: string } | null;
          followUps.push({
            kind: "refund",
            orderId: lockedOrder.id,
            orderNumber: lockedOrder.orderNumber,
            orderStatus: lockedOrder.status,
            paymentId: capturedPayment.id,
            provider: capturedPayment.provider,
            providerIntentId: capturedPayment.providerIntentId,
            providerChargeId: event.chargeId ?? capturedPayment.providerChargeId,
            amountDecimal: capturedPayment.amount.toString(),
            currency: capturedPayment.currency,
            reason,
            customerEmail:
              user && !user.anonymizedAt ? user.email : (lockedOrder.guestEmail ?? null),
            customerName: shipping?.fullName ?? "Patron",
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
        const paymentRow = event.intentId
          ? await tx.paymentTransaction.findUnique({ where: { providerIntentId: event.intentId } })
          : null;

        if (paymentRow && AUTO_REFUND_STATUSES.includes(paymentRow.status)) {
          // Confirmation of our own automatic refund; order totals are unaffected.
          await tx.paymentTransaction.update({
            where: { id: paymentRow.id },
            data: { status: "AUTO_REFUNDED" },
          });
        } else if (lockedOrder.status !== "REFUNDED" && lockedOrder.status !== "CANCELLED") {
          const dp = lockedOrder.currencyDecimals ?? 2;
          const total = toDecimal(lockedOrder.total, dp);
          const existing = toDecimal(lockedOrder.refundedAmount, dp);

          // Convert the provider amount into order currency (charges may settle in base currency).
          let refundInOrderCcy = total;
          if (event.amountMinor !== null) {
            const gatewayCurrency = event.currency ?? paymentRow?.currency ?? lockedOrder.currency;
            const gatewayAmount = fromMinorUnits(event.amountMinor, gatewayCurrency);
            refundInOrderCcy =
              paymentRow && gatewayCurrency !== lockedOrder.currency && paymentRow.amount.gt(0)
                ? gatewayAmount.div(paymentRow.amount.toString()).times(total).toDecimalPlaces(dp)
                : toDecimal(gatewayAmount, dp);
          }

          let nextRefunded = existing;
          if (event.refundAmountMode === "incremental") {
            // Razorpay: skip refunds an admin already recorded (note carries the refund id).
            const refundId = extractRefundId(event.rawPayload);
            const alreadyRecorded = refundId
              ? (await tx.orderEvent.count({
                  where: { orderId: lockedOrder.id, note: { contains: refundId } },
                })) > 0
              : false;
            if (!alreadyRecorded) nextRefunded = existing.plus(refundInOrderCcy);
          } else {
            // Stripe reports the running total; max() keeps admin-initiated refunds idempotent.
            nextRefunded = existing.gt(refundInOrderCcy) ? existing : refundInOrderCcy;
          }
          if (nextRefunded.gt(total)) nextRefunded = total;

          if (nextRefunded.gt(existing)) {
            const isFull = nextRefunded.gte(total);
            await tx.order.update({
              where: { id: lockedOrder.id },
              data: {
                refundedAt: new Date(),
                refundedAmount: new Prisma.Decimal(nextRefunded.toFixed(dp)),
                ...(isFull ? { status: "REFUNDED" } : {}),
              },
            });
            if (paymentRow) {
              await tx.paymentTransaction.update({
                where: { id: paymentRow.id },
                data: { status: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED" },
              });
            }
            await tx.orderEvent.create({
              data: {
                orderId: lockedOrder.id,
                fromStatus: lockedOrder.status,
                toStatus: isFull ? "REFUNDED" : lockedOrder.status,
                note: `${isFull ? "Full" : "Partial"} refund recorded via ${event.provider} webhook: ${formatMoneyExact(nextRefunded.minus(existing), lockedOrder.currency, "en-US", dp)} (total refunded ${formatMoneyExact(nextRefunded, lockedOrder.currency, "en-US", dp)}).`,
              },
            });
          }
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

  for (const customPlacement of emailPayloadRef.customPlacements) {
    await sendCustomizationOrderPlacedEmail(customPlacement).catch(() => undefined);
  }

  // Refunds/alerts run after commit so a provider outage never rolls back settlement state.
  await runPaymentFollowUps(followUps);

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
    hasValidGuestOrderAccess(order.orderNumber, input.guestToken, order.guestLookupTokenHash);
  if (!authorized) {
    throw new ForbiddenError("You are not authorized to confirm this order.");
  }

  const latestPayment = order.payments[0];
  if (!latestPayment) {
    throw new ConflictError("No payment attempt found for this order.");
  }

  const adapter = getPaymentProvider(latestPayment.provider);
  // Simulated captures carry the real expected amount so they pass the same amount verification.
  const sandboxAmount = {
    amountMinor: toMinorUnits(
      latestPayment.amount.toString(),
      latestPayment.currency,
      latestPayment.provider === "STRIPE",
    ),
    currency: latestPayment.currency,
  };

  if (latestPayment.provider === "RAZORPAY") {
    const signed = buildSignedSandboxRazorpayWebhook({
      eventType: input.outcome === "succeed" ? "payment.captured" : "payment.failed",
      razorpayOrderId: latestPayment.providerIntentId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      failureMessage: input.outcome === "fail" ? "Card declined in test sandbox." : undefined,
      ...sandboxAmount,
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
      ...sandboxAmount,
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
      // Void the gateway session so the abandoned card form can no longer be charged.
      await voidOpenPaymentIntents(candidate.id);
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

type ConfirmationOrderRow = Prisma.OrderGetPayload<{
  include: {
    items: true;
    events: { orderBy: { createdAt: "asc" } };
    payments: { orderBy: { createdAt: "desc" }; take: 1 };
  };
}>;

export async function loadProductSlugMap(
  items: ReadonlyArray<{ productId: string }>,
): Promise<Record<string, string>> {
  const productIds = Array.from(new Set(items.map((item) => item.productId).filter(Boolean)));
  if (productIds.length === 0) return {};

  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, slug: true },
  });
  const map: Record<string, string> = {};
  for (const p of products) {
    map[p.id] = p.slug;
  }
  return map;
}

export function mapOrderRecordToConfirmationDTO(
  order: ConfirmationOrderRow,
  contactEmail: string,
  productSlugMap: Record<string, string> = {},
): OrderConfirmationDTO {
  const dp = order.currencyDecimals ?? 2;
  const chargedCurr = order.chargedCurrency || order.currency;
  const chargedDp = chargedCurr === order.currency ? dp : 2;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    currencyDecimals: dp,
    baseCurrency: order.baseCurrency,
    exchangeRate: order.exchangeRate.toFixed(8),
    subtotal: order.subtotal.toFixed(dp),
    shippingCost: order.shippingCost.toFixed(dp),
    taxAmount: order.taxAmount.toFixed(dp),
    discountAmount: order.discountAmount.toFixed(dp),
    total: order.total.toFixed(dp),
    baseSubtotal: order.baseSubtotal.toFixed(2),
    baseShippingCost: order.baseShippingCost.toFixed(2),
    baseTaxAmount: order.baseTaxAmount.toFixed(2),
    baseDiscountAmount: order.baseDiscountAmount.toFixed(2),
    baseTotal: order.baseTotal.toFixed(2),
    chargedCurrency: chargedCurr,
    chargedAmount: order.chargedAmount ? order.chargedAmount.toFixed(chargedDp) : null,
    refundedAmount: order.refundedAmount.toFixed(dp),
    refundedAt: order.refundedAt?.toISOString() ?? null,
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
    contactEmail,
    sandboxMode: env.PAYMENT_TEST_SANDBOX === "true",
    paymentProvider: order.payments[0]?.provider ?? null,
    paymentStatus: order.payments[0]?.status ?? null,
    items: order.items.map((item) => {
      const parsedCustom = parseOrderCustomizationSnapshot(item.customizationSnapshot);
      return {
        id: item.id,
        productId: item.productId,
        productSlug: productSlugMap[item.productId] ?? null,
        variantId: item.variantId,
        skuSnapshot: item.skuSnapshot,
        titleSnapshot: item.titleSnapshot,
        variantTitleSnapshot: item.variantTitleSnapshot,
        imageUrlSnapshot: item.imageUrlSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(dp),
        lineTotal: item.lineTotal.toFixed(dp),
        customizationRequestId: item.customizationRequestId ?? null,
        customizationRequestNumber: parsedCustom.requestNumber,
        customizationSummaryLines: parsedCustom.lines,
      };
    }),
    events: order.events.map((evt) => ({
      id: evt.id,
      toStatus: evt.toStatus,
      note: evt.note,
      createdAt: evt.createdAt.toISOString(),
    })),
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
  const hasValidToken = hasValidGuestOrderAccess(
    order.orderNumber,
    guestToken,
    order.guestLookupTokenHash,
  );

  if (!isOwner && !isStaff && !hasValidToken) {
    throw new ForbiddenError(
      "Use the private confirmation link or sign into the purchasing account to view this order.",
    );
  }

  const slugMap = await loadProductSlugMap(order.items);
  return mapOrderRecordToConfirmationDTO(order, settings.contactEmail, slugMap);
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
