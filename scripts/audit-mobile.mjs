import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = "http://127.0.0.1:3100";
const OUTPUT_DIR = path.resolve(process.cwd(), "artifacts-mobile-audit");

const VIEWPORT = { width: 390, height: 844 }; // iPhone 12/13/14

const pagesToTest = [
  { name: "01_home", path: "/" },
  { name: "02_collections", path: "/collections" },
  { name: "03_collections_sub", path: "/collections/rings/engagement-rings" },
  { name: "04_pdp_studs", path: "/products/clairvoyant-four-prong-diamond-studs" },
  { name: "05_pdp_ring", path: "/products/celeste-cathedral-solitaire-ring" },
  { name: "06_cart", path: "/cart" },
  { name: "07_checkout", path: "/checkout" },
  { name: "08_wishlist", path: "/wishlist" },
  { name: "09_search", path: "/search?q=diamond" },
  { name: "10_contact", path: "/contact" },
  { name: "11_about", path: "/about" },
  { name: "12_guides", path: "/guides" },
  { name: "13_guide_detail", path: "/guides/engagement-ring-guide" },
  { name: "14_shipping_returns", path: "/shipping-returns" },
  { name: "15_ring_size_guide", path: "/ring-size-guide" },
  { name: "16_care_guide", path: "/care-guide" },
  { name: "17_faq", path: "/faq" },
  { name: "18_privacy", path: "/privacy" },
  { name: "19_terms", path: "/terms" },
  { name: "20_login", path: "/login" },
  { name: "21_register", path: "/register" },
  { name: "22_customize_page", path: "/products/clairvoyant-four-prong-diamond-studs/customize" },
];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    isMobile: true,
    hasTouch: true,
  });

  // Set consent cookie so cookie banner doesn't cover content during standard page checks
  await context.addCookies([
    {
      name: "maison_consent",
      value: encodeURIComponent(
        JSON.stringify({ necessary: true, analytics: false, decidedAt: new Date().toISOString() }),
      ),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);

  const page = await context.newPage();
  const issues = [];

  console.log("--- AUDITING PAGES ON MOBILE (390x844) ---");

  for (const item of pagesToTest) {
    try {
      console.log(`Checking ${item.name} (${item.path})...`);
      await page.goto(`${BASE_URL}${item.path}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(500);

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const overflowingElements = [];

        if (scrollWidth > docWidth) {
          const all = document.querySelectorAll("*");
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            if (rect.right > docWidth + 2) {
              const tag = el.tagName.toLowerCase();
              const cls = typeof el.className === "string" ? el.className.slice(0, 80) : "";
              const id = el.id ? `#${el.id}` : "";
              overflowingElements.push({
                tag: `${tag}${id}`,
                className: cls,
                right: Math.round(rect.right),
                docWidth,
              });
            }
          }
        }

        return {
          hasOverflow: scrollWidth > docWidth,
          docWidth,
          scrollWidth,
          overflowingElements: overflowingElements.slice(0, 5),
        };
      });

      if (overflow.hasOverflow) {
        issues.push({
          page: item.name,
          path: item.path,
          type: "HORIZONTAL_OVERFLOW",
          details: overflow,
        });
        console.warn(
          `  [!] Overflow detected: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.docWidth}`,
        );
      }

      // Check buttons smaller than 40px touch height or text wrapping strangely
      const buttonIssues = await page.evaluate(() => {
        const btns = Array.from(
          document.querySelectorAll("button, a[role='button'], input[type='submit']"),
        );
        const smallBtns = [];
        for (const b of btns) {
          // Check if visible
          const style = window.getComputedStyle(b);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")
            continue;
          const rect = b.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          // If in viewport or visible
          if (rect.height < 36 && !b.closest("[aria-hidden='true']")) {
            smallBtns.push({
              text: b.innerText?.slice(0, 30) || b.getAttribute("aria-label") || "<icon>",
              height: Math.round(rect.height),
              width: Math.round(rect.width),
              cls: typeof b.className === "string" ? b.className.slice(0, 60) : "",
            });
          }
        }
        return smallBtns.slice(0, 5);
      });

      if (buttonIssues.length > 0) {
        issues.push({
          page: item.name,
          path: item.path,
          type: "SMALL_TOUCH_TARGETS",
          details: buttonIssues,
        });
      }

      // Screenshot full page
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${item.name}.png`),
        fullPage: true,
      });

      // Viewport screenshot
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${item.name}_viewport.png`),
        fullPage: false,
      });
    } catch (err) {
      console.error(`Error on ${item.name}: ${err.message}`);
      issues.push({ page: item.name, path: item.path, error: err.message });
    }
  }

  // --- POPUP MODALS & DRAWERS ---
  console.log("\n--- AUDITING POPUPS, MODALS, DRAWERS ON MOBILE ---");

  // 1. Mobile Navigation Menu
  try {
    console.log("Checking Mobile Navigation Menu...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const menuBtn = page
      .locator("button[aria-label*='menu' i], button[aria-label*='navigation' i]")
      .first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_01_mobile_nav.png") });
    }
  } catch (err) {
    console.error("Mobile Nav error:", err.message);
  }

  // 2. Filter Sheet
  try {
    console.log("Checking Filter Sheet...");
    await page.goto(`${BASE_URL}/collections`, { waitUntil: "networkidle" });
    const filterBtn = page.getByRole("button", { name: /filter/i }).first();
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_02_filter_sheet.png") });
    }
  } catch (err) {
    console.error("Filter sheet error:", err.message);
  }

  // 3. Quick Select Modal
  try {
    console.log("Checking Quick Select Modal...");
    await page.goto(`${BASE_URL}/collections`, { waitUntil: "networkidle" });
    const chooseOptBtn = page
      .getByRole("button", { name: /choose options|select options/i })
      .first();
    if (await chooseOptBtn.isVisible()) {
      await chooseOptBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_03_quick_select.png") });
    }
  } catch (err) {
    console.error("Quick select modal error:", err.message);
  }

  // 4. Customization Drawer (bottom sheet on mobile)
  try {
    console.log("Checking Customization Drawer on mobile...");
    await page.goto(`${BASE_URL}/products/clairvoyant-four-prong-diamond-studs`, {
      waitUntil: "networkidle",
    });
    const customizeBtn = page.getByRole("button", { name: /customize/i }).first();
    if (await customizeBtn.isVisible()) {
      await customizeBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_04_customize_drawer.png") });
    }
  } catch (err) {
    console.error("Customization drawer error:", err.message);
  }

  // 5. Atelier Concierge Chat Widget
  try {
    console.log("Checking Chat Widget on mobile...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const chatBtn = page
      .locator("button[aria-label*='concierge' i], button[aria-label*='chat' i]")
      .first();
    if (await chatBtn.isVisible()) {
      await chatBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_05_chat_widget.png") });
    }
  } catch (err) {
    console.error("Chat widget error:", err.message);
  }

  // 6. Cart Drawer
  try {
    console.log("Checking Cart Drawer on mobile...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const cartBtn = page
      .locator("a[href='/cart'], button[aria-label*='cart' i], button[aria-label*='bag' i]")
      .first();
    if (await cartBtn.isVisible()) {
      await cartBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_06_cart_drawer.png") });
    }
  } catch (err) {
    console.error("Cart drawer error:", err.message);
  }

  // 7. Search Dialog
  try {
    console.log("Checking Search Dialog on mobile...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const searchBtn = page.locator("button[aria-label*='search' i]").first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_07_search_dialog.png") });
    }
  } catch (err) {
    console.error("Search dialog error:", err.message);
  }

  // 8. Ring Size Guide Sheet
  try {
    console.log("Checking Ring Size Guide on mobile...");
    await page.goto(`${BASE_URL}/products/celeste-cathedral-solitaire-ring`, {
      waitUntil: "networkidle",
    });
    const sizeGuideBtn = page.getByRole("button", { name: /size guide/i }).first();
    if (await sizeGuideBtn.isVisible()) {
      await sizeGuideBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_08_ring_size_guide.png") });
    }
  } catch (err) {
    console.error("Ring size guide error:", err.message);
  }

  // 9. Product Enquiry Dialog
  try {
    console.log("Checking Product Enquiry Dialog on mobile...");
    await page.goto(`${BASE_URL}/products/clairvoyant-four-prong-diamond-studs`, {
      waitUntil: "networkidle",
    });
    const enquireBtn = page.getByRole("button", { name: /enquire|ask a specialist/i }).first();
    if (await enquireBtn.isVisible()) {
      await enquireBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_09_product_enquiry.png") });
    }
  } catch (err) {
    console.error("Product enquiry error:", err.message);
  }

  // 10. Cookie Consent Banner (with new fresh context without cookies)
  try {
    console.log("Checking Cookie Consent Banner on mobile...");
    const freshContext = await browser.newContext({
      viewport: VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });
    const freshPage = await freshContext.newPage();
    await freshPage.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await freshPage.waitForTimeout(500);
    await freshPage.screenshot({ path: path.join(OUTPUT_DIR, "modal_10_cookie_banner.png") });
    await freshContext.close();
  } catch (err) {
    console.error("Cookie banner error:", err.message);
  }

  // Save report
  await fs.writeFile(
    path.join(OUTPUT_DIR, "mobile_issues_report.json"),
    JSON.stringify(issues, null, 2),
    "utf-8",
  );

  console.log("\n--- AUDIT COMPLETE ---");
  console.log(`Total issues detected: ${issues.length}`);
  console.log(`Screenshots and report saved in: ${OUTPUT_DIR}`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
