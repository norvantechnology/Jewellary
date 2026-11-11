import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

test.describe("Phase 6 E2E — Guest Order Track, Account Suite, Admin Ops, RBAC, Invoice & Export", () => {
  const createdOrderNumbers: string[] = [];
  const createdEmails: string[] = [];

  test.afterAll(async () => {
    try {
      process.loadEnvFile?.();
    } catch {
      // Ignore if .env is absent
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
          } else if (
            orderRow.status === "PAID" ||
            orderRow.status === "PROCESSING" ||
            orderRow.status === "PACKED" ||
            orderRow.status === "SHIPPED" ||
            orderRow.status === "DELIVERED"
          ) {
            await pool.query(
              `UPDATE "ProductVariant" SET "stockQty" = "stockQty" + $1 WHERE id = $2`,
              [item.quantity, item.variantId],
            );
          }
        }

        await pool.query(`DELETE FROM "AuditLog" WHERE "entityId" = $1`, [orderRow.id]);
        await pool.query(`DELETE FROM "InventoryTransaction" WHERE "referenceId" = $1`, [
          orderRow.id,
        ]);
        await pool.query(`DELETE FROM "Order" WHERE id = $1`, [orderRow.id]);
      }

      if (createdEmails.length > 0) {
        await pool.query(`DELETE FROM "Enquiry" WHERE email = ANY($1::text[])`, [createdEmails]);
        await pool.query(`DELETE FROM "AuditLog" WHERE "actorEmail" = ANY($1::text[])`, [
          createdEmails,
        ]);
        await pool.query(`DELETE FROM "user" WHERE email = ANY($1::text[])`, [createdEmails]);
      }
    } finally {
      await pool.end();
    }
  });

  test("registers client, places order, tracks as guest, manages account orders/addresses/settings", async ({
    page,
  }) => {
    const suffix = Date.now().toString(36);
    const clientEmail = `e2e-p6-client-${suffix}@example.com`;
    const clientPassword = `ClientPass!${suffix}`;
    createdEmails.push(clientEmail);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // 1. Register new client & sign in automatically
    await page.goto("/register");
    await page.locator("#register-name").fill("Evelyn Vance");
    await page.locator("#register-email").fill(clientEmail);
    await page.locator("#register-password").fill(clientPassword);
    await page.locator("#register-confirm").fill(clientPassword);
    await page.locator("#register-terms").click();
    await page.getByRole("button", { name: /Create Account/i }).click();
    await page.waitForURL(/\/account|\/$/);

    // 2. Place a sandbox order via storefront checkout
    await page.goto("/collections/rings");
    await page.locator('article h3 a[href^="/products/"]').first().click();
    await page.waitForURL(/\/products\//);
    await page.getByRole("button", { name: /Add to Bag/i }).click();
    await expect(page.getByRole("link", { name: /Shopping bag \(1 items\)/i })).toBeVisible();

    await page.goto("/checkout");
    await expect(page.locator("#checkout-email")).toHaveValue(clientEmail);
    await page.getByLabel(/Recipient Full Name/i).fill("Evelyn Vance");
    await page.getByLabel(/Courier Contact Phone/i).fill("+1 212 555 0199");
    await page.getByLabel(/Street Address/i).fill("350 Park Avenue");
    await page.getByLabel(/^City/i).fill("New York");
    await page.getByLabel(/State \/ Province/i).fill("NY");
    await page.getByLabel(/Postal \/ ZIP Code/i).fill("10022");
    await page.getByRole("button", { name: /Reserve & Continue to Payment/i }).click();
    await expect(page.getByText(/Vault Hold Active/i)).toBeVisible();

    const orderTitle = await page
      .getByRole("heading", { name: /Order ORD-\d{4}-\d{5,}/ })
      .innerText();
    const orderNumber = orderTitle.replace(/^Order\s+/i, "").trim();
    createdOrderNumbers.push(orderNumber);

    await page.getByRole("button", { name: /Authorize & Complete Order/i }).click();
    await page.waitForURL(new RegExp(`/orders/${orderNumber}/confirmation`));
    await expect(page.getByText(/Order Confirmed/i).first()).toBeVisible();

    // 3. Navigate Client Account suite (/account, /account/orders, /account/orders/[orderNumber], /account/addresses, /account/settings)
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Evelyn Vance" })).toBeVisible();

    const accountAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      accountAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);

    await page.goto("/account/orders");
    await expect(page.getByRole("link", { name: orderNumber }).first()).toBeVisible();
    await page.getByRole("link", { name: orderNumber }).first().click();
    await page.waitForURL(new RegExp(`/account/orders/${orderNumber}`));
    await expect(page.getByText(/350 Park Avenue/).first()).toBeVisible();

    await page.goto("/account/addresses");
    await page.getByRole("button", { name: "Add Address" }).click();
    await page.locator("#addr-label").fill("Summer Residence");
    await page.locator("#addr-fullname").fill("Evelyn Vance");
    await page.locator("#addr-phone").fill("+1 212 555 0177");
    await page.locator("#addr-line1").fill("18 Beacon Street");
    await page.locator("#addr-city").fill("Boston");
    await page.locator("#addr-state").fill("MA");
    await page.locator("#addr-postal").fill("02108");
    await page.getByRole("button", { name: "Save Address" }).click();
    await expect(page.getByText("Summer Residence")).toBeVisible();

    await page.goto("/account/settings");
    await page.locator("#settings-phone").fill("+1 212 555 0155");
    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByText("Profile updated")).toBeVisible();

    // 4. Sign out and verify Guest Order Tracking (/orders/track)
    await page.getByRole("button", { name: "Sign Out" }).click();
    await page.waitForURL(/\/$/);

    await page.goto("/orders/track");
    const trackAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      trackAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);

    // Non-matching email returns non-enumerating error
    await page.locator("#track-order-number").fill(orderNumber);
    await page.locator("#track-order-email").fill("wrong-person@example.com");
    await page.getByRole("button", { name: "Find Order Status" }).click();
    await expect(page.locator("main [role='alert']").first()).toContainText(/could not verify/i);

    // Matching email reveals order summary & timeline
    await page.locator("#track-order-email").fill(clientEmail);
    await page.getByRole("button", { name: "Find Order Status" }).click();
    await expect(page.getByRole("heading", { name: `Order ${orderNumber}` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Printable Receipt" })).toBeVisible();

    // Verify 360px mobile overflow check on /orders/track
    await page.setViewportSize({ width: 360, height: 800 });
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflow).toBe(false);
    expect(consoleErrors).toEqual([]);
  });

  test("executes Admin orders fulfillment/refund/invoice, enquiries reply, RBAC export, audit log & mobile layout", async ({
    page,
    browser,
  }) => {
    const suffix = Date.now().toString(36);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Submit a customer concierge enquiry first so inbox has a fresh record
    const enquiryEmail = `enquiry-p6-${suffix}@example.com`;
    createdEmails.push(enquiryEmail);
    await page.goto("/contact");
    await page.locator("#enquiry-name").fill("Julian Sterling");
    await page.locator("#enquiry-email").fill(enquiryEmail);
    await page
      .locator("#enquiry-message")
      .fill("Inquiring about bespoke 2.5ct emerald cut platinum mounting timeline.");
    await page.getByRole("button", { name: /Submit Concierge Enquiry/i }).click();
    await expect(page.getByText(/concierge team|received/i).first()).toBeVisible();

    // Sign in as ADMIN
    await page.goto("/login");
    await page.locator("main").getByLabel(/Email/i).fill("admin@example.com");
    await page
      .locator("main")
      .getByLabel(/Password/i)
      .fill("AdminChangeMe123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await page.waitForURL(/\/account|\/admin|\/$/);

    // 1. Admin Dashboard & Charts
    await page.goto("/admin?period=7d");
    await expect(page.getByRole("heading", { name: "Admin Studio" })).toBeVisible();
    await expect(page.getByText("Revenue Trajectory")).toBeVisible();

    const adminAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      adminAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);

    // 2. Admin Orders -> inspect seeded or recent order, transition/tracking, invoice
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    const firstOrderLink = page.locator('a[href^="/admin/orders/"]').first();
    await firstOrderLink.click();
    await page.waitForURL(/\/admin\/orders\/[a-z0-9]+$/i);

    await page.locator("#order-carrier").fill("Malca-Amit Insured");
    await page.locator("#order-tracking-number").fill(`WB-${suffix.toUpperCase()}`);
    await page.getByRole("button", { name: "Save Order Update" }).click();
    await expect(page.getByText(/updated/i).first()).toBeVisible();

    await page.getByRole("link", { name: /Invoice \/ Packing Slip/i }).click();
    await page.waitForURL(/\/admin\/orders\/.+\/invoice$/);
    await expect(page.getByRole("heading", { name: "Commercial Invoice" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Atelier Packing Slip" })).toBeVisible();

    // 3. Admin Enquiries -> reply cleanly
    await page.goto("/admin/enquiries");
    await expect(page.getByText("Julian Sterling").first()).toBeVisible();
    await page.getByRole("button", { name: "Reply to Client" }).first().click();
    await page
      .locator("#reply-message")
      .fill("Our master setter can inspect diamonds next Tuesday.");
    await page.getByRole("button", { name: "Send Concierge Reply" }).click();
    await expect(page.getByText(/Concierge reply sent|Reply recorded/i)).toBeVisible();

    // 4. Admin CSV Export & RBAC (ADMIN -> 200 for customers.csv; unauthenticated/CUSTOMER -> 401/403)
    const adminExportRes = await page.request.get("/api/admin/export/customers");
    expect(adminExportRes.status()).toBe(200);
    expect(await adminExportRes.text()).toContain("Email,Phone,Role");

    // Verify unauthenticated request to export returns 401
    const baseUrl = new URL(page.url()).origin;
    const anonCtx = await browser.newContext();
    const anonRes = await anonCtx.request.get(`${baseUrl}/api/admin/export/orders`);
    expect([401, 403]).toContain(anonRes.status());
    await anonCtx.close();

    // 5. Admin Customers & Audit Log
    await page.goto("/admin/customers");
    await expect(page.getByRole("heading", { name: /Customers & Roles/i })).toBeVisible();

    await page.goto("/admin/audit-log");
    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
    await expect(page.getByText("export.csv").first()).toBeVisible();

    // 6. Verify Admin mobile 360px layout renders cleanly with zero horizontal scroll
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/admin/orders");
    const adminOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(adminOverflow).toBe(false);
    expect(consoleErrors).toEqual([]);
  });
});
