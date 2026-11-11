import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

test.describe("Phase 5 E2E — Cart Estimator, Atomic Checkout, Sandbox Payment Retry & Confirmation", () => {
  const createdOrderNumbers: string[] = [];
  const createdEmails: string[] = [];

  test.afterAll(async () => {
    try {
      process.loadEnvFile?.();
    } catch {
      // Ignore if .env is absent in CI when DATABASE_URL is already injected
    }
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return;
    const pool = new Pool({ connectionString: dbUrl });

    try {
      for (const orderNumber of createdOrderNumbers) {
        const orderRes = await pool.query<{ id: string; status: string }>(
          `SELECT id, status FROM "Order" WHERE "orderNumber" = $1`,
          [orderNumber],
        );
        const orderRow = orderRes.rows[0];
        if (!orderRow) continue;

        const itemsRes = await pool.query<{ variantId: string; quantity: number }>(
          `SELECT "variantId", quantity FROM "OrderItem" WHERE "orderId" = $1`,
          [orderRow.id],
        );
        for (const item of itemsRes.rows) {
          if (orderRow.status === "PENDING_PAYMENT" || orderRow.status === "PAYMENT_FAILED") {
            await pool.query(
              `UPDATE "ProductVariant" SET "reservedQty" = GREATEST(0, "reservedQty" - $1) WHERE id = $2`,
              [item.quantity, item.variantId],
            );
          } else if (orderRow.status === "PAID") {
            await pool.query(
              `UPDATE "ProductVariant" SET "stockQty" = "stockQty" + $1 WHERE id = $2`,
              [item.quantity, item.variantId],
            );
          }
        }

        await pool.query(`DELETE FROM "InventoryTransaction" WHERE "referenceId" = $1`, [
          orderRow.id,
        ]);
        await pool.query(`DELETE FROM "Order" WHERE id = $1`, [orderRow.id]);
      }

      if (createdEmails.length > 0) {
        await pool.query(`DELETE FROM "user" WHERE email = ANY($1::text[])`, [createdEmails]);
      }
      await pool.query(`DELETE FROM "Address" WHERE line1 = '101 California Street'`);
    } finally {
      await pool.end();
    }
  });

  test("completes guest checkout with decline simulation, retry recovery, confirmation, a11y & 360px layout", async ({
    page,
  }) => {
    const suffix = Date.now().toString(36);
    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 400) failedResponses.push(`${res.status()} ${res.url()}`);
    });

    // 1. Browse Rings -> open first product -> Add to Bag
    await page.goto("/collections/rings");
    await page.locator('article h3 a[href^="/products/"]').first().click();
    await page.waitForURL(/\/products\//);

    await page.getByRole("button", { name: /Add to Bag/i }).click();
    await expect(page.getByRole("link", { name: /Shopping bag \(1 items\)/i })).toBeVisible();

    // 2. Cart destination shipping estimator + free-shipping indicator -> Proceed to Checkout
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Your Shopping Bag" })).toBeVisible();
    await page.locator("#cart-estimate-country").click();
    await page.getByRole("option", { name: /Canada \(CA\)/i }).click();
    await expect(page.getByText(/Insured International Courier/i)).toBeVisible();

    await page.getByRole("link", { name: "Proceed to Checkout" }).click();
    await page.waitForURL(/\/checkout$/);

    // Accessibility check on /checkout
    const checkoutAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      checkoutAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);

    // 3. Fill Contact & Shipping Address, verify US courier quote, reserve vault stock
    const guestEmail = `checkout-e2e-${suffix}@example.com`;
    await page.locator("#checkout-email").fill(guestEmail);
    await page.getByLabel(/Recipient Full Name/i).fill("Camille Laurent");
    await page.getByLabel(/Courier Contact Phone/i).fill("+1 212 555 0188");
    await page.getByLabel(/Street Address/i).fill("742 Madison Avenue");
    await page.getByLabel(/^City/i).fill("New York");
    await page.getByLabel(/State \/ Province/i).fill("NY");
    await page.getByLabel(/Postal \/ ZIP Code/i).fill("10065");

    await expect(
      page.getByRole("radio", { name: /Insured Domestic Express \(US\)/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Reserve & Continue to Payment/i }).click();

    await expect(page.getByText(/Vault Hold Active/i)).toBeVisible();
    const orderTitle = await page
      .getByRole("heading", { name: /Order ORD-\d{4}-\d{5,}/ })
      .innerText();
    const orderNumberMatch = orderTitle.match(/ORD-\d{4}-\d{5,}/);
    expect(orderNumberMatch).not.toBeNull();
    const orderNumber = orderNumberMatch![0];
    createdOrderNumbers.push(orderNumber);

    // Header bag count resets immediately upon atomic reservation
    await expect(page.getByRole("link", { name: /Shopping bag \(0 items\)/i })).toBeVisible();

    // 4. Simulate Card Decline -> Retry -> Authorize & Complete
    await page.getByRole("button", { name: "Simulate Card Decline" }).click();
    await expect(page.getByText(/Card authorization was declined/i)).toBeVisible();

    await page.getByRole("button", { name: "Retry Payment Authorization" }).click();
    await expect(page.getByRole("button", { name: /Authorize & Complete Order/i })).toBeVisible();

    await page.getByRole("button", { name: /Authorize & Complete Order/i }).click();
    await page.waitForURL(new RegExp(`/orders/${orderNumber}/confirmation\\?token=`));

    // 5. Verify Order Confirmation page content & accessibility
    await expect(page.getByRole("heading", { name: `Order ${orderNumber}` })).toBeVisible();
    await expect(page.getByText("Order Confirmed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Camille Laurent")).toBeVisible();
    await expect(page.getByRole("button", { name: "Print Receipt" })).toBeVisible();

    const confAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      confAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);

    // Mobile 360px overflow check across confirmation & cart
    await page.setViewportSize({ width: 360, height: 740 });
    for (const url of [page.url(), "/cart"]) {
      await page.goto(url);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow, `Mobile 360px overflow on ${url}`).toBe(false);
    }

    expect(failedResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("supports authenticated patron checkout saving address and loading confirmation without guest token", async ({
    page,
  }) => {
    const email = "claire@example.com";

    // Sign in as demo customer cleanly
    await page.goto("/login");
    await page.getByLabel(/Email Address/i).fill(email);
    await page.getByLabel(/Password/i).fill("CustomerDemoPass123!");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/account/);

    // Add item -> Checkout
    await page.goto("/collections/necklaces");
    await page.locator('article h3 a[href^="/products/"]').first().click();
    await page.waitForURL(/\/products\//);
    await page.getByRole("button", { name: /Add to Bag/i }).click();
    await expect(page.getByRole("link", { name: /Shopping bag \(1 items\)/i })).toBeVisible();

    await page.goto("/checkout");
    await expect(page.locator("#checkout-email")).toHaveValue(email);
    await page.getByLabel(/Recipient Full Name/i).fill("Claire Laurent");
    await page.getByLabel(/Courier Contact Phone/i).fill("+1 415 555 0190");
    await page.getByLabel(/Street Address/i).fill("101 California Street");
    await page.getByLabel(/^City/i).fill("San Francisco");
    await page.getByLabel(/State \/ Province/i).fill("CA");
    await page.getByLabel(/Postal \/ ZIP Code/i).fill("94111");
    await page.getByLabel(/Save this shipping address/i).click();

    await page.getByRole("button", { name: /Reserve & Continue to Payment/i }).click();
    await expect(page.getByText(/Vault Hold Active/i)).toBeVisible();

    const orderTitle = await page
      .getByRole("heading", { name: /Order ORD-\d{4}-\d{5,}/ })
      .innerText();
    const orderNumber = orderTitle.match(/ORD-\d{4}-\d{5,}/)![0];
    createdOrderNumbers.push(orderNumber);

    await page.getByRole("button", { name: /Authorize & Complete Order/i }).click();
    await page.waitForURL(new RegExp(`/orders/${orderNumber}/confirmation`));

    // Verify signed-in owner can load confirmation URL WITHOUT query token!
    await page.goto(`/orders/${orderNumber}/confirmation`);
    await expect(page.getByRole("heading", { name: `Order ${orderNumber}` })).toBeVisible();
    await expect(page.getByText("101 California Street")).toBeVisible();
  });
});
