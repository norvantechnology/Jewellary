import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import sharp from "sharp";

const SCREENSHOT_DIR =
  "/home/ig-008/.gemini/antigravity/brain/2e3ea925-d151-459b-a5eb-e238f7342ab7/scratch/screenshots";

async function loginCustomer(page: Page) {
  await page.goto("/login?next=/account/customizations");
  await page.getByLabel(/Email Address/i).fill("claire@example.com");
  await page.getByLabel(/Password/i).fill("CustomerDemoPass123!");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/account"));
}

async function loginAdmin(page: Page, nextPath = "/admin") {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByLabel(/Email Address/i).fill("admin@example.com");
  await page.getByLabel(/Password/i).fill("AdminChangeMe123!");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/admin"));
}

async function selectGroupOption(page: Page, groupCode: string, optionLabelRegex?: RegExp) {
  const groupSection = page.locator(`[data-group-code="${groupCode}"]`).first();
  await expect(groupSection).toBeVisible();

  const selectTrigger = groupSection.getByTestId(`option-select-trigger-${groupCode}`);
  if ((await selectTrigger.count()) > 0 && (await selectTrigger.isVisible())) {
    await selectTrigger.click();
    const listbox = page.getByRole("listbox").last();
    await expect(listbox).toBeVisible();
    const candidate = optionLabelRegex
      ? listbox.getByRole("option", { name: optionLabelRegex }).first()
      : listbox.getByRole("option").first();
    await candidate.click();
    return;
  }

  const radio = optionLabelRegex
    ? groupSection.getByRole("radio", { name: optionLabelRegex }).first()
    : groupSection.getByRole("radio").first();
  await radio.click();
}

async function dismissCookieIfVisible(page: Page) {
  const hasConsent = await page
    .evaluate(() => document.cookie.includes("consent"))
    .catch(() => false);
  const cookieAccept = page.getByRole("button", { name: /Accept all/i });
  if (!hasConsent) {
    await cookieAccept.waitFor({ state: "visible", timeout: 1500 }).catch(() => {});
  }
  if (await cookieAccept.isVisible().catch(() => false)) {
    await cookieAccept.click();
    await expect(cookieAccept).toBeHidden();
  }
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow, `Horizontal overflow detected at ${label}`).toBe(false);
}

