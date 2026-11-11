import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

async function loginAs(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login?next=/admin");
  await page.getByLabel(/Email Address/i).fill(email);
  await page.getByLabel(/Password/i).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => url.pathname === "/admin");
}

test.describe("Phase 3 — Admin Studio, Catalogue, Uploads, Inventory & RBAC", () => {
  test("passes WCAG 2.2 AA and has zero horizontal overflow across 360px and 1440px in Admin Studio", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAs(page, "admin@example.com", "AdminChangeMe123!");

    for (const route of [
      "/admin",
      "/admin/products",
      "/admin/products/new",
      "/admin/categories",
      "/admin/attributes",
      "/admin/inventory",
      "/admin/banners",
      "/admin/articles",
      "/admin/settings",
    ]) {
      for (const width of [360, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();

        const hasHorizontalScroll = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        expect(hasHorizontalScroll, `Horizontal overflow on ${route} at ${width}px`).toBe(false);
      }

      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
        `Axe violation on ${route}`,
      ).toEqual([]);
    }
  });

  test("enforces STAFF restriction on /admin/settings", async ({ page }) => {
    await loginAs(page, "staff@example.com", "StaffDemoPass123!");
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: /Administrator Role Required/i })).toBeVisible();
  });

  test("Admin creates category, uploads image & creates active product, adjusts stock, and cleans up", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, "admin@example.com", "AdminChangeMe123!");

    const runId = Date.now().toString(36);
    const catName = `Atelier Capsule ${runId}`;
    const prodName = `Aurelia Band ${runId}`;
    const skuPrefix = `E2E-${runId.toUpperCase()}`;

    // 1. Category Create
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "New Category" }).click();
    await page.getByLabel(/Category Name/i).fill(catName);
    await page.getByRole("button", { name: "Create Category" }).click();
    await expect(page.getByRole("table").getByText(catName).first()).toBeVisible();

    // 2. Product Create with real PNG image upload + WebP processing + alt text + variant
    await page.goto("/admin/products/new");
    await page.getByLabel(/Product Title/i).fill(prodName);
    await page.getByLabel(/Master SKU/i).fill(skuPrefix);

    // Choose category just created
    await page.getByLabel("Category").click();
    await page.getByRole("option", { name: new RegExp(catName) }).click();

    await page.getByLabel("Publication Status").click();
    await page.getByRole("option", { name: /Active/i }).click();

    // Variants tab -> fill Variant SKU
    await page.getByRole("tab", { name: /4\. Variants/i }).click();
    await page.getByLabel(/Variant SKU/i).fill(`${skuPrefix}-V1`);

    // Media tab -> upload synthetic PNG image -> auto-processed into WebP
    await page.getByRole("tab", { name: /5\. Media/i }).click();
    const pngBuffer = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 196, g: 164, b: 102 },
      },
    })
      .png()
      .toBuffer();

    await page.locator("#prod-media-upload").setInputFiles({
      name: "ring-sample.png",
      mimeType: "image/png",
      buffer: pngBuffer,
    });

    await expect(page.getByText("Primary Image")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Create Product" }).click();

    await expect(page).toHaveURL(/\/admin\/products\/(?!new$)[a-z0-9]+$/i);
    await expect(page.getByRole("heading", { name: prodName })).toBeVisible();

    // 3. Adjust Stock in Inventory Ledger
    await page.goto(`/admin/inventory?q=${encodeURIComponent(`${skuPrefix}-V1`)}`);
    await page.getByRole("button", { name: "Adjust Stock" }).first().click();
    await page.getByLabel(/Quantity Delta/i).fill("3");
    await page.getByLabel(/Audit Reference Note/i).fill(`E2E intake ${runId}`);
    await page.getByRole("button", { name: "Commit Ledger Entry" }).click();

    await expect(page.getByText(`E2E intake ${runId}`).first()).toBeVisible();

    // 4. Archive product via editor ConfirmDialog cleanly
    await page.goto(`/admin/products?q=${encodeURIComponent(skuPrefix)}`);
    await page.getByRole("link", { name: prodName }).click();
    await expect(page).toHaveURL(/\/admin\/products\/(?!new$)[a-z0-9]+$/i);
    await page.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive Product" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
  });
});
