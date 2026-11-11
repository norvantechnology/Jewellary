import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const VIEWPORTS = [360, 390, 768, 1024, 1280, 1440, 1920] as const;
const KEY_STOREFRONT_PATHS = [
  "/",
  "/collections/rings",
  "/products/celeste-cathedral-solitaire-ring",
  "/guides/understanding-diamond-4cs",
  "/contact",
] as const;

test.describe("Phase 8 E2E — Security Headers, Auth Barriers & Responsive/Theme/Axe Matrix", () => {
  test("enforces security headers and rejects unauthenticated protected API access (SEC-02, SEC-12)", async ({
    request,
  }) => {
    const homeRes = await request.get("/");
    expect(homeRes.status()).toBe(200);
    const headers = homeRes.headers();

    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy-report-only"]).toContain("'strict-dynamic'");
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");

    // Checkout route enables payment=(self)
    const checkoutRes = await request.get("/checkout");
    expect(checkoutRes.headers()["permissions-policy"]).toContain("payment=(self)");

    // Protected endpoints fail closed without credentials
    const exportUnauth = await request.get("/api/admin/export/orders");
    expect([401, 403]).toContain(exportUnauth.status());

    const cronUnauth = await request.post("/api/cron/release-reservations");
    expect(cronUnauth.status()).toBe(401);

    const uploadConfirmUnauth = await request.post("/api/uploads/confirm", {
      data: { tempKey: "tmp/test.jpg", folder: "products", mode: "local" },
    });
    expect([401, 403]).toContain(uploadConfirmUnauth.status());
  });

  test("maintains zero horizontal overflow across all 7 required viewports and Light/Dark themes with zero CSP/axe violations", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const enforcedCspViolations: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        if (event.disposition === "enforce") {
          (window as unknown as { __enforcedCspViolations?: string[] }).__enforcedCspViolations ??=
            [];
          (
            window as unknown as { __enforcedCspViolations?: string[] }
          ).__enforcedCspViolations!.push(
            `${event.violatedDirective}:${event.blockedURI}:${event.sourceFile ?? ""}`,
          );
        }
      });
    });

    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const path of KEY_STOREFRONT_PATHS) {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(path);
        await expect(page.locator("h1")).toHaveCount(1);
        await page.evaluate((targetTheme) => {
          localStorage.setItem("aurelia-theme", targetTheme);
          document.documentElement.classList.remove("light", "dark");
          document.documentElement.classList.add(targetTheme);
          document.documentElement.style.colorScheme = targetTheme;
        }, theme);

        // Axe WCAG 2.2 AA check per page x theme
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        const seriousOrCritical = axe.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        expect(seriousOrCritical, `Axe violations on ${path} (${theme})`).toEqual([]);

        const recordedCsp = await page.evaluate(
          () =>
            (window as unknown as { __enforcedCspViolations?: string[] }).__enforcedCspViolations ??
            [],
        );
        enforcedCspViolations.push(...recordedCsp);

        // Overflow sweep across all 7 viewports (360, 390, 768, 1024, 1280, 1440, 1920)
        for (const width of VIEWPORTS) {
          await page.setViewportSize({ width, height: 850 });
          const overflow = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
          expect(
            overflow.scrollWidth,
            `Horizontal overflow on ${path} (${theme}) at ${width}px`,
          ).toBeLessThanOrEqual(overflow.clientWidth + 1);
        }
      }
    }

    expect(enforcedCspViolations).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