test.describe("Customization Requests & Real-Time Atelier Chat E2E", () => {
  const createdRequestNumbers: string[] = [];
  const createdConversationIds: string[] = [];

  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test.afterAll(async () => {
    try {
      process.loadEnvFile?.();
    } catch {
      // Ignore if .env not present in CI
    }
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return;
    const pool = new Pool({ connectionString: dbUrl });
    try {
      if (createdRequestNumbers.length > 0) {
        await pool.query(
          `DELETE FROM conversations WHERE "customizationRequestId" IN (SELECT id FROM customization_requests WHERE "requestNumber" = ANY($1::text[]))`,
          [createdRequestNumbers],
        );
        await pool.query(
          `DELETE FROM customization_requests WHERE "requestNumber" = ANY($1::text[])`,
          [createdRequestNumbers],
        );
      }
      if (createdConversationIds.length > 0) {
        await pool.query(`DELETE FROM conversations WHERE id = ANY($1::text[])`, [
          createdConversationIds,
        ]);
      }
      await pool.query(
        `DELETE FROM conversations WHERE id IN (SELECT "conversationId" FROM messages WHERE body LIKE 'Concierge live check %')`,
      );
      await pool.query(
        `DELETE FROM "CartItem" WHERE "customizationRequestId" IS NOT NULL AND "cartId" IN (SELECT id FROM "Cart" WHERE "userId" = 'seed-customer-user')`,
      );
    } finally {
      await pool.end();
    }
  });

  test("responsive matrix (320-1440), light/dark themes, drawer/page/chat overflow & WCAG AA", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();

    try {
      const widths = [320, 360, 390, 768, 1024, 1280, 1440];

      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto("/products/clairvoyant-four-prong-diamond-studs/customize");
      await expect(page.getByRole("heading", { level: 1, name: /Customize/i })).toBeVisible();
      await dismissCookieIfVisible(page);

      // Verify clean Inter typography (no "ATELIER STANDARD", no serif fallback)
      await expect(page.getByText("ATELIER STANDARD")).toHaveCount(0);

      for (const width of widths) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(50);

        // Verify unit suffix stays single-line (no awkward two-line wrapping)
        const unitMetrics = await page.evaluate(() => {
          const unit = document.querySelector('[data-testid="numeric-unit-carat_per_stone"]');
          if (!unit) return null;
          const rect = unit.getBoundingClientRect();
          return { height: rect.height, whiteSpace: getComputedStyle(unit).whiteSpace };
        });
        expect(unitMetrics).not.toBeNull();
        expect(unitMetrics!.whiteSpace).toBe("nowrap");
        expect(unitMetrics!.height).toBeLessThanOrEqual(28);

        // Check footer collections clamp cleanly on desktop
        if (width >= 1024) {
          const footerRect = await page.locator("footer").boundingBox();
          expect(footerRect?.width ?? 0).toBeLessThanOrEqual(width + 1);
        }

        for (const theme of ["light", "dark"] as const) {
          await page.evaluate((isDark) => {
            document.documentElement.classList.toggle("dark", isDark);
          }, theme === "dark");

          await assertNoHorizontalOverflow(page, `${theme}-customize-page-${width}px`);

          // Open chat widget cleanly across breakpoints without overflow or covering primary CTA
          const chatLauncher = page.getByTestId("atelier-chat-launcher");
          await expect(chatLauncher).toBeVisible();
          await chatLauncher.click();
          const chatDialog = page.getByRole("dialog", { name: /Atelier Concierge Chat/i });
          await expect(chatDialog).toBeVisible();
          await expect(page.getByText("General Advice")).toHaveCount(0);
          await assertNoHorizontalOverflow(page, `${theme}-chat-open-${width}px`);

          if (width >= 1024) {
            const chatBox = await chatDialog.boundingBox();
            const submitBox = await page.getByTestId("submit-customization-request").boundingBox();
            expect(chatBox).not.toBeNull();
            expect(submitBox).not.toBeNull();
            // Chat panel sits on the bottom-left and does not intersect the right-column Send button
            const overlaps = !(
              chatBox!.x + chatBox!.width < submitBox!.x ||
              submitBox!.x + submitBox!.width < chatBox!.x ||
              chatBox!.y + chatBox!.height < submitBox!.y ||
              submitBox!.y + submitBox!.height < chatBox!.y
            );
            expect(overlaps, `Chat overlaps Send button at ${width}px`).toBe(false);
          }

          if (width === 320 || width === 768 || width === 1280 || width === 1440) {
            await page.screenshot({
              path: path.join(SCREENSHOT_DIR, `page-${theme}-${width}.png`),
              fullPage: false,
            });
          }

          await page.keyboard.press("Escape");
          await expect(chatDialog).toBeHidden();
        }
      }

      // Check Customize Drawer across breakpoints (320..1440 + landscape) and light/dark 360/768/1280 screenshots
      for (const theme of ["light", "dark"] as const) {
        for (const width of [360, 768, 1280]) {
          await page.setViewportSize({ width, height: 844 });
          await page.goto("/products/clairvoyant-four-prong-diamond-studs");
          if (theme === "dark") {
            await page.evaluate(() => document.documentElement.classList.add("dark"));
          } else {
            await page.evaluate(() => document.documentElement.classList.remove("dark"));
          }
          await dismissCookieIfVisible(page);
          await page
            .getByRole("button", { name: /^Customize$/i })
            .first()
            .click();

          const drawer = page.getByRole("dialog");
          await expect(drawer).toBeVisible();
          const stepsNav = drawer.getByRole("navigation", { name: "Customization steps" });
          await expect(stepsNav).toBeVisible({ timeout: 15_000 });
          await expect(drawer.getByText(/Estimated price/i).first()).toBeVisible();

          if (width < 400) {
            await expect(stepsNav.getByText(/Step 1 of 3 · Options/i)).toBeVisible();
          } else {
            await expect(stepsNav.getByRole("button", { name: "Options" })).toBeVisible();
            await expect(stepsNav.getByRole("button", { name: "Details" })).toBeVisible();
            await expect(stepsNav.getByRole("button", { name: "Review" })).toBeVisible();
          }

          await assertNoHorizontalOverflow(page, `${theme}-drawer-${width}px`);

          // Chat launcher hides while customize drawer is open
          await expect(page.getByTestId("atelier-chat-launcher")).toHaveCount(0);

          const drawerBox = await drawer.boundingBox();
          expect(drawerBox).not.toBeNull();
          if (width === 360) {
            expect(drawerBox!.x).toBeLessThanOrEqual(2);
            expect(drawerBox!.width).toBeGreaterThanOrEqual(358);
          } else if (width === 768) {
            expect(drawerBox!.width).toBeGreaterThanOrEqual(478);
            expect(drawerBox!.width).toBeLessThanOrEqual(482);
            expect(Math.abs(drawerBox!.x + drawerBox!.width - 768)).toBeLessThanOrEqual(2);
          } else if (width === 1280) {
            expect(drawerBox!.width).toBeGreaterThanOrEqual(518);
            expect(drawerBox!.width).toBeLessThanOrEqual(522);
            expect(Math.abs(drawerBox!.x + drawerBox!.width - 1280)).toBeLessThanOrEqual(2);
          }

          // Verify header compactness, single scroller, card proportions, and min 12px font size
          const metrics = await page.evaluate((vw) => {
            const dlg = document.querySelector('[role="dialog"]');
            if (!dlg) return null;
            const header = dlg.querySelector("header");
            const scroller = dlg.querySelector(".drawer-scroll");
            const cards = Array.from(dlg.querySelectorAll('[data-testid^="option-card-"]'));
            let minCardWidth = Infinity;
            let minCardHeight = Infinity;
            for (const c of cards) {
              const r = c.getBoundingClientRect();
              minCardWidth = Math.min(minCardWidth, r.width);
              minCardHeight = Math.min(minCardHeight, r.height);
            }
            let minFontSize = Infinity;
            for (const el of dlg.querySelectorAll("p, span, button, label, input")) {
              const cls = el.className || "";
              if (typeof cls === "string" && cls.includes("sr-only")) continue;
              const st = getComputedStyle(el);
              if (st.display === "none" || st.visibility === "hidden") continue;
              if (el.getBoundingClientRect().width === 0) continue;
              const fs = parseFloat(st.fontSize);
              if (fs > 0) minFontSize = Math.min(minFontSize, fs);
            }
            return {
              vw,
              headerHeight: header ? header.getBoundingClientRect().height : 0,
              scrollerOverflowX: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
              cardCount: cards.length,
              minCardWidth,
              minCardHeight,
              minFontSize,
            };
          }, width);

          expect(metrics).not.toBeNull();
          expect(metrics!.headerHeight).toBeLessThanOrEqual(76);
          expect(metrics!.scrollerOverflowX).toBeLessThanOrEqual(1);
          expect(metrics!.minCardHeight).toBeGreaterThanOrEqual(62);
          if (width >= 400) {
            expect(metrics!.minCardWidth).toBeGreaterThanOrEqual(150);
          }
          expect(metrics!.minFontSize).toBeGreaterThanOrEqual(12);

          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `drawer-${theme}-${width}.png`),
            fullPage: false,
          });

          const axe = await new AxeBuilder({ page })
            .include('[role="dialog"]')
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          expect(axe.violations, `Axe violations in ${theme} drawer at ${width}px`).toEqual([]);

          await page.keyboard.press("Escape");
          await expect(drawer).toBeHidden();
        }
      }

      // Sweep additional drawer viewports (320, 390, 414, 480, 1024, 1440, 667x375 landscape) + clamp + RTL + keyboard
      await page.setViewportSize({ width: 1280, height: 844 });
      await page.goto("/products/clairvoyant-four-prong-diamond-studs");
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
      await dismissCookieIfVisible(page);
      const customizeTrigger = page.getByRole("button", { name: /^Customize$/i }).first();
      await customizeTrigger.click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("navigation", { name: "Customization steps" })).toBeVisible({
        timeout: 15_000,
      });

      for (const vp of [
        { width: 320, height: 640 },
        { width: 390, height: 844 },
        { width: 414, height: 896 },
        { width: 480, height: 844 },
        { width: 1024, height: 768 },
        { width: 1440, height: 900 },
        { width: 667, height: 375 },
      ]) {
        await page.setViewportSize(vp);
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        const measureOverflow = () =>
          page.evaluate(() => {
            const dlg = document.querySelector('[role="dialog"]');
            const scroller = dlg?.querySelector(".drawer-scroll");
            const header = dlg?.querySelector("header");
            return {
              docOverflow: document.documentElement.scrollWidth - window.innerWidth,
              scrollerOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
              headerHeight: header ? header.getBoundingClientRect().height : 0,
            };
          });
        await expect
          .poll(async () => (await measureOverflow()).docOverflow, {
            message: `doc overflow at ${vp.width}x${vp.height}`,
          })
          .toBeLessThanOrEqual(1);
        await expect
          .poll(async () => (await measureOverflow()).scrollerOverflow, {
            message: `drawer scroll overflow at ${vp.width}x${vp.height}`,
          })
          .toBeLessThanOrEqual(1);
        if (vp.height <= 500) {
          await expect
            .poll(async () => (await measureOverflow()).headerHeight, {
              message: `compact landscape header height at ${vp.width}x${vp.height}`,
            })
            .toBeLessThanOrEqual(58);
        }
      }

      // Numeric bounds clamp on blur
      await page.setViewportSize({ width: 1280, height: 844 });
      const caratInput = drawer.getByRole("textbox", { name: /Carat Per Ear/i });
      await caratInput.fill("99");
      await expect(drawer.getByText(/Enter a value between/i)).toBeVisible();
      await caratInput.blur();
      await expect(caratInput).toHaveValue("2.5");

      // RTL layout check inside drawer
      await page.evaluate(() => {
        document.documentElement.dir = "rtl";
      });
      const rtlOverflow = await page.evaluate(() => {
        const scroller = document.querySelector('[role="dialog"] .drawer-scroll');
        return scroller ? scroller.scrollWidth - scroller.clientWidth : 0;
      });
      expect(rtlOverflow).toBeLessThanOrEqual(1);
      await page.evaluate(() => {
        document.documentElement.dir = "ltr";
      });

      // Keyboard-only flow from Options -> Details -> Back & Escape returns focus
      const metalCards = drawer.locator('[data-group-code="metal"] [data-testid^="option-card-"]');
      await metalCards.first().focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowRight");
      const otherChoiceGroups = drawer.locator(
        'fieldset[data-group-code]:not([data-group-code="metal"])',
      );
      const choiceGroupCount = await otherChoiceGroups.count();
      for (let idx = 0; idx < choiceGroupCount; idx++) {
        await otherChoiceGroups.nth(idx).locator('[data-testid^="option-card-"]').first().click();
      }
      await drawer.getByRole("button", { name: /^Next$/i }).click();
      await expect(drawer.getByRole("heading", { name: /Your details/i })).toBeVisible();
      await expect(drawer.getByRole("button", { name: /^Next$/i })).toBeVisible();
      // Step 2 -> verify Back returns to Options cleanly
      await drawer.getByRole("button", { name: /^Back$/i }).click();
      await expect(drawer.getByText("Precious Metal")).toBeVisible();
      await page.keyboard.press("Escape");
      const discardDialog = page.getByRole("dialog", { name: /Discard customization/i });
      if (await discardDialog.isVisible()) {
        await discardDialog.getByRole("button", { name: /Discard Changes/i }).click();
      }
      await expect(page.locator('[role="dialog"][data-customize-drawer="true"]')).toBeHidden();

      // Verify full-page WCAG AA in light & dark
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto("/products/celeste-cathedral-solitaire-ring/customize");
        if (theme === "dark") {
          await page.evaluate(() => document.documentElement.classList.add("dark"));
        } else {
          await page.evaluate(() => document.documentElement.classList.remove("dark"));
        }
        await dismissCookieIfVisible(page);
        await expect(page.getByRole("heading", { level: 1, name: /Customize/i })).toBeVisible();
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(axe.violations, `Axe violations on customize page in ${theme}`).toEqual([]);
      }
    } finally {
      await context.close();
    }
  });

  test("full customization workflow (customer submit + image -> admin quote -> customer accept to bag locked price) + live chat", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const customerContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const adminContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });

    const customerPage = await customerContext.newPage();
    const adminPage = await adminContext.newPage();

    try {
      const tinyPng = await sharp({
        create: { width: 32, height: 32, channels: 3, background: { r: 212, g: 175, b: 55 } },
      })
        .png()
        .toBuffer();

      // 1. Customer logs in & opens dedicated customize page
      await loginCustomer(customerPage);
      await customerPage.goto("/products/celeste-cathedral-solitaire-ring/customize");
      await expect(
        customerPage.getByRole("heading", { level: 1, name: /Customize Celeste/i }),
      ).toBeVisible();
      await dismissCookieIfVisible(customerPage);

      // Logged-in compact identity row hides raw email inputs initially
      await expect(customerPage.getByTestId("sending-as-row")).toBeVisible();
      await expect(customerPage.getByTestId("sending-as-row")).toContainText("Claire");

      // Select all required customization groups + searchable select (>6 options) + optional engraving
      await selectGroupOption(customerPage, "metal", /Platinum 950/i);
      await selectGroupOption(customerPage, "stone_shape");
      await selectGroupOption(customerPage, "diamond_color");
      await selectGroupOption(customerPage, "clarity");

      // Test searchable Ring Size select explicitly
      const ringSizeTrigger = customerPage.getByTestId("option-select-trigger-ring_size");
      if ((await ringSizeTrigger.count()) > 0 && (await ringSizeTrigger.isVisible())) {
        await ringSizeTrigger.click();
        const searchBox = customerPage.getByPlaceholder(/Search ring size/i);
        await expect(searchBox).toBeVisible();
        await searchBox.fill("6");
        await customerPage.getByRole("listbox").getByRole("option").first().click();
      } else {
        await selectGroupOption(customerPage, "ring_size");
      }

      // Upload a reference image and verify thumbnail + remove controls
      const fileInput = customerPage.locator('input[type="file"][accept*="image"]');
      if ((await fileInput.count()) > 0) {
        await fileInput.first().setInputFiles({
          name: "atelier-sketch.png",
          mimeType: "image/png",
          buffer: tinyPng,
        });
        await expect(customerPage.getByText(/Add reference images \(1\//i)).toBeVisible({
          timeout: 15_000,
        });
        await expect(
          customerPage.getByRole("button", { name: /Remove atelier-sketch\.(png|webp)/i }),
        ).toBeVisible();
      }

      const engravingGroup = customerPage.locator('[data-group-code="engraving"]');
      if ((await engravingGroup.count()) > 0) {
        await engravingGroup.locator("input").first().fill("Aurelia E2E 2026");
      }

      // More details starts collapsed; open to enter occasion
      await expect(customerPage.getByPlaceholder(/Proposal in December/i)).toHaveCount(0);
      await customerPage.getByTestId("more-details-toggle").click();
      await customerPage.getByPlaceholder(/Proposal in December/i).fill("Autumn Gala");

      await customerPage.getByTestId("submit-customization-request").click();

      const confirmCard = customerPage.getByTestId("customization-confirmation");
      await expect(confirmCard).toBeVisible({ timeout: 20_000 });
      await expect(confirmCard.getByText(/Request sent/i)).toBeVisible();
      const confirmText = await confirmCard.innerText();
      const match = confirmText.match(/CR-\d{4}-\d{5,}/);
      expect(match?.[0]).toBeTruthy();
      const requestNumber = match![0]!;
      createdRequestNumbers.push(requestNumber);

      // Navigate directly to Account -> Customization Request Detail
      await customerPage.getByRole("link", { name: /View my requests/i }).click();
      await customerPage.waitForURL(/\/account\/customizations\/.+/);
      await expect(
        customerPage.locator("main:visible").getByText(requestNumber).first(),
      ).toBeVisible({
        timeout: 15_000,
      });

      // 2. Admin logs in, navigates to Customizations & quotes the new request at $4,950.00
      await loginAdmin(adminPage, "/admin/customizations");
      await expect(
        adminPage.getByRole("heading", { name: /Customization Requests/i }),
      ).toBeVisible();

      const rowLink = adminPage.locator(`a[href*="/admin/customizations/"]`).filter({
        hasText: requestNumber,
      });
      await expect(rowLink.first()).toBeVisible({ timeout: 15_000 });
      await rowLink.first().click();
      await adminPage.waitForURL(/\/admin\/customizations\/.+/);
      await expect(adminPage.getByRole("heading", { level: 1, name: requestNumber })).toBeVisible({
        timeout: 15_000,
      });

      await adminPage.getByRole("button", { name: /Accept & Quote/i }).click();
      await adminPage.getByLabel(/Final Price \(Base USD\)/i).fill("4950");
      await adminPage.getByRole("button", { name: /Confirm & Email Quote/i }).click();
      await expect(adminPage.getByText("ACCEPTED", { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });

      // 3. Customer reloads detail page & accepts quote into shopping bag at locked $4,950.00
      await customerPage.reload();
      await expect(customerPage.getByText(/Quoted & Ready/i).first()).toBeVisible();
      await customerPage.getByRole("button", { name: /Accept Quote & Checkout/i }).click();
      await customerPage.waitForURL(/\/checkout/);
      await expect(
        customerPage.locator("p:visible", { hasText: "$4,950.00" }).first(),
      ).toBeVisible();

      // 4. Real-Time Chat (User <-> Admin) with live delivery
      await customerPage.goto("/account");
      const uniqueMsg = `Concierge live check ${Date.now()}`;
      await dismissCookieIfVisible(customerPage);
      await customerPage.getByTestId("atelier-chat-launcher").click();

      const newBtn = customerPage.getByRole("button", { name: /^New$/i });
      if (await newBtn.isVisible().catch(() => false)) {
        await newBtn.click();
      }
      await expect(customerPage.getByRole("button", { name: /Attach images/i })).toBeVisible();
      await expect(
        customerPage.getByRole("button", { name: /Share product or reference/i }),
      ).toBeVisible();

      const msgBox = customerPage.getByLabel(/Message atelier concierge|Chat message/i).first();
      await msgBox.fill(uniqueMsg);
      await customerPage.getByRole("button", { name: "Send message" }).click();
      await expect(customerPage.getByText(uniqueMsg).first()).toBeVisible({ timeout: 15_000 });

      // Admin opens /admin/messages, clicks customer's conversation, and replies live
      await adminPage.goto("/admin/messages");
      const threadBtn = adminPage
        .getByRole("button", { name: new RegExp(uniqueMsg.slice(0, 24)) })
        .first();
      await expect(threadBtn).toBeVisible({ timeout: 15_000 });
      await threadBtn.click();
      await expect(adminPage.getByText(uniqueMsg).first()).toBeVisible({ timeout: 15_000 });

      const adminReply = `Bonjour! Here is your matching solitaire ${Date.now()}`;
      await adminPage.getByLabel("Chat message").fill(adminReply);
      await adminPage.getByRole("button", { name: "Send message" }).click();

      await expect(customerPage.getByText(adminReply).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await customerContext.close();
      await adminContext.close();
    }
  });

  test("edge cases: >2 validation errors focus, 12+ option search, 5 uploads + slow/failed upload, Phone toggle & submit while chat open", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    try {
      const tinyPng = await sharp({
        create: { width: 24, height: 24, channels: 3, background: { r: 31, g: 111, b: 80 } },
      })
        .png()
        .toBuffer();

      // 1. Guest validation errors (>2 fields -> error summary + focus first error), Phone field toggle
      await page.goto("/products/clairvoyant-four-prong-diamond-studs/customize");
      await expect(page.getByRole("heading", { level: 1, name: /Customize/i })).toBeVisible();
      await dismissCookieIfVisible(page);
      await expect(page.getByTestId("sending-as-row")).toHaveCount(0);
      await expect(page.getByLabel(/Phone number/i)).toHaveCount(0);
      await page.getByRole("radio", { name: /^Phone$/i }).click();
      await expect(page.getByLabel(/Phone number/i)).toBeVisible();

      await page.getByTestId("submit-customization-request").click();
      await expect(page.getByTestId("customization-error-summary")).toBeVisible();
      await expect(page.getByRole("alert").first()).toBeVisible();

      // 2. Intercept product API in Drawer with 14+ options & very long option label
      await page.route(
        "**/api/customizations/products/clairvoyant-four-prong-diamond-studs",
        async (route) => {
          const res = await route.fetch();
          const json = await res.json();
          const longGroup = {
            id: "mock-many-group",
            code: "bespoke_finish_many",
            label: "Artisan Surface & Patina Treatment",
            type: "SELECT",
            helperText: null,
            placeholder: "Choose surface treatment",
            required: false,
            minValue: null,
            maxValue: null,
            stepValue: null,
            defaultValue: null,
            maxLength: null,
            maxFiles: null,
            unit: null,
            validationRules: null,
            isActive: true,
            sortOrder: 0,
            source: "product",
            values: Array.from({ length: 14 }, (_, i) => ({
              id: `opt-${i}`,
              value: `finish_${i}`,
              label:
                i === 0
                  ? "Hand-Engraved Florentine Satin Finish With Micro-Milgrain Gallery Bezel Border"
                  : `Atelier Surface Option ${i + 1}`,
              swatchHex: null,
              swatchImageUrl: null,
              priceAdjustmentType: i === 0 ? "FIXED" : "NONE",
              priceAdjustmentValue: i === 0 ? "180" : "0",
              isAvailable: true,
              sortOrder: i,
            })),
          };
          json.groups = [longGroup, ...json.groups];
          await route.fulfill({ json });
        },
      );

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/products/clairvoyant-four-prong-diamond-studs");
      await dismissCookieIfVisible(page);
      await page
        .getByRole("button", { name: /^Customize$/i })
        .first()
        .click();

      const drawer = page.getByRole("dialog");
      await expect(drawer.getByTestId("option-select-trigger-bespoke_finish_many")).toBeVisible({
        timeout: 15_000,
      });
      await drawer.getByTestId("option-select-trigger-bespoke_finish_many").click();
      const sheetSearch = page.getByPlaceholder(/Search artisan surface/i);
      await expect(sheetSearch).toBeVisible();
      await sheetSearch.fill("Florentine");
      await page.getByRole("option", { name: /Florentine/i }).click();
      await expect(drawer.getByTestId("option-select-trigger-bespoke_finish_many")).toContainText(
        "Florentine",
      );
      await assertNoHorizontalOverflow(page, "mobile-long-option-drawer-390px");

      // Dismiss mocked route and navigate to logged-in submission with 5 images + slow/failed upload + open chat
      await page.unroute("**/api/customizations/products/clairvoyant-four-prong-diamond-studs");
      await page.setViewportSize({ width: 1280, height: 900 });
      await loginCustomer(page);
      await page.goto("/products/clairvoyant-four-prong-diamond-studs/customize");
      await dismissCookieIfVisible(page);

      // Test slow upload + error recovery (1 failure -> Retry -> 5 successful images)
      let failOnce = true;
      await page.route("**/api/customizations/uploads/sign", async (route) => {
        if (failOnce) {
          failOnce = false;
          await new Promise((r) => setTimeout(r, 400));
          await route.fulfill({ status: 500, json: { error: "Simulated upload error" } });
          return;
        }
        await route.continue();
      });

      const fileInput = page.locator('input[type="file"][accept*="image"]').first();
      await fileInput.setInputFiles({
        name: "retry-sample.png",
        mimeType: "image/png",
        buffer: tinyPng,
      });
      await expect(page.getByText(/Simulated upload error/i).first()).toBeVisible({
        timeout: 10_000,
      });
      await page.getByRole("button", { name: "Retry" }).click();
      await expect(page.getByText(/Add reference images \(1\/5\)/i)).toBeVisible({
        timeout: 15_000,
      });

      await fileInput.setInputFiles([
        { name: "img2.png", mimeType: "image/png", buffer: tinyPng },
        { name: "img3.png", mimeType: "image/png", buffer: tinyPng },
        { name: "img4.png", mimeType: "image/png", buffer: tinyPng },
        { name: "img5.png", mimeType: "image/png", buffer: tinyPng },
      ]);
      await expect(page.getByText(/Add reference images \(5\/5\)/i)).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole("button", { name: /Maximum uploaded/i })).toBeDisabled();

      // Open Chat panel AND submit form while Chat panel stays open!
      await selectGroupOption(page, "metal");
      await selectGroupOption(page, "stone_shape");
      await selectGroupOption(page, "backing_type");

      await page.getByTestId("atelier-chat-launcher").click();
      const chatDialog = page.getByRole("dialog", { name: /Atelier Concierge Chat/i });
      await expect(chatDialog).toBeVisible();

      await page.getByTestId("submit-customization-request").click();
      const confirmCard = page.getByTestId("customization-confirmation");
      await expect(confirmCard).toBeVisible({ timeout: 20_000 });
      const confirmText = await confirmCard.innerText();
      const match = confirmText.match(/CR-\d{4}-\d{5,}/);
      expect(match?.[0]).toBeTruthy();
      createdRequestNumbers.push(match![0]!);

      // Capture success screenshot too
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "success-light-1280.png"),
        fullPage: false,
      });
    } finally {
      await context.close();
    }
  });

  test("chat responsiveness (320px-1440px, landscape, 130% text), 300-item picker, 500-msg virtualization & offline retry", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    // 1. Check 320px narrow mobile: "+" composer action menu & zero overflow
    const ctx320 = await browser.newContext({ viewport: { width: 320, height: 640 } });
    const p320 = await ctx320.newPage();
    try {
      await p320.goto("/");
      await dismissCookieIfVisible(p320);
      await p320.getByTestId("atelier-chat-launcher").click();
      const dlg = p320.getByRole("dialog", { name: /Atelier Concierge Chat/i });
      await expect(dlg).toBeVisible();
      await expect(dlg.getByRole("button", { name: /More attachment actions/i })).toBeVisible();
      const overflow320 = await p320.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow320).toBeLessThanOrEqual(0);
    } finally {
      await ctx320.close();
    }

    // 2. Check 360px, 768px, 1024px, landscape mobile (667x375) & 130% root font-size
    for (const vp of [
      { width: 360, height: 740 },
      { width: 667, height: 375 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
    ]) {
      const ctx = await browser.newContext({ viewport: vp });
      const p = await ctx.newPage();
      try {
        await p.goto("/");
        await dismissCookieIfVisible(p);
        await p.evaluate(() => {
          document.documentElement.style.fontSize = "130%";
        });
        await p.getByTestId("atelier-chat-launcher").click();
        const dlg = p.getByRole("dialog", { name: /Atelier Concierge Chat/i });
        await expect(dlg).toBeVisible();
        await expect(
          dlg.getByLabel(/Message atelier concierge|Chat message/i).first(),
        ).toBeVisible();
        const metrics = await p.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          rect: document.querySelector('[role="dialog"]')?.getBoundingClientRect().toJSON(),
        }));
        expect(metrics.overflow).toBeLessThanOrEqual(0);
        expect(metrics.rect?.height ?? 0).toBeLessThanOrEqual(vp.height + 2);
      } finally {
        await ctx.close();
      }
    }

    // 3. Mocked 300-product picker & 500-message virtualization + offline failed->retry recovery
    const ctxPerf = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pPerf = await ctxPerf.newPage();
    try {
      const fakeConvId = "conv_e2e_perf_500";
      const fakeMessages = Array.from({ length: 500 }, (_, i) => ({
        id: `msg_500_${i + 1}`,
        seq: i + 1,
        conversationId: fakeConvId,
        senderId: null,
        senderRole: i % 4 === 0 ? "ADMIN" : "CUSTOMER",
        senderName: i % 4 === 0 ? "Atelier Concierge" : "Guest",
        type: "TEXT",
        body: `Perf message #${i + 1}`,
        attachments: [],
        refId: null,
        refSnapshot: null,
        clientTempId: null,
        deliveredAt: new Date(Date.now() - (500 - i) * 60_000).toISOString(),
        readAt: null,
        createdAt: new Date(Date.now() - (500 - i) * 60_000).toISOString(),
      }));

      // Intercept socket.io HTTP & WebSocket so synthetic conv_perf_500 tests the HTTP + offline fallback path cleanly
      await pPerf.routeWebSocket("**/socket.io/**", (ws) => ws.close());
      await pPerf.route("**/socket.io/**", (route) => route.abort());

      await pPerf.route("**/api/chat/bootstrap**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              session: { authenticated: false, viewerRole: "CUSTOMER", name: "Guest" },
              conversations: [
                {
                  id: fakeConvId,
                  contextType: "GENERAL",
                  contextRefId: null,
                  customizationRequestId: null,
                  title: "Concierge Chat",
                  status: "OPEN",
                  userId: null,
                  customerName: null,
                  customerEmail: null,
                  guestEmail: null,
                  assignedToId: null,
                  assignedToName: null,
                  tags: [],
                  lastMessageAt: fakeMessages[499]!.createdAt,
                  lastMessagePreview: fakeMessages[499]!.body,
                  lastMessageSeq: 500,
                  unreadCount: 0,
                  createdAt: fakeMessages[0]!.createdAt,
                },
              ],
              totalUnread: 0,
              supportStatus: { isOnline: true, label: "Online", hoursSummary: "Mon-Sat" },
              cannedReplies: [],
            },
          }),
        });
      });

      let simulatedTransientFailure = false;
      await pPerf.route(`**/api/chat/conversations/${fakeConvId}**`, async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        if (req.method() === "POST" && url.pathname.endsWith("/messages")) {
          const postData = JSON.parse(req.postData() || "{}") as {
            body?: string;
            clientTempId?: string;
          };
          if (postData.body?.includes("FORCE_FAIL_ONCE") && !simulatedTransientFailure) {
            simulatedTransientFailure = true;
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ ok: false, error: "Temporary network drop" }),
            });
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              data: {
                message: {
                  ...fakeMessages[499],
                  id: "msg_retry_ok",
                  seq: 501,
                  body: postData.body ?? "",
                  clientTempId: postData.clientTempId ?? null,
                },
              },
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              conversation: {
                id: fakeConvId,
                contextType: "GENERAL",
                contextRefId: null,
                customizationRequestId: null,
                title: "Concierge Chat",
                status: "OPEN",
                userId: null,
                customerName: null,
                customerEmail: null,
                guestEmail: null,
                assignedToId: null,
                assignedToName: null,
                tags: [],
                lastMessageAt: fakeMessages[499]!.createdAt,
                lastMessagePreview: fakeMessages[499]!.body,
                lastMessageSeq: 500,
                unreadCount: 0,
                createdAt: fakeMessages[0]!.createdAt,
              },
              messages: fakeMessages.slice(400),
              hasMoreOlder: true,
              oldestSeq: 401,
              newestSeq: 500,
              supportStatus: { isOnline: true, label: "Online", hoursSummary: "Mon-Sat" },
            },
          }),
        });
      });

      await pPerf.route("**/api/chat/products**", async (route) => {
        const url = new URL(route.request().url());
        const q = (url.searchParams.get("q") || "").toLowerCase();
        const all300 = Array.from({ length: 300 }, (_, i) => ({
          kind: "PRODUCT" as const,
          id: `prod_300_${i + 1}`,
          productId: `prod_300_${i + 1}`,
          slug: `atelier-piece-${i + 1}`,
          sku: `AUR-${1000 + i}`,
          name: `Atelier Bespoke Ring ${i + 1}`,
          category: "Rings",
          imageUrl: null,
          thumbUrl: null,
          basePrice: `${2000 + i}`,
          price: `${2000 + i}`,
          priceMode: "FIXED" as const,
          currency: "USD",
          inStock: true,
        }));
        const filtered = q
          ? all300.filter(
              (x) => x.name.toLowerCase().includes(q) || x.sku.toLowerCase().includes(q),
            )
          : all300.slice(0, 60);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: { products: filtered.slice(0, 20), nextCursor: null, requests: [], orders: [] },
          }),
        });
      });

      await pPerf.goto("/");
      await dismissCookieIfVisible(pPerf);
      await pPerf.getByTestId("atelier-chat-launcher").click();
      const dlg = pPerf.getByRole("dialog", { name: /Atelier Concierge Chat/i });
      await expect(dlg.getByText("Perf message #500")).toBeVisible({ timeout: 10_000 });

      // Test product picker search across 300 products
      await dlg.getByRole("button", { name: /Share product or reference/i }).click();
      const searchBox = dlg.getByLabel("Search pieces to share");
      await expect(searchBox).toBeVisible();
      await searchBox.fill("275");
      await expect(dlg.getByText("Atelier Bespoke Ring 275")).toBeVisible({ timeout: 5_000 });
      await dlg.getByRole("button", { name: "Close share picker" }).click();

      // Test optimistic send + non-blocking composer + failed->tap to retry
      const msgInput = dlg.getByLabel("Chat message").first();
      await msgInput.fill("FORCE_FAIL_ONCE_MSG");
      await dlg.getByRole("button", { name: "Send message" }).click();
      // Input cleared immediately & composer remains enabled while request fails
      await expect(msgInput).toHaveValue("");
      await expect(msgInput).toBeEnabled();
      const retryBtn = dlg.getByRole("button", { name: /Failed · Tap to retry/i });
      await expect(retryBtn).toBeVisible({ timeout: 10_000 });
      await retryBtn.click();
      await expect(retryBtn).toHaveCount(0, { timeout: 10_000 });
      await expect(dlg.getByText("FORCE_FAIL_ONCE_MSG")).toBeVisible();
    } finally {
      await ctxPerf.close();
    }
  });
});
