import type { Prisma } from "@/generated/prisma/client";

/**
 * Metal and stone filters mean "available in": a product matches when its listed metal/stone
 * matches, or when the metal/stone is one of its customization options (stored as the
 * `metal_options` / `stone_type` facets). Labels double as URL values, e.g. `?metal=9K+Gold`.
 */
const METAL_GROUPS: Array<{ label: string; codes: string[] }> = [
  { label: "925 Sterling Silver", codes: ["925_silver"] },
  { label: "9K Gold", codes: ["9k_gold", "9k_yellow", "9k_white", "9k_rose"] },
  { label: "10K Gold", codes: ["10k_gold", "10k_yellow", "10k_white", "10k_rose"] },
  { label: "14K Gold", codes: ["14k_gold", "14k_yellow", "14k_white", "14k_rose"] },
  { label: "18K Gold", codes: ["18k_gold", "18k_yellow", "18k_white", "18k_rose"] },
  { label: "Platinum 950", codes: ["platinum_950"] },
];

const STONE_GROUPS: Array<{ label: string; codes: string[] }> = [
  { label: "Moissanite", codes: ["moissanite"] },
  { label: "Lab-Grown Diamond", codes: ["lab_grown_diamond"] },
  { label: "Cubic Zirconia", codes: ["cubic_zirconia"] },
];

const OPTION_FACET_CODES = ["metal_options", "stone_type"];

/** Prisma select fragment that loads the option facets needed by `availableMetals`/`availableStones`. */
export const OPTION_FACETS_SELECT = {
  facetValues: {
    where: { facet: { code: { in: OPTION_FACET_CODES } } },
    select: { option: { select: { value: true } } },
  },
} satisfies Prisma.ProductSelect;

type OptionRow = {
  metalType: string | null;
  stoneOrigin: string | null;
  facetValues: Array<{ option: { value: string } | null }>;
};

function optionCodes(row: OptionRow): Set<string> {
  return new Set(row.facetValues.map((fv) => fv.option?.value).filter((v): v is string => !!v));
}

function matchGroups(
  groups: Array<{ label: string; codes: string[] }>,
  codes: Set<string>,
  listed: string | null,
): string[] {
  const out = new Set<string>();
  const listedClean = listed?.trim();
  if (listedClean) out.add(listedClean);
  for (const g of groups) {
    if (g.codes.some((c) => codes.has(c))) out.add(g.label);
  }
  return [...out];
}

export function availableMetals(row: OptionRow): string[] {
  return matchGroups(METAL_GROUPS, optionCodes(row), row.metalType);
}

export function availableStones(row: OptionRow): string[] {
  return matchGroups(STONE_GROUPS, optionCodes(row), row.stoneOrigin);
}

function codesFor(groups: Array<{ label: string; codes: string[] }>, labels: string[]): string[] {
  return groups.filter((g) => labels.includes(g.label)).flatMap((g) => g.codes);
}

function availabilityWhere(
  column: "metalType" | "stoneOrigin",
  facetCode: string,
  groups: Array<{ label: string; codes: string[] }>,
  labels: string[] | undefined,
): Prisma.ProductWhereInput | null {
  if (!labels || labels.length === 0) return null;
  const codes = codesFor(groups, labels);
  return {
    OR: [
      { [column]: { in: labels } },
      ...(codes.length > 0
        ? [
            {
              facetValues: {
                some: { facet: { code: facetCode }, option: { value: { in: codes } } },
              },
            },
          ]
        : []),
    ],
  };
}

/** WHERE clauses for the metal and stone ("origin") filters; combine with AND. */
export function optionAvailabilityWhere(input: {
  metal?: string[];
  origin?: string[];
}): Prisma.ProductWhereInput[] {
  return [
    availabilityWhere("metalType", "metal_options", METAL_GROUPS, input.metal),
    availabilityWhere("stoneOrigin", "stone_type", STONE_GROUPS, input.origin),
  ].filter((w): w is Prisma.ProductWhereInput => w !== null);
}

/** Sort order for filter lists: silver, then gold by karat, then platinum; stones by popularity. */
export function sortMetalBuckets<T extends { value: string }>(items: T[]): T[] {
  const order = METAL_GROUPS.map((g) => g.label);
  return [...items].sort((a, b) => rank(order, a.value) - rank(order, b.value));
}

export function sortStoneBuckets<T extends { value: string }>(items: T[]): T[] {
  const order = STONE_GROUPS.map((g) => g.label);
  return [...items].sort((a, b) => rank(order, a.value) - rank(order, b.value));
}

function rank(order: string[], value: string): number {
  const i = order.indexOf(value);
  return i === -1 ? order.length : i;
}
