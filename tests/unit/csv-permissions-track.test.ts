import { describe, expect, it } from "vitest";
import { buildCsvDocument, escapeCsvCell } from "@/lib/csv";
import { hasPermission, roleAtLeast } from "@/lib/permissions";

describe("Phase 6 Unit — CSV Formula Injection Guard & RBAC Permission Matrix", () => {
  it("neutralizes spreadsheet formula-injection triggers across prefixes and trims", () => {
    expect(escapeCsvCell("=CMD('calc')")).toBe(`"'=CMD('calc')"`);
    expect(escapeCsvCell("+1+2")).toBe(`"'+1+2"`);
    expect(escapeCsvCell("-100")).toBe(`"'-100"`);
    expect(escapeCsvCell("@SUM(A1:A5)")).toBe(`"'@SUM(A1:A5)"`);
    expect(escapeCsvCell('  =HYPERLINK("http://evil")')).toBe(`"'  =HYPERLINK(""http://evil"")"`);
    expect(escapeCsvCell("Maison, Aurelia")).toBe(`"Maison, Aurelia"`);
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(42)).toBe("42");

    const doc = buildCsvDocument(["Order", "Client"], [["MA-10001", "=EVIL()"]]);
    expect(doc).toBe(`Order,Client\r\nMA-10001,"'=EVIL()"\r\n`);
  });

  it("enforces strict RBAC boundaries between CUSTOMER, STAFF, and ADMIN", () => {
    expect(roleAtLeast("CUSTOMER", "STAFF")).toBe(false);
    expect(roleAtLeast("STAFF", "STAFF")).toBe(true);
    expect(roleAtLeast("STAFF", "ADMIN")).toBe(false);
    expect(roleAtLeast("ADMIN", "ADMIN")).toBe(true);

    // STAFF operational capabilities
    expect(hasPermission("STAFF", "orders:read")).toBe(true);
    expect(hasPermission("STAFF", "orders:update_status")).toBe(true);
    expect(hasPermission("STAFF", "customers:read")).toBe(true);
    expect(hasPermission("STAFF", "enquiries:manage")).toBe(true);
    expect(hasPermission("STAFF", "exports:operational")).toBe(true);

    // STAFF must NOT hold privileged ADMIN permissions
    expect(hasPermission("STAFF", "orders:refund")).toBe(false);
    expect(hasPermission("STAFF", "orders:cancel_paid")).toBe(false);
    expect(hasPermission("STAFF", "customers:read_full_pii")).toBe(false);
    expect(hasPermission("STAFF", "customers:change_role")).toBe(false);
    expect(hasPermission("STAFF", "customers:export")).toBe(false);
    expect(hasPermission("STAFF", "audit:read")).toBe(false);
    expect(hasPermission("STAFF", "settings:manage")).toBe(false);

    // ADMIN holds full governance
    expect(hasPermission("ADMIN", "orders:refund")).toBe(true);
    expect(hasPermission("ADMIN", "orders:cancel_paid")).toBe(true);
    expect(hasPermission("ADMIN", "customers:read_full_pii")).toBe(true);
    expect(hasPermission("ADMIN", "customers:change_role")).toBe(true);
    expect(hasPermission("ADMIN", "customers:export")).toBe(true);
    expect(hasPermission("ADMIN", "audit:read")).toBe(true);
  });
});
