// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "@/server/prisma-client";

const db = createPrismaClient();

describe("Database constraints, FTS trigger, trigram & sequence", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("contains seeded production baseline configuration and shipping zones", async () => {
    const setting = await db.storeSetting.findUnique({ where: { id: "default" } });
    expect(setting).not.toBeNull();
    expect(setting?.currency).toBe("USD");
    expect(Number(setting?.returnWindowDays)).toBe(30);

    const zones = await db.shippingZone.findMany();
    expect(zones.length).toBeGreaterThanOrEqual(2);
  });

  it("populates Product.searchVector automatically and supports FTS & trigram search", async () => {
    const ftsMatches = await db.$queryRaw<Array<{ slug: string }>>`
      SELECT slug FROM "Product"
      WHERE "searchVector" @@ websearch_to_tsquery('english', 'cathedral solitaire')
    `;
    expect(ftsMatches.some((r) => r.slug === "celeste-cathedral-solitaire-ring")).toBe(true);

    const trigramMatches = await db.$queryRaw<Array<{ slug: string; sim: number }>>`
      SELECT slug, word_similarity('solitare', name) AS sim
      FROM "Product"
      WHERE word_similarity('solitare', name) > 0.35
      ORDER BY sim DESC
    `;
    expect(trigramMatches.length).toBeGreaterThan(0);
  });

  it("rejects negative stock or reservedQty > stockQty via Postgres CHECK constraints", async () => {
    const variant = await db.productVariant.findFirst();
    expect(variant).not.toBeNull();

    await expect(
      db.$executeRaw`
        UPDATE "ProductVariant"
        SET "reservedQty" = "stockQty" + 5
        WHERE id = ${variant!.id}
      `,
    ).rejects.toThrow();

    await expect(
      db.$executeRaw`
        UPDATE "ProductVariant"
        SET "stockQty" = -1
        WHERE id = ${variant!.id}
      `,
    ).rejects.toThrow();
  });

  it("rejects negative Product.basePrice and advances order_number_seq monotonically", async () => {
    const prod = await db.product.findFirst();
    expect(prod).not.toBeNull();

    await expect(
      db.$executeRaw`
        UPDATE "Product"
        SET "basePrice" = -10.00
        WHERE id = ${prod!.id}
      `,
    ).rejects.toThrow();

    const seq1 = await db.$queryRaw<
      Array<{ val: bigint }>
    >`SELECT nextval('order_number_seq') AS val`;
    const seq2 = await db.$queryRaw<
      Array<{ val: bigint }>
    >`SELECT nextval('order_number_seq') AS val`;
    expect(Number(seq2[0]?.val)).toBe(Number(seq1[0]?.val) + 1);
  });
});
