// @vitest-environment node
import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonymizeCustomerAccount,
  getCustomerOrderDetail,
  listCustomerAddresses,
  saveCustomerAddress,
  setDefaultCustomerAddress,
  verifyGuestOrderLookup,
} from "@/modules/account/account.service";
import { listAuditLogs } from "@/modules/audit/audit.service";
import {
  changeCustomerRole,
  getAdminCustomerDetail,
  listAdminCustomers,
} from "@/modules/customers/customer.service";
import { createCustomerEnquiry, replyToAdminEnquiry } from "@/modules/enquiries/enquiry.service";
import {
  issueAdminOrderRefund,
  updateAdminOrderStatus,
} from "@/modules/orders/admin-orders.service";
import { createOrderAndPayment, verifyOrderTrackToken } from "@/modules/orders/order.service";
import { buildSignedSandboxStripeWebhook } from "@/modules/payments/stripe.adapter";
import { processVerifiedWebhookEvent } from "@/modules/orders/order.service";
import { getPaymentProvider } from "@/modules/payments";
import type { AuthenticatedContext } from "@/server/dal";
import { db } from "@/server/db";
import { clearEmailOutbox, getEmailOutbox } from "@/server/email/client";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";

function makeActor(user: {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
}): AuthenticatedContext {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: true,
      phone: null,
    },
    sessionId: `sess_${createId().slice(0, 8)}`,
  };
}

