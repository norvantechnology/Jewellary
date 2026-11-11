import { describe, expect, it } from "vitest";
import { toMinorUnits, fromMinorUnits } from "@/lib/money";
import { calculateCheckoutQuote } from "@/modules/orders/checkout-quote";
import { canTransitionOrderStatus } from "@/modules/orders/state-machine";
import type { PublicStoreSettings, ShippingZoneDTO } from "@/modules/settings/settings.service";

const mockSettings: PublicStoreSettings = {
  storeName: "Maison Aurelia",
  tagline: null,
  contactEmail: "concierge@example.com",
  contactPhone: null,
  supportHours: null,
  currency: "USD",
  defaultCountry: "US",
  supportedCountries: ["US", "CA", "GB", "AU", "IN"],
  taxRate: "0.0800",
  taxLabel: "Estimated Tax",
  taxInclusive: false,
  freeShippingThreshold: "1000.00",
  signatureThreshold: "500.00",
  returnWindowDays: 30,
  announcementBarEnabled: true,
  announcementBarText: null,
  announcementBarHref: null,
  logoUrl: null,
  socialLinks: [],
  physicalStore: null,
  allowAiCrawlers: true,
  seoDefaultTitlePattern: null,
  seoDefaultDescription: null,
  defaultOgImageUrl: null,
};

const mockZones: ShippingZoneDTO[] = [
  {
    id: "zone-us",
    name: "Insured Domestic Express (US)",
    countries: ["US"],
    flatRate: "25.00",
    freeThreshold: "1000.00",
    estimatedDaysMin: 2,
    estimatedDaysMax: 4,
    isInsured: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "zone-intl",
    name: "Insured International Courier",
    countries: ["CA", "GB", "AU", "IN"],
    flatRate: "55.00",
    freeThreshold: "2000.00",
    estimatedDaysMin: 4,
    estimatedDaysMax: 7,
    isInsured: true,
    isActive: true,
    sortOrder: 2,
  },
];

describe("Phase 5 Unit — Checkout Quote & Order State Machine", () => {
  it("computes flat-rate shipping, exclusive tax, signature flag, and free-shipping gap", () => {
    const res = calculateCheckoutQuote({
      items: [{ lineTotal: "600.00" }],
      shippingCountry: "us",
      zones: mockZones,
      settings: mockSettings,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.quote.subtotal).toBe("600.00");
    expect(res.quote.shippingCost).toBe("25.00");
    expect(res.quote.isFreeShipping).toBe(false);
    expect(res.quote.amountToFreeShipping).toBe("400.00");
    expect(res.quote.taxAmount).toBe("48.00");
    expect(res.quote.total).toBe("673.00");
    expect(res.quote.signatureRequired).toBe(true);
  });

  it("applies complimentary insured shipping at threshold and handles tax-inclusive mode", () => {
    const res = calculateCheckoutQuote({
      items: [{ lineTotal: "1080.00" }],
      shippingCountry: "US",
      zones: mockZones,
      settings: { ...mockSettings, taxInclusive: true },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.quote.isFreeShipping).toBe(true);
    expect(res.quote.shippingCost).toBe("0.00");
    expect(res.quote.amountToFreeShipping).toBeNull();
    expect(res.quote.taxAmount).toBe("80.00");
    expect(res.quote.total).toBe("1080.00");
  });

  it("rejects unsupported destination countries and mismatched zone IDs", () => {
    const unsupported = calculateCheckoutQuote({
      items: [{ lineTotal: "500.00" }],
      shippingCountry: "FR",
      zones: mockZones,
      settings: mockSettings,
    });
    expect(unsupported.ok).toBe(false);
    if (!unsupported.ok) expect(unsupported.code).toBe("UNSUPPORTED_COUNTRY");

    const mismatchedZone = calculateCheckoutQuote({
      items: [{ lineTotal: "500.00" }],
      shippingCountry: "CA",
      shippingZoneId: "zone-us",
      zones: mockZones,
      settings: mockSettings,
    });
    expect(mismatchedZone.ok).toBe(false);
    if (!mismatchedZone.ok) expect(mismatchedZone.code).toBe("INVALID_ZONE");
  });

  it("enforces order status state machine transitions", () => {
    expect(canTransitionOrderStatus("PENDING_PAYMENT", "PAID")).toBe(true);
    expect(canTransitionOrderStatus("PAYMENT_FAILED", "PAID")).toBe(true);
    expect(canTransitionOrderStatus("PAID", "PROCESSING")).toBe(true);
    expect(canTransitionOrderStatus("SHIPPED", "DELIVERED")).toBe(true);
    expect(canTransitionOrderStatus("DELIVERED", "REFUNDED")).toBe(true);

    expect(canTransitionOrderStatus("CANCELLED", "PAID")).toBe(false);
    expect(canTransitionOrderStatus("REFUNDED", "PAID")).toBe(false);
    expect(canTransitionOrderStatus("DELIVERED", "SHIPPED")).toBe(false);
    expect(canTransitionOrderStatus("PAID", "PAID")).toBe(false);
  });

  it("converts major decimals to minor gateway units cleanly", () => {
    expect(toMinorUnits("1299.99", "USD")).toBe(129999);
    expect(toMinorUnits("5000", "JPY")).toBe(5000);
    expect(fromMinorUnits(129999, "USD").toFixed(2)).toBe("1299.99");
  });
});
