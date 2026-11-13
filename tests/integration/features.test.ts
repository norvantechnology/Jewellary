// @vitest-environment node
import { deleteTestOrders } from "../helpers/cleanup";
import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveGatewayChargeTarget } from "@/lib/currency";
import {
  deleteCustomerAddress,
  getCustomerAddressForRest,
  getCustomerOrderByIdOrNumberForRest,
  getCustomerOrderDetail,
  getOrderForInvoiceDownload,
  listCustomerAddresses,
  MAX_ADDRESSES_PER_USER,
  reorderCustomerOrder,
  saveCustomerAddress,
} from "@/modules/account/account.service";
import { addCartItemForOwner } from "@/modules/cart/cart.service";
import {
  createAdminCurrency,
  deleteAdminCurrency,
  getActiveCurrencies,
  listAdminCurrencies,
  updateAdminCurrency,
} from "@/modules/currencies/currency.service";
import { getAdminOrderDetail } from "@/modules/orders/admin-orders.service";
import { createOrderAndPayment } from "@/modules/orders/order.service";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, RateLimitError, ValidationError } from "@/server/errors";
import { clearMemoryRateLimits, enforceRateLimit } from "@/server/rate-limit";

describe("Audit Features Integration — Multi-currency Snapshots, Order Ownership, Reorder, Address Book", () => {
  const runKey = createId().slice(0, 8);
  let adminUserId = "";
  let adminEmail = "";
  let userAId = "";
  let userBId = "";
  let productId = "";
  let variantId = "";
  let createdCurrencyCode = "";
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    const [adminUser, userA, userB] = await Promise.all([
      db.user.create({
        data: {
          id: createId(),
          name: "FX Audit Admin",
          email: `fx-admin-${runKey}@maison.test`,
          emailVerified: true,
          role: "ADMIN",
        },
      }),
      db.user.create({
        data: {
          id: createId(),
          name: "Patron Alpha",
          email: `patron-a-${runKey}@maison.test`,
          emailVerified: true,
          role: "CUSTOMER",
        },
      }),
      db.user.create({
        data: {
          id: createId(),
          name: "Patron Beta",
          email: `patron-b-${runKey}@maison.test`,
          emailVerified: true,
          role: "CUSTOMER",
        },
      }),
    ]);

    adminUserId = adminUser.id;
    adminEmail = adminUser.email;
    userAId = userA.id;
    userBId = userB.id;

    const existingVariant = await db.productVariant.findFirst({
      where: {
        isActive: true,
        stockQty: { gte: 10 },
        product: { status: "ACTIVE", deletedAt: null, priceMode: "FIXED" },
      },
      select: { id: true, productId: true },
    });
    if (!existingVariant) {
      throw new Error("Expected at least one active fixed-price stocked variant in database.");
    }
    variantId = existingVariant.id;
    productId = existingVariant.productId;
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await deleteTestOrders(createdOrderIds);
    }
    if (createdCurrencyCode) {
      await db.currencyRateHistory.deleteMany({ where: { currencyCode: createdCurrencyCode } });
      await db.currency.deleteMany({ where: { code: createdCurrencyCode } });
    }
    await db.cart.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.address.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.auditLog.deleteMany({ where: { actorId: adminUserId } });
    await db.user.deleteMany({ where: { id: { in: [adminUserId, userAId, userBId] } } });
  });

  it("enforces currency admin validation rules, rate-limits geo/currency endpoint, and freezes order FX snapshots", async () => {
    const actorInfo = { id: adminUserId, email: adminEmail };

    // 1. Validate admin currency guards (base currency cannot be deleted or deactivated)
    const active = await getActiveCurrencies();
    const usdBase = active.find((c) => c.isBase);
    expect(usdBase).toBeDefined();

    await expect(deleteAdminCurrency(usdBase!.id)).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateAdminCurrency(usdBase!.id, { isActive: false, note: null }, actorInfo),
    ).rejects.toBeInstanceOf(ValidationError);

    // 2. Create temporary test currency SEK -> update rate -> check audit history
    const createdCur = await createAdminCurrency(
      {
        code: "SEK",
        name: "Swedish Krona",
        symbol: "kr",
        symbolPosition: "AFTER",
        decimalPlaces: 2,
        roundingRule: "HALF_UP",
        exchangeRate: "10.50000000",
        isActive: true,
        isDefault: false,
        isBase: false,
        sortOrder: 99,
        note: null,
      },
      actorInfo,
    );
    createdCurrencyCode = createdCur.code;
    expect(createdCur.exchangeRate).toBe("10.50000000");

    // Reject non-positive exchange rate
    await expect(
      updateAdminCurrency(createdCur.id, { exchangeRate: "0", note: null }, actorInfo),
    ).rejects.toBeInstanceOf(ValidationError);

    // 3. Checkout order in SEK (10.5x rate), then change SEK rate to 12.0 and confirm past order is unaltered
    const cartOwnerA = { kind: "user" as const, userId: userAId };
    await addCartItemForOwner(cartOwnerA, variantId, 1);

    const sekOrder = await createOrderAndPayment(
      {
        email: `patron-a-${runKey}@maison.test`,
        shippingAddress: {
          fullName: "Patron Alpha",
          phone: "+1 212 555 0140",
          line1: "412 Mercer Street",
          line2: null,
          city: "New York",
          state: "NY",
          postalCode: "10013",
          country: "US",
        },
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        currency: "SEK",
        giftNote: null,
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey: `fx-order-${runKey}-${createId()}`,
      },
      { userId: userAId, cartOwner: cartOwnerA },
    );
    createdOrderIds.push(sekOrder.orderId);

    const detailBeforeRateChange = await getCustomerOrderDetail(userAId, sekOrder.orderNumber);
    expect(detailBeforeRateChange.currency).toBe("SEK");
    expect(detailBeforeRateChange.exchangeRate).toBe("10.50000000");

    // Mutate SEK rate -> past order & admin order detail must remain unchanged
    await updateAdminCurrency(
      createdCur.id,
      { exchangeRate: "12.00000000", note: "FX drift test" },
      actorInfo,
    );

    const adminCurrencies = await listAdminCurrencies();
    const rateEntry = adminCurrencies.rateHistory.find(
      (h) => h.currencyCode === "SEK" && h.newRate === "12.00000000",
    );
    expect(rateEntry).toBeDefined();
    expect(rateEntry?.oldRate).toBe("10.50000000");
    expect(rateEntry?.changedByEmail).toBe(adminEmail);

    const detailAfterRateChange = await getCustomerOrderDetail(userAId, sekOrder.orderNumber);
    const adminDetail = await getAdminOrderDetail(sekOrder.orderId);
    expect(detailAfterRateChange.total).toBe(detailBeforeRateChange.total);
    expect(detailAfterRateChange.exchangeRate).toBe("10.50000000");
    expect(detailAfterRateChange.baseTotal).toBe(detailBeforeRateChange.baseTotal);
    expect(adminDetail.exchangeRate).toBe("10.50000000");
    expect(adminDetail.baseTotal).toBe(detailBeforeRateChange.baseTotal);

    // 4. Verify Razorpay base-currency fallback target (e.g. KWD -> USD base fallback) vs direct currency support
    expect(
      resolveGatewayChargeTarget({
        provider: "RAZORPAY",
        orderCurrency: "KWD",
        orderTotal: "30.750",
        baseCurrency: detailBeforeRateChange.baseCurrency,
        baseTotal: detailBeforeRateChange.baseTotal,
      }),
    ).toEqual({
      chargedCurrency: detailBeforeRateChange.baseCurrency,
      chargedAmount: detailBeforeRateChange.baseTotal,
      chargeInBaseFallback: true,
    });

    // 5. Verify public currency rate-limiter bucket enforces limit cleanly
    clearMemoryRateLimits();
    for (let i = 0; i < 120; i++) {
      await enforceRateLimit("publicCurrency", `ip:test-cur-${runKey}`);
    }
    await expect(
      enforceRateLimit("publicCurrency", `ip:test-cur-${runKey}`),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("enforces order REST ownership (403/404), invoice authorization, and reorder", async () => {
    const owned = createdOrderIds[0]!;
    const okOrder = await getCustomerOrderByIdOrNumberForRest(userAId, owned);
    expect(okOrder.id).toBe(owned);
    expect(okOrder.items[0]?.productId).toBe(productId);

    // User B cannot view User A's order -> Forbidden (403)
    await expect(getCustomerOrderByIdOrNumberForRest(userBId, owned)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      getOrderForInvoiceDownload({ idOrOrderNumber: owned, userId: userBId, userRole: "CUSTOMER" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Non-existent ID -> NotFound (404)
    await expect(
      getCustomerOrderByIdOrNumberForRest(userAId, "ORD-DOES-NOT-EXIST"),
    ).rejects.toBeInstanceOf(NotFoundError);

    // Reorder adds stocked item cleanly into User A's bag
    const cartOwnerA = { kind: "user" as const, userId: userAId };
    const reorderRes = await reorderCustomerOrder({
      orderNumber: okOrder.orderNumber,
      actorUserId: userAId,
      actorRole: "CUSTOMER",
      cartOwner: cartOwnerA,
    });
    expect(reorderRes.addedCount).toBe(1);
    expect(reorderRes.cart.itemCount).toBeGreaterThanOrEqual(1);
  });

  it("enforces 10-address cap, single-default invariant on create/edit/delete, ownership, and order address snapshot", async () => {
    const baseAddr = {
      label: "Home",
      fullName: "Patron Beta",
      phone: "+1 212 555 0188",
      line1: "100 Mercer Street",
      line2: null,
      city: "New York",
      state: "NY",
      postalCode: "10012",
      country: "US",
      isDefaultShipping: false,
      isDefaultBilling: false,
    };

    // First address automatically becomes default shipping & billing
    const a1 = await saveCustomerAddress(userBId, baseAddr);
    expect(a1.isDefaultShipping).toBe(true);
    expect(a1.isDefaultBilling).toBe(true);

    // Editing sole address while unchecking default keeps default invariant intact
    const a1Edited = await saveCustomerAddress(userBId, {
      ...baseAddr,
      id: a1.id,
      isDefaultShipping: false,
      isDefaultBilling: false,
    });
    expect(a1Edited.isDefaultShipping).toBe(true);
    expect(a1Edited.isDefaultBilling).toBe(true);

    // Place an order for User B with a1, then edit a1 -> order snapshot stays unchanged!
    const cartOwnerB = { kind: "user" as const, userId: userBId };
    await addCartItemForOwner(cartOwnerB, variantId, 1);
    const bOrder = await createOrderAndPayment(
      {
        email: `patron-b-${runKey}@maison.test`,
        shippingAddress: {
          fullName: a1.fullName,
          phone: a1.phone,
          line1: "100 Original Snapshot Ln",
          line2: null,
          city: "New York",
          state: "NY",
          postalCode: "10012",
          country: "US",
        },
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        giftNote: null,
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey: `addr-snap-${runKey}`,
      },
      { userId: userBId, cartOwner: cartOwnerB },
    );
    createdOrderIds.push(bOrder.orderId);

    // Add 9 more addresses (total 10), then 11th must fail with ValidationError
    const createdIds = [a1.id];
    for (let i = 2; i <= MAX_ADDRESSES_PER_USER; i++) {
      const next = await saveCustomerAddress(userBId, {
        ...baseAddr,
        label: "Work",
        line1: `${i * 10} Fifth Avenue`,
      });
      createdIds.push(next.id);
    }

    await expect(
      saveCustomerAddress(userBId, { ...baseAddr, line1: "110 Overflow Rd" }),
    ).rejects.toBeInstanceOf(ValidationError);

    // Unchecking default on default address when other addresses exist promotes another address cleanly
    await saveCustomerAddress(userBId, {
      ...baseAddr,
      id: a1.id,
      isDefaultShipping: false,
      isDefaultBilling: false,
    });
    const listAfterEdit = await listCustomerAddresses(userBId);
    expect(listAfterEdit.filter((a) => a.isDefaultShipping)).toHaveLength(1);
    expect(listAfterEdit.filter((a) => a.isDefaultBilling)).toHaveLength(1);

    // Deleting current default promotes fallback address cleanly
    const currentDefault = listAfterEdit.find((a) => a.isDefaultShipping)!;
    await deleteCustomerAddress(userBId, currentDefault.id);
    const listAfterDelete = await listCustomerAddresses(userBId);
    expect(listAfterDelete.filter((a) => a.isDefaultShipping)).toHaveLength(1);

    // Ownership checks block User A from touching User B's address
    await expect(getCustomerAddressForRest(userAId, createdIds[1]!)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(deleteCustomerAddress(userAId, createdIds[1]!)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    // Order address snapshot remains completely unaffected by address edits/deletes
    const storedOrder = await getCustomerOrderDetail(userBId, bOrder.orderNumber);
    expect(storedOrder.shippingAddress.line1).toBe("100 Original Snapshot Ln");
  });
});
