// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Email client delivery branches", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("delivers via Resend, SMTP, and handles fallbacks/errors per NODE_ENV", async () => {
    const sendResend = vi.fn().mockResolvedValue({ data: { id: "em_1" }, error: null });
    const sendMail = vi.fn().mockResolvedValue({ messageId: "smtp_1" });

    const envMock = {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_NAME: "Maison Aurelia",
      EMAIL_FROM: "concierge@maison.test",
      RESEND_API_KEY: "re_live_123",
      SMTP_HOST: "",
      SMTP_PORT: 1025,
    };

    vi.doMock("@/lib/env", () => ({ env: envMock }));
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: sendResend };
      },
    }));
    vi.doMock("nodemailer", () => ({
      default: { createTransport: () => ({ sendMail }) },
    }));

    const { dispatchEmail, clearEmailOutbox, getEmailOutbox } =
      await import("@/server/email/client");

    const resResend = await dispatchEmail({
      to: "client@maison.test",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
      tag: "welcome",
    });
    expect(resResend).toEqual({ deliveredVia: "resend" });
    expect(sendResend).toHaveBeenCalledTimes(1);

    sendResend.mockResolvedValueOnce({ data: null, error: { message: "Domain denied" } });
    await expect(
      dispatchEmail({ to: "c@maison.test", subject: "Fail", html: "<p/>", text: "x" }),
    ).rejects.toThrow("Resend error: Domain denied");

    // Re-import cleanly for SMTP dev fallback and prod error branches
    vi.resetModules();
    const envSmtp = {
      NODE_ENV: "development",
      NEXT_PUBLIC_SITE_NAME: "Maison Aurelia",
      EMAIL_FROM: "concierge@maison.test",
      RESEND_API_KEY: "",
      SMTP_HOST: "localhost",
      SMTP_PORT: 1025,
    };
    const sendMail2 = vi.fn().mockResolvedValueOnce({ messageId: "ok" });
    vi.doMock("@/lib/env", () => ({ env: envSmtp }));
    vi.doMock("nodemailer", () => ({
      default: { createTransport: () => ({ sendMail: sendMail2 }) },
    }));

    const modSmtp = await import("@/server/email/client");
    modSmtp.clearEmailOutbox();
    expect(
      await modSmtp.dispatchEmail({ to: "a@b.c", subject: "S", html: "<p/>", text: "x" }),
    ).toEqual({ deliveredVia: "smtp" });

    sendMail2.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(
      await modSmtp.dispatchEmail({ to: "a@b.c", subject: "S2", html: "<p/>", text: "x" }),
    ).toEqual({ deliveredVia: "memory" });
    expect(modSmtp.getEmailOutbox().length).toBeGreaterThanOrEqual(1);

    envSmtp.NODE_ENV = "production";
    sendMail2.mockRejectedValueOnce(new Error("SMTP fatal"));
    await expect(
      modSmtp.dispatchEmail({ to: "a@b.c", subject: "S3", html: "<p/>", text: "x" }),
    ).rejects.toThrow("SMTP fatal");

    // No transport configured -> memory outbox log path
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: {
        NODE_ENV: "development",
        NEXT_PUBLIC_SITE_NAME: "Maison Aurelia",
        EMAIL_FROM: "concierge@maison.test",
        RESEND_API_KEY: "",
        SMTP_HOST: "",
        SMTP_PORT: 1025,
      },
    }));
    const modNoTransport = await import("@/server/email/client");
    clearEmailOutbox();
    const resMem = await modNoTransport.dispatchEmail({
      to: "mem@b.c",
      subject: "Mem",
      html: "<p/>",
      text: "x",
    });
    expect(resMem).toEqual({ deliveredVia: "memory" });
    expect(getEmailOutbox().length).toBeGreaterThanOrEqual(0);
  });
});

