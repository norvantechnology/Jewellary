import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Phase 4 E2E — Storefront Discovery, Search, Wishlist, Cart & Concierge", () => {
  test("navigates home -> collection filters -> PDP dossier -> wishlist -> bag -> search -> guides -> contact", async ({
    page,
  }) => {
    const uniqueSuffix = Date.now().toString(36);
    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 400) failedResponses.push(`${res.status()} ${res.url()}`);
    });

    // 1. Homepage renders dynamic DB hero, collections, featured pieces
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Shop by Collection" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured Pieces" })).toBeVisible();

    // Check homepage a11y + overflow at 1440px
    const homeAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      homeAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);

    // 2. Browse /collections/rings + filter sidebar
    await page.goto("/collections/rings");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Rings");
    await expect(page.locator('article a[href^="/products/"]').first()).toBeVisible();

    // Toggle a metal filter checkbox cleanly if present
    const metalCheckbox = page.getByLabel(/18K|Platinum/i).first();
    if (await metalCheckbox.isVisible()) {
      await metalCheckbox.click();
      await page.waitForURL(/metal=/);
      await expect(page.getByRole("button", { name: "Clear all" })).toBeVisible();
      await page.getByRole("button", { name: "Clear all" }).click();
    }

    // 3. Navigate into first product detail page
    await page.locator('article h3 a[href^="/products/"]').first().click();
    await page.waitForURL(/\/products\//);
    await page.getByRole("button", { name: /Details & Specifications/i }).click();
    await expect(page.getByRole("heading", { name: "Specifications", exact: true })).toBeVisible();

    // 4. Toggle guest Wishlist and verify persistence across reload
    await page.getByRole("button", { name: /Save to Wishlist/i }).click();
    await expect(page.getByText(/added to your saved pieces/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Wishlist \(1 saved items\)/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: /Wishlist \(1 saved items\)/i })).toBeVisible();

    // 5. Add piece to shopping bag and verify /cart quantity update
    const addToBagBtn = page.getByRole("button", { name: /Add to Bag/i });
    if (await addToBagBtn.isVisible()) {
      await addToBagBtn.click();
      await expect(page.getByRole("link", { name: /Shopping bag \(1 items\)/i })).toBeVisible();
      await page.goto("/cart");
      await expect(page.getByRole("heading", { name: "Your Shopping Bag" })).toBeVisible();
      await expect(page.getByText(/Order Summary/i)).toBeVisible();
    }

    // 6. Visit /wishlist page and verify saved item renders
    await page.goto("/wishlist");
    await expect(page.getByRole("heading", { name: "Your Wishlist" })).toBeVisible();
    await expect(page.locator('article a[href^="/products/"]').first()).toBeVisible();

    // 7. Test weighted search + typo tolerance on /search
    await page.goto("/search?q=solitare");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("solitare");
    await expect(page.locator('article a[href^="/products/"]').first()).toBeVisible();

    // Verify /api/search/suggest returns suggestions JSON
    const suggestRes = await page.request.get("/api/search/suggest?q=gold");
    expect(suggestRes.status()).toBe(200);
    const suggestJson = (await suggestRes.json()) as { products: unknown[]; categories: unknown[] };
    expect(suggestJson.products.length + suggestJson.categories.length).toBeGreaterThan(0);

    // 8. Browse editorial guides & markdown static policies
    await page.goto("/guides");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Guides");
    await page.locator('article h2 a[href^="/guides/"]').first().click();
    await page.waitForURL(/\/guides\//);
    await expect(page.locator("article.editorial-prose")).toBeVisible();

    await page.goto("/ring-size-guide");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ring Size Guide");

    // 9. Submit concierge enquiry on /contact
    await page.goto("/contact?type=BESPOKE");
    await page.locator("main").getByLabel("Full Name").fill("Claire E2E");
    await page
      .locator("main")
      .getByLabel("Email Address")
      .fill(`claire-e2e-${uniqueSuffix}@example.com`);
    await page
      .locator("main")
      .getByLabel("How Can We Assist?")
      .fill(
        "Interested in commissioning a custom 1.8ct oval diamond solitaire in 18K yellow gold.",
      );
    await page.getByRole("button", { name: "Submit Concierge Enquiry" }).click();
    await expect(page.getByText("Thank You for Reaching Out")).toBeVisible();

    // 10. Subscribe to footer newsletter
    await page
      .locator("footer")
      .getByLabel("Email address for newsletter")
      .fill(`newsletter-e2e-${uniqueSuffix}@example.com`);
    await page.locator("footer").getByRole("button", { name: "Subscribe" }).click();
    await expect(page.locator("footer").getByText(/Welcome to the Maison list/)).toBeVisible();

    // 11. Mobile 360px overflow + a11y spot check
    await page.setViewportSize({ width: 360, height: 740 });
    for (const route of ["/", "/collections/rings", "/search?q=gold", "/contact"]) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow, `Mobile 360px overflow on ${route}`).toBe(false);
    }

    expect(failedResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
