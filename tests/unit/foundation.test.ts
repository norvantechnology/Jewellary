import { describe, expect, it } from "vitest";
import { estimateDeliveryWindow, formatDeliveryRange } from "@/lib/dates";
import { formatCarat, formatWeightGrams, maskEmail, maskPhone } from "@/lib/format";
import {
  calculateTax,
  formatMoney,
  formatMoneyExact,
  fromMinorUnits,
  isEqualMoney,
  multiplyMoney,
  sumMoney,
  toDecimal,
  toMinorUnits,
} from "@/lib/money";
import { hasPermission, roleAtLeast } from "@/lib/permissions";
import { buildCategoryPath, slugify } from "@/lib/slug";

describe("money utilities", () => {
  it("computes decimal arithmetic accurately without floating-point drift", () => {
    expect(sumMoney(["0.1", "0.2"]).toString()).toBe("0.3");
    expect(multiplyMoney("2499.99", 3).toString()).toBe("7499.97");
    expect(isEqualMoney("1250.00", "1250")).toBe(true);
  });

  it("calculates inclusive and exclusive taxes accurately", () => {
    expect(calculateTax("1000.00", 8, false).toString()).toBe("80");
    expect(calculateTax("1080.00", 8, true).toString()).toBe("80");
    expect(calculateTax("1000.00", 0, false).toString()).toBe("0");
  });

  it("converts minor units for Stripe/Razorpay boundaries", () => {
    expect(toMinorUnits("1299.95", "USD")).toBe(129995);
    expect(fromMinorUnits(129995, "USD").toString()).toBe("1299.95");
    expect(toMinorUnits("5000", "JPY")).toBe(5000);
    expect(toDecimal("12.345").toString()).toBe("12.35");
  });

  it("formats currency values cleanly", () => {
    expect(formatMoney("2500", "USD", "en-US")).toBe("$2,500");
    expect(formatMoneyExact("2500", "USD", "en-US")).toBe("$2,500.00");
  });
});

describe("slug & format utilities", () => {
  it("builds lowercase hyphenated slugs and category paths", () => {
    expect(slugify("18K Rose Gold — Solitaire Ring!")).toBe("18k-rose-gold-solitaire-ring");
    expect(buildCategoryPath("Engagement Rings", "rings")).toBe("rings/engagement-rings");
    expect(buildCategoryPath("Rings")).toBe("rings");
  });

  it("formats weights, carats, and masks PII for limited staff views", () => {
    expect(formatWeightGrams("4.256")).toBe("4.26 g");
    expect(formatCarat(1.5)).toBe("1.50 ct");
    expect(maskEmail("claire.vance@example.com")).toBe("cl**********@example.com");
    expect(maskPhone("+1 (212) 555-0194")).toBe("•••• 0194");
  });

  it("estimates delivery business-day windows skipping weekends", () => {
    const monday = new Date("2026-11-09T10:00:00Z"); // Monday
    const window = estimateDeliveryWindow(3, 5, 2, monday);
    expect(window.from.getDay()).not.toBe(0);
    expect(window.from.getDay()).not.toBe(6);
    expect(formatDeliveryRange(window.from, window.to, "en-US")).toContain("–");
  });
});

describe("permissions matrix (§7)", () => {
  it("enforces CUSTOMER < STAFF < ADMIN hierarchy", () => {
    expect(roleAtLeast("CUSTOMER", "CUSTOMER")).toBe(true);
    expect(roleAtLeast("CUSTOMER", "STAFF")).toBe(false);
    expect(roleAtLeast("STAFF", "STAFF")).toBe(true);
    expect(roleAtLeast("STAFF", "ADMIN")).toBe(false);
    expect(roleAtLeast("ADMIN", "ADMIN")).toBe(true);
  });

  it("grants exact capability matrix", () => {
    expect(hasPermission("CUSTOMER", "account:own")).toBe(true);
    expect(hasPermission("CUSTOMER", "admin:dashboard")).toBe(false);

    expect(hasPermission("STAFF", "catalog:write")).toBe(true);
    expect(hasPermission("STAFF", "catalog:delete")).toBe(false);
    expect(hasPermission("STAFF", "orders:update_status")).toBe(true);
    expect(hasPermission("STAFF", "orders:refund")).toBe(false);
    expect(hasPermission("STAFF", "customers:change_role")).toBe(false);
    expect(hasPermission("STAFF", "settings:manage")).toBe(false);

    expect(hasPermission("ADMIN", "catalog:delete")).toBe(true);
    expect(hasPermission("ADMIN", "orders:refund")).toBe(true);
    expect(hasPermission("ADMIN", "settings:manage")).toBe(true);
    expect(hasPermission("ADMIN", "audit:read")).toBe(true);
    expect(hasPermission(null, "account:own")).toBe(false);
  });
});