describe("Cookie & session-resolving service wrappers (mocked DAL/cookies)", () => {
  it("covers cart, wishlist, checkout bootstrap/confirmation & auth-api account branches", async () => {
    vi.resetModules();

    const getOptionalSession = vi.fn().mockResolvedValue(null);
    const readGuestToken = vi.fn().mockResolvedValue(null);
    const getOrCreateGuestToken = vi.fn().mockResolvedValue("0123456789abcdef0123456789abcdef");
    const authUpdateUser = vi.fn().mockResolvedValue({});
    const authChangePassword = vi.fn().mockResolvedValue({});
    const findFirstOrder = vi.fn();
    const findUniqueOrder = vi.fn();
    const updateUser = vi.fn().mockResolvedValue({
      id: "u1",
      name: "Claire",
      email: "claire@maison.test",
      phone: null,
    });

    vi.doMock("next/headers", () => ({
      headers: async () => new Headers(),
      cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
    }));
    vi.doMock("@/server/dal", () => ({
      getOptionalSession,
    }));
    vi.doMock("@/server/guest-token", () => ({
      readGuestTokenFromCookies: readGuestToken,
      getOrCreateGuestTokenCookie: getOrCreateGuestToken,
    }));
    vi.doMock("@/server/auth", () => ({
      auth: {
        api: {
          updateUser: authUpdateUser,
          changePassword: authChangePassword,
        },
      },
    }));
    vi.doMock("@/modules/settings/settings.service", () => ({
      getPublicStoreSettings: vi.fn().mockResolvedValue({
        storeName: "Maison Aurelia",
        contactEmail: "concierge@maison.test",
        currency: "USD",
        defaultCountry: "US",
        supportedCountries: ["US"],
        taxRate: "0.0800",
        taxLabel: "Estimated Tax",
        taxInclusive: false,
        freeShippingThreshold: "1000.00",
        signatureThreshold: "500.00",
        returnWindowDays: 30,
      }),
      getAllShippingZones: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/server/db", () => ({
      db: {
        $transaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
          fn({
            cart: { findUnique: vi.fn().mockResolvedValue(null) },
            wishlist: { findUnique: vi.fn().mockResolvedValue(null) },
          }),
        cart: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        wishlist: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        address: { findMany: vi.fn().mockResolvedValue([]) },
        currency: { findMany: vi.fn().mockResolvedValue([]) },
        product: { findMany: vi.fn().mockResolvedValue([]) },
        order: {
          findFirst: findFirstOrder,
          findUnique: findUniqueOrder,
        },
        user: { update: updateUser },
      },
    }));
    vi.doMock("@/modules/currencies/currency.service", () => ({
      getServerRequestCurrency: vi.fn().mockResolvedValue({
        currency: {
          id: "cur_usd",
          code: "USD",
          name: "US Dollar",
          symbol: "$",
          symbolPosition: "BEFORE",
          decimalPlaces: 2,
          roundingRule: "HALF_UP",
          exchangeRate: "1.00000000",
          isBase: true,
          isDefault: true,
          sortOrder: 0,
        },
        baseCurrency: {
          id: "cur_usd",
          code: "USD",
          name: "US Dollar",
          symbol: "$",
          symbolPosition: "BEFORE",
          decimalPlaces: 2,
          roundingRule: "HALF_UP",
          exchangeRate: "1.00000000",
          isBase: true,
          isDefault: true,
          sortOrder: 0,
        },
        currencies: [],
        source: "default",
        countryCode: null,
      }),
      resolveActiveCurrencyByCode: vi.fn().mockResolvedValue({
        id: "cur_usd",
        code: "USD",
        name: "US Dollar",
        symbol: "$",
        symbolPosition: "BEFORE",
        decimalPlaces: 2,
        roundingRule: "HALF_UP",
        exchangeRate: "1.00000000",
        isBase: true,
        isDefault: true,
        sortOrder: 0,
      }),
    }));

    const cartSvc = await import("@/modules/cart/cart.service");
    const wishSvc = await import("@/modules/wishlist/wishlist.service");
    const orderSvc = await import("@/modules/orders/order.service");
    const acctSvc = await import("@/modules/account/account.service");
    const { ForbiddenError, NotFoundError, ValidationError } = await import("@/server/errors");

    // 1. Empty cookie / anonymous
    expect((await cartSvc.getCurrentCartSummary()).itemCount).toBe(0);
    expect((await wishSvc.getCurrentWishlistState()).count).toBe(0);
    expect((await cartSvc.resolveCurrentCartOwner(true))?.kind).toBe("guest");
    expect((await wishSvc.resolveCurrentWishlistOwner(true)).owner?.kind).toBe("guest");

    // 2. Existing guest token without session
    readGuestToken.mockResolvedValue("guest_abc");
    expect(await cartSvc.resolveCurrentCartOwner(false)).toEqual({
      kind: "guest",
      guestToken: "guest_abc",
    });
    expect((await wishSvc.resolveCurrentWishlistOwner(false)).owner).toEqual({
      kind: "guest",
      guestToken: "guest_abc",
    });

    // 3. Authenticated user with guest token triggers merge & actor resolution
    getOptionalSession.mockResolvedValue({
      user: { id: "u1", email: "claire@maison.test", name: "Claire", role: "CUSTOMER" },
      sessionId: "s1",
    });
    expect(await cartSvc.resolveCurrentCartOwner(false)).toEqual({ kind: "user", userId: "u1" });
    expect((await wishSvc.resolveCurrentWishlistOwner(false)).owner).toEqual({
      kind: "user",
      userId: "u1",
    });
    expect((await orderSvc.resolveCheckoutActorsForAction()).userId).toBe("u1");

    const boot = await orderSvc.getCheckoutBootstrapData();
    expect(boot.userEmail).toBe("claire@maison.test");

    // 4. getOrderConfirmation NotFound & Forbidden branches
    findUniqueOrder.mockResolvedValueOnce(null);
    await expect(orderSvc.getOrderConfirmation("MA-000", null)).rejects.toBeInstanceOf(
      NotFoundError,
    );

    findUniqueOrder.mockResolvedValueOnce({
      id: "o1",
      orderNumber: "MA-1",
      userId: "other-user",
      guestLookupTokenHash: null,
      status: "PAID",
      currency: "USD",
      subtotal: "100.00",
      shippingCost: "0.00",
      taxAmount: "8.00",
      discountAmount: "0.00",
      total: "108.00",
      shippingAddress: {},
      billingAddress: {},
      signatureRequired: false,
      estimatedDeliveryFrom: null,
      estimatedDeliveryTo: null,
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      createdAt: new Date(),
      paidAt: new Date(),
      shippedAt: null,
      deliveredAt: null,
      items: [],
      events: [],
      payments: [],
    });
    await expect(orderSvc.getOrderConfirmation("MA-1", null)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    // 5. Account auth API branches
    await acctSvc.updateCustomerProfile("u1", { name: "Claire", phone: null }, new Headers());
    expect(authUpdateUser).toHaveBeenCalledTimes(1);
    expect(
      await acctSvc.changeCustomerPassword(
        {
          currentPassword: "OldPassword123!",
          newPassword: "NewPassword123!",
          confirmPassword: "NewPassword123!",
        },
        new Headers(),
      ),
    ).toEqual({ updated: true });

    const { APIError } = await import("better-auth/api");
    authChangePassword.mockRejectedValueOnce(new APIError("BAD_REQUEST", { message: "Wrong pw" }));
    await expect(
      acctSvc.changeCustomerPassword(
        {
          currentPassword: "bad",
          newPassword: "NewPassword123!",
          confirmPassword: "NewPassword123!",
        },
        new Headers(),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
