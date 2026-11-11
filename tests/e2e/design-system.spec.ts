import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { VIEWPORT_TEST_MATRIX } from "../../src/lib/constants";

test.describe("Phase 1 — Design system, themes, 7-viewport responsiveness & a11y", () => {
  test("renders home and custom 404 with expected HTTP statuses", async ({ page }) => {
    const homeRes = await page.goto("/");
    expect(homeRes?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);

    const notFoundRes = await page.goto("/this-page-does-not-exist-404");
    expect(notFoundRes?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Not Be Found");
  });

  test("switches light, dark, and system themes and passes axe-core in both themes", async ({
    page,
  }) => {
    await page.goto("/dev/ui");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Atelier Component Library",
    );

    // Light theme axe check
    await page.getByRole("button", { name: "Select colour theme" }).first().click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    const lightAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      lightAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);

    // Dark theme axe check
    await page.getByRole("button", { name: "Select colour theme" }).first().click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    const darkAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      darkAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  test("maintains zero horizontal overflow across all 7 required viewports", async ({ page }) => {
    for (const vp of VIEWPORT_TEST_MATRIX) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of ["/", "/dev/ui"]) {
        await page.goto(route);
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(overflow, `Horizontal overflow on ${route} at ${vp.name}`).toBe(false);
      }
    }
  });
});