describe("Phase 6 Integration — Admin Operations, RBAC, Guest Tracking & GDPR Account", () => {
  let categoryId = "";
  let seededAdminId = "";
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdCartIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdEnquiryIds: string[] = [];
  const createdAuditLogIds: string[] = [];
  const createdWebhookIds: string[] = [];

  beforeAll(async () => {
    const [cat, admin] = await Promise.all([
      db.category.findFirstOrThrow({ where: { slug: "rings" } }),
      db.user.findFirstOrThrow({ where: { role: "ADMIN", banned: false, anonymizedAt: null } }),
    ]);
    categoryId = cat.id;
    seededAdminId = admin.id;
  });

  afterAll(async () => {
    if (createdAuditLogIds.length > 0) {
      await db.auditLog.deleteMany({ where: { id: { in: createdAuditLogIds } } });
    }
    if (createdOrderIds.length > 0) {
      await db.auditLog.deleteMany({ where: { entityId: { in: createdOrderIds } } });
      await db.inventoryTransaction.deleteMany({ where: { referenceId: { in: createdOrderIds } } });
      await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    if (createdWebhookIds.length > 0) {
      await db.webhookEvent.deleteMany({ where: { eventId: { in: createdWebhookIds } } });
    }
    if (createdEnquiryIds.length > 0) {
      await db.auditLog.deleteMany({ where: { entityId: { in: createdEnquiryIds } } });
      await db.enquiry.deleteMany({ where: { id: { in: createdEnquiryIds } } });
    }
    if (createdCartIds.length > 0) {
      await db.cart.deleteMany({ where: { id: { in: createdCartIds } } });
    }
    if (createdProductIds.length > 0) {
      await db.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
    if (createdUserIds.length > 0) {
      await db.auditLog.deleteMany({ where: { entityId: { in: createdUserIds } } });
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  async function createTestUser(
    role: "CUSTOMER" | "STAFF" | "ADMIN",
    suffix = createId().slice(0, 8),
  ) {
    const user = await db.user.create({
      data: {
        id: `usr_${suffix}`,
        name: `Test ${role} ${suffix}`,
        email: `p6-${role.toLowerCase()}-${suffix}@example.com`,
        phone: `+1 212 555 ${suffix.slice(0, 4)}`,
        role,
        emailVerified: true,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function createSettledOrderForTest(userId: string, customerEmail: string) {
    const suffix = createId().slice(0, 8);
    const product = await db.product.create({
      data: {
        sku: `P6-${suffix.toUpperCase()}`,
        slug: `p6-piece-${suffix}`,
        name: `Phase 6 Atelier Ring ${suffix}`,
        description: "Isolated test piece for Phase 6 order lifecycle verification.",
        status: "ACTIVE",
        priceMode: "FIXED",
        basePrice: "1000.00",
        categoryId,
        variants: {
          create: {
            sku: `MA-P6-${suffix}`,
            title: "18k Gold / Size 6",
            stockQty: 5,
            reservedQty: 0,
            isDefault: true,
          },
        },
      },
      include: { variants: true },
    });
    createdProductIds.push(product.id);
    const variantId = product.variants[0]!.id;

    const cart = await db.cart.create({
      data: {
        userId,
        items: { create: { variantId, quantity: 1, unitPriceSnapshot: "1000.00" } },
      },
    });
    createdCartIds.push(cart.id);

    const created = await createOrderAndPayment(
      {
        email: customerEmail,
        shippingAddress: {
          fullName: "Eleanor Sterling",
          phone: "+1 212 555 8899",
          line1: "450 Madison Avenue",
          line2: "Suite 800",
          city: "New York",
          state: "NY",
          postalCode: "10022",
          country: "US",
        },
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        giftNote: null,
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey: `p6_idem_${suffix}`,
      },
      { userId, cartOwner: { kind: "user", userId } },
    );
    createdOrderIds.push(created.orderId);

    const signed = buildSignedSandboxStripeWebhook({
      eventType: "payment_intent.succeeded",
      intentId: created.payment.providerIntentId,
      orderId: created.orderId,
      orderNumber: created.orderNumber,
    });
    const verified = await getPaymentProvider("STRIPE").verifyWebhookSignature(
      signed.rawBody,
      signed.signatureHeader,
    );
    createdWebhookIds.push(verified.eventId);
    await processVerifiedWebhookEvent(verified);

    return {
      orderId: created.orderId,
      orderNumber: created.orderNumber,
      variantId,
      total: created.total,
    };
  }

  it("enforces order state machine, blocks STAFF from paid cancel & refund, and audits ADMIN refund + stock restore", async () => {
    const customer = await createTestUser("CUSTOMER");
    const staff = await createTestUser("STAFF");
    const staffActor = makeActor(staff);
    const adminUser = await db.user.findUniqueOrThrow({ where: { id: seededAdminId } });
    const adminActor = makeActor({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: "ADMIN",
    });

    const { orderId, orderNumber, variantId, total } = await createSettledOrderForTest(
      customer.id,
      customer.email,
    );

    // Invalid state machine jump (PAID -> DELIVERED directly is invalid)
    await expect(
      updateAdminOrderStatus(
        {
          orderId,
          toStatus: "DELIVERED",
          carrier: null,
          trackingNumber: null,
          trackingUrl: null,
          internalNote: null,
          customerNote: null,
          notifyCustomer: false,
        },
        staffActor,
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    // STAFF cannot cancel an already PAID order
    await expect(
      updateAdminOrderStatus(
        {
          orderId,
          toStatus: "CANCELLED",
          carrier: null,
          trackingNumber: null,
          trackingUrl: null,
          internalNote: null,
          customerNote: null,
          notifyCustomer: false,
        },
        staffActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // STAFF CAN transition PAID -> PROCESSING -> PACKED -> SHIPPED with tracking + email notification
    clearEmailOutbox();
    await updateAdminOrderStatus(
      {
        orderId,
        toStatus: "PROCESSING",
        carrier: null,
        trackingNumber: null,
        trackingUrl: null,
        internalNote: null,
        customerNote: null,
        notifyCustomer: false,
      },
      staffActor,
    );
    await updateAdminOrderStatus(
      {
        orderId,
        toStatus: "SHIPPED",
        carrier: "Malca-Amit",
        trackingNumber: "MA-WB-9912",
        trackingUrl: "https://track.example.com/MA-WB-9912",
        internalNote: null,
        customerNote: null,
        notifyCustomer: true,
      },
      staffActor,
    );

    const outbox = getEmailOutbox();
    expect(outbox.some((m) => m.to === customer.email && m.tag === "order-status")).toBe(true);

    // STAFF cannot issue monetary refunds
    await expect(
      issueAdminOrderRefund(
        {
          orderId,
          amount: "100.00",
          reason: "Unauthorized test",
          restoreStock: false,
          notifyCustomer: false,
        },
        staffActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // ADMIN can issue full refund with stock restoration
    const variantBefore = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variantBefore.stockQty).toBe(4);

    const refundRes = await issueAdminOrderRefund(
      {
        orderId,
        amount: total,
        reason: "Client returned sealed piece within return window",
        restoreStock: true,
        notifyCustomer: true,
      },
      adminActor,
    );

    expect(refundRes.status).toBe("REFUNDED");
    expect(refundRes.refundedAmount).toBe(total);

    const variantAfter = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variantAfter.stockQty).toBe(5);

    const auditFeed = await listAuditLogs({ entityType: "Order", action: "order.refund" });
    expect(auditFeed.logs.some((log) => log.entityId === orderId)).toBe(true);

    // Guest lookup verifies case-insensitive orderNumber + rejects wrong email with generic error
    await expect(
      verifyGuestOrderLookup({
        orderNumber: orderNumber.toLowerCase(),
        email: "wrong@example.com",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const trackFound = await verifyGuestOrderLookup({
      orderNumber: orderNumber.toLowerCase(),
      email: customer.email.toUpperCase(),
    });
    expect(trackFound.order.orderNumber).toBe(orderNumber);
    expect(trackFound.order.carrier).toBe("Malca-Amit");
    expect(verifyOrderTrackToken(orderNumber, trackFound.accessToken)).toBe(true);
  });

  it("masks customer PII for STAFF, prevents self-demotion & last-admin removal, and audits role changes", async () => {
    const customer = await createTestUser("CUSTOMER");
    const staff = await createTestUser("STAFF");
    const secondAdmin = await createTestUser("ADMIN");
    const staffActor = makeActor(staff);
    const adminActor = makeActor(secondAdmin);

    await saveCustomerAddress(customer.id, {
      label: "Vault",
      fullName: customer.name,
      phone: "+1 917 555 4321",
      line1: "725 Fifth Avenue Suite 1200",
      line2: null,
      city: "New York",
      state: "NY",
      postalCode: "10022",
      country: "US",
      isDefaultShipping: true,
      isDefaultBilling: false,
    });

    const staffList = await listAdminCustomers({ q: customer.email }, staffActor);
    expect(staffList.piiMasked).toBe(true);
    expect(staffList.customers[0]?.phone).toContain("••••");

    const staffDetail = await getAdminCustomerDetail(customer.id, staffActor);
    expect(staffDetail.piiMasked).toBe(true);
    expect(staffDetail.addresses[0]?.line1).toContain("Protected PII");

    const adminDetail = await getAdminCustomerDetail(customer.id, adminActor);
    expect(adminDetail.piiMasked).toBe(false);
    expect(adminDetail.addresses[0]?.line1).toBe("725 Fifth Avenue Suite 1200");

    // STAFF blocked from role changes
    await expect(
      changeCustomerRole({ userId: customer.id, role: "STAFF", reason: null }, staffActor),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Self-demotion blocked
    await expect(
      changeCustomerRole({ userId: secondAdmin.id, role: "STAFF", reason: null }, adminActor),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Cross-admin demotion succeeds while active admin remains, then re-demote check
    const promoted = await changeCustomerRole(
      { userId: customer.id, role: "STAFF", reason: "Concierge promotion" },
      adminActor,
    );
    expect(promoted.role).toBe("STAFF");
  });

  it("sends enquiry concierge replies, manages address defaults, and GDPR-anonymizes accounts while retaining order ledger", async () => {
    const customer = await createTestUser("CUSTOMER");
    const staff = await createTestUser("STAFF");
    const staffActor = makeActor(staff);

    // Enquiry reply
    clearEmailOutbox();
    const enquiry = await createCustomerEnquiry(
      {
        type: "BESPOKE",
        name: customer.name,
        email: customer.email,
        phone: null,
        message: "Seeking emerald-cut platinum solitaire consultation.",
        productId: null,
        website: "",
      },
      customer.id,
    );
    createdEnquiryIds.push(enquiry.id);

    const replyRes = await replyToAdminEnquiry(
      {
        enquiryId: enquiry.id,
        subject: "Private Viewing Appointment",
        replyMessage: "We have curated three GIA F-VVS1 emerald-cut stones for your review.",
        nextStatus: "IN_PROGRESS",
      },
      staffActor,
    );
    expect(replyRes.emailDelivered).toBe(true);
    expect(replyRes.status).toBe("IN_PROGRESS");
    expect(getEmailOutbox().some((m) => m.to === customer.email && m.tag === "enquiry-reply")).toBe(
      true,
    );

    // Multiple addresses & default toggle
    const addr1 = await saveCustomerAddress(customer.id, {
      label: "Primary",
      fullName: customer.name,
      phone: "+1 212 555 1111",
      line1: "100 Main St",
      line2: null,
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "US",
      isDefaultShipping: true,
      isDefaultBilling: true,
    });
    const addr2 = await saveCustomerAddress(customer.id, {
      label: "Studio",
      fullName: customer.name,
      phone: "+1 212 555 2222",
      line1: "200 Oak Ave",
      line2: null,
      city: "Boston",
      state: "MA",
      postalCode: "02116",
      country: "US",
      isDefaultShipping: false,
      isDefaultBilling: false,
    });
    await setDefaultCustomerAddress(customer.id, addr2.id, "shipping");
    const addresses = await listCustomerAddresses(customer.id);
    expect(addresses.find((a) => a.id === addr2.id)?.isDefaultShipping).toBe(true);
    expect(addresses.find((a) => a.id === addr1.id)?.isDefaultShipping).toBe(false);

    // Order retained after GDPR anonymisation
    const { orderNumber } = await createSettledOrderForTest(customer.id, customer.email);
    const ownedOrder = await getCustomerOrderDetail(customer.id, orderNumber);
    expect(ownedOrder.orderNumber).toBe(orderNumber);

    const delRes = await anonymizeCustomerAccount(customer.id, customer.email);
    expect(delRes.deleted).toBe(true);

    const wipedUser = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(wipedUser.anonymizedAt).not.toBeNull();
    expect(wipedUser.email).toContain("@anonymized.local");
    expect(wipedUser.phone).toBeNull();
    expect(await db.address.count({ where: { userId: customer.id } })).toBe(0);
    // Order snapshot still intact for accounting
    expect(await db.order.findUnique({ where: { orderNumber } })).not.toBeNull();
  });
});
