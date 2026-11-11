import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Phase 2 — Authentication, RBAC & Health", () => {
  test("redirects unauthenticated visitors on protected routes to login", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  });

  test("login, register, and forgot-password pages render accessibly", async ({ page }) => {
    for (const path of ["/login", "/register", "/forgot-password", "/verify-email"]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
        `A11y violation on ${path}`,
      ).toEqual([]);
    }
  });

  test("authenticates customer, enforces RBAC on /admin, and allows admin access", async ({
    page,
    request,
  }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    const body = (await health.json()) as { status: string; database: string };
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");

    // Sign in as demo customer
    await page.goto("/login");
    await page.getByLabel(/Email Address/i).fill("claire@example.com");
    await page.getByLabel(/Password/i).fill("CustomerDemoPass123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: "Claire Laurent" })).toBeVisible();

    // Customer cannot access Admin Studio
    await page.goto("/admin");
    await expect(page.getByText("Access Restricted")).toBeVisible();

    // Sign out cleanly
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL("/");

    // Sign in as Admin
    await page.goto("/login?next=/admin");
    await page.getByLabel(/Email Address/i).fill("admin@example.com");
    await page.getByLabel(/Password/i).fill("AdminChangeMe123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: "Admin Studio" })).toBeVisible();
  });
});
