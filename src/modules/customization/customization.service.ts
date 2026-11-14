import "server-only";
import { telegramAlerts } from "@/server/telegram";
import crypto from "crypto";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import { MAX_CUSTOMIZATION_FILES } from "@/lib/constants";
import { formatPrice } from "@/lib/currency";
import { env } from "@/lib/env";
import {
  CUSTOMIZATION_CATEGORY_PRESETS,
  detectCategoryPresetKey,
  type CustomizationPresetKey,
  type CustomizationValidationRules,
} from "@/modules/customization/customization.presets";
import type {
  acceptQuoteAsOrderSchema,
  adminAcceptQuoteSchema,
  adminEditSelectionsSchema,
  adminListCustomizationsSchema,
  adminRejectRequestSchema,
  adminRequestInfoSchema,
  adminUpdateRequestNoteSchema,
  applyPresetSchema,
  cancelCustomizationRequestSchema,
  createCustomizationRequestSchema,
  duplicateCustomizationRequestSchema,
  editCustomizationRequestSchema,
  optionGroupInputSchema,
  saveCategoryCustomizationGroupsSchema,
  saveProductCustomizationConfigSchema,
} from "@/modules/customization/customization.schemas";
import {
  sanitizeCustomizationText,
  validateCustomizationSelections,
  type CustomizationOptionGroupDTO,
  type CustomizationOptionValueDTO,
  type NormalizedCustomizationSelection,
  type SubmittedGroupInput,
} from "@/modules/customization/customization.validation";
import {
  getCurrencyCatalogContext,
  resolveActiveCurrencyByCode,
} from "@/modules/currencies/currency.service";
import { writeAuditLog } from "@/server/audit";
import { CACHE_TAGS } from "@/server/cache-tags";
import { assertCustomerOrGuestOwnership, type ActorIdentity } from "@/server/customer-identity";
import { db } from "@/server/db";
import {
  dispatchEmailWithRetry,
  sendCustomizationMoreInfoEmail,
  sendCustomizationQuoteEmail,
  sendCustomizationQuoteExpiringEmail,
  sendCustomizationRejectedEmail,
  sendCustomizationSubmittedEmails,
} from "@/server/email/customization-send";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { createSignedPrivateMediaUrl, isStorageKeyOwnedByActor } from "@/server/private-media";
import { enforceRateLimit, getClientIp } from "@/server/rate-limit";
import { publishRealtimeEvent } from "@/server/realtime/realtime-bus";
import type { z } from "zod";

export interface ProductCustomizationSchemaDTO {
  productId: string;
  productSlug: string;
  productName: string;
  productBasePriceBase: string;
  productImageUrl: string | null;
  categorySlug: string;
  categoryName: string;
  productHasStone: boolean;
  defaultVariantId: string | null;
  enabled: boolean;
  inheritCategoryDefaults: boolean;
  minLeadTimeDays: number | null;
  disclaimerText: string | null;
  detectedPresetKey: CustomizationPresetKey;
  groups: CustomizationOptionGroupDTO[];
}

export interface CustomizationRequestImageDTO {
  id: string;
  storageKey: string;
  url: string;
  thumbUrl: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
}

export interface CustomizationRequestEventDTO {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  eventType: string;
  message: string | null;
  actorRole: string | null;
  createdAt: string;
}

export interface CustomizationRequestSummaryDTO {
  id: string;
  requestNumber: string;
  productId: string;
  productName: string;
  productSlug: string;
  productSku: string;
  productImageUrl: string | null;
  status: string;
  displayCurrency: string;
  indicativeMinBase: string;
  indicativeMaxBase: string;
  quotedPriceBase: string | null;
  quoteExpiresAt: string | null;
  estimatedDeliveryDays: number | null;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  updatedAt: string;
  orderNumber: string | null;
  conversationId: string | null;
}

export interface CustomizationRequestDetailDTO extends CustomizationRequestSummaryDTO {
  variantId: string | null;
  variantTitleSnapshot: string | null;
  basePriceSnapshot: string;
  customerPhone: string | null;
  contactPreference: "EMAIL" | "PHONE";
  preferredTimeline: string | null;
  preferredDate: string | null;
  customerNote: string | null;
  internalNote?: string | null;
  adminMessage: string | null;
  rejectionReason: string | null;
  orderId: string | null;
  acceptedAt: string | null;
  orderedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  selections: NormalizedCustomizationSelection[];
  images: CustomizationRequestImageDTO[];
  events: CustomizationRequestEventDTO[];
}

function mapGroupRowToDTO(
  row: {
    id: string;
    code: string;
    label: string;
    type: CustomizationOptionGroupDTO["type"];
    helperText: string | null;
    placeholder: string | null;
    required: boolean;
    minValue: Prisma.Decimal | null;
    maxValue: Prisma.Decimal | null;
    stepValue: Prisma.Decimal | null;
    defaultValue: string | null;
    maxLength: number | null;
    maxFiles: number | null;
    unit: string | null;
    validationRules: Prisma.JsonValue | null;
    isActive: boolean;
    sortOrder: number;
    values: Array<{
      id: string;
      value: string;
      label: string;
      swatchHex: string | null;
      swatchImageUrl: string | null;
      priceAdjustmentType: CustomizationOptionValueDTO["priceAdjustmentType"];
      priceAdjustmentValue: Prisma.Decimal;
      isAvailable: boolean;
      sortOrder: number;
    }>;
  },
  source: "product" | "category",
): CustomizationOptionGroupDTO {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    type: row.type,
    helperText: row.helperText,
    placeholder: row.placeholder,
    required: row.required,
    minValue: row.minValue ? row.minValue.toString() : null,
    maxValue: row.maxValue ? row.maxValue.toString() : null,
    stepValue: row.stepValue ? row.stepValue.toString() : null,
    defaultValue: row.defaultValue,
    maxLength: row.maxLength,
    maxFiles: row.maxFiles,
    unit: row.unit,
    validationRules: (row.validationRules as CustomizationValidationRules | null) ?? null,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    source,
    values: row.values.map((v) => ({
      id: v.id,
      value: v.value,
      label: v.label,
      swatchHex: v.swatchHex,
      swatchImageUrl: v.swatchImageUrl,
      priceAdjustmentType: v.priceAdjustmentType,
      priceAdjustmentValue: v.priceAdjustmentValue.toString(),
      isAvailable: v.isAvailable,
      sortOrder: v.sortOrder,
    })),
  };
}

export function hashQuoteToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function hashGuestOtpCode(email: string, code: string, guestToken: string): string {
  return crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`${email.toLowerCase()}:${code}:${guestToken}`)
    .digest("hex");
}

function signImageDtos(
  requestId: string,
  images: Array<{
    id: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    originalName: string | null;
  }>,
): CustomizationRequestImageDTO[] {
  return images.map((img) => {
    const thumbKey = img.storageKey.replace(/\.webp$/, "-thumb.webp");
    const fullSigned = createSignedPrivateMediaUrl({
      kind: "customization",
      recordId: requestId,
      storageKey: img.storageKey,
    });
    const thumbSigned = createSignedPrivateMediaUrl({
      kind: "customization",
      recordId: requestId,
      storageKey: thumbKey,
      thumb: true,
    });
    return {
      id: img.id,
      storageKey: img.storageKey,
      url: fullSigned.url,
      thumbUrl: thumbSigned.url,
      mimeType: img.mimeType,
      sizeBytes: img.sizeBytes,
      width: img.width,
      height: img.height,
      originalName: img.originalName,
    };
  });
}

function buildGroupCreatePayload(
  group: z.infer<typeof optionGroupInputSchema>,
  sortOrderOverride?: number,
) {
  return {
    code: group.code,
    label: group.label,
    type: group.type,
    helperText: group.helperText ?? null,
    placeholder: group.placeholder ?? null,
    required: group.required,
    minValue:
      group.minValue !== null && group.minValue !== undefined && group.minValue !== ""
        ? new Prisma.Decimal(group.minValue)
        : null,
    maxValue:
      group.maxValue !== null && group.maxValue !== undefined && group.maxValue !== ""
        ? new Prisma.Decimal(group.maxValue)
        : null,
    stepValue:
      group.stepValue !== null && group.stepValue !== undefined && group.stepValue !== ""
        ? new Prisma.Decimal(group.stepValue)
        : null,
    defaultValue: group.defaultValue ?? null,
    maxLength: group.maxLength ?? null,
    maxFiles: group.maxFiles ?? null,
    unit: group.unit ?? null,
    validationRules: group.validationRules
      ? (group.validationRules as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    isActive: group.isActive,
    sortOrder: sortOrderOverride ?? group.sortOrder,
    values: {
      create: group.values.map((val, idx) => ({
        value: val.value,
        label: val.label,
        swatchHex: val.swatchHex ?? null,
        swatchImageUrl: val.swatchImageUrl ?? null,
        priceAdjustmentType: val.priceAdjustmentType,
        priceAdjustmentValue: new Prisma.Decimal(val.priceAdjustmentValue || 0),
        isAvailable: val.isAvailable,
        sortOrder: idx,
      })),
    },
  };
}

async function loadProductCustomizationSchema(
  productIdOrSlug: string,
  options?: { includeInactive?: boolean },
): Promise<ProductCustomizationSchemaDTO> {
  const product = await db.product.findFirst({
    where: {
      OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }],
    },
    include: {
      category: { include: { parent: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: {
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
      customizationConfig: true,
      customizationGroups: {
        where: options?.includeInactive ? undefined : { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!product) {
    throw new NotFoundError("Product not found.");
  }

  const inheritCategoryDefaults = product.customizationConfig?.inheritCategoryDefaults ?? true;
  const enabled = Boolean(product.isCustomizable && (product.customizationConfig?.enabled ?? true));

  let categoryGroups: CustomizationOptionGroupDTO[] = [];
  if (inheritCategoryDefaults) {
    const rawCatGroups = await db.customizationOptionGroup.findMany({
      where: {
        categoryId: product.categoryId,
        ...(options?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { sortOrder: "asc" },
      include: { values: { orderBy: { sortOrder: "asc" } } },
    });

    if (rawCatGroups.length > 0) {
      categoryGroups = rawCatGroups.map((g) => mapGroupRowToDTO(g, "category"));
    } else if (product.category.parentId) {
      const parentGroups = await db.customizationOptionGroup.findMany({
        where: {
          categoryId: product.category.parentId,
          ...(options?.includeInactive ? {} : { isActive: true }),
        },
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      });
      categoryGroups = parentGroups.map((g) => mapGroupRowToDTO(g, "category"));
    }
  }

  const productGroups = product.customizationGroups.map((g) => mapGroupRowToDTO(g, "product"));
  const mergedMap = new Map<string, CustomizationOptionGroupDTO>();

  for (const catGroup of categoryGroups) {
    mergedMap.set(catGroup.code, catGroup);
  }
  for (const prodGroup of productGroups) {
    mergedMap.set(prodGroup.code, prodGroup);
  }

  const mergedGroups = Array.from(mergedMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    productBasePriceBase: product.basePrice.toString(),
    productImageUrl: product.images[0]?.url ?? null,
    categorySlug: product.category.slug,
    categoryName: product.category.name,
    productHasStone: Boolean(product.stoneShape || product.caratTotal || product.stoneOrigin),
    defaultVariantId: product.variants[0]?.id ?? null,
    enabled,
    inheritCategoryDefaults,
    minLeadTimeDays: product.customizationConfig?.minLeadTimeDays ?? null,
    disclaimerText: product.customizationConfig?.disclaimerText ?? null,
    detectedPresetKey: detectCategoryPresetKey(`${product.category.slug} ${product.category.name}`),
    groups: mergedGroups,
  };
}

async function getPublicProductCustomizationSchemaCached(
  productIdOrSlug: string,
): Promise<ProductCustomizationSchemaDTO> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.products, CACHE_TAGS.categories);
  return loadProductCustomizationSchema(productIdOrSlug, { includeInactive: false });
}

export async function getProductCustomizationSchema(
  productIdOrSlug: string,
  options?: { includeInactive?: boolean },
): Promise<ProductCustomizationSchemaDTO> {
  if (!options?.includeInactive) {
    return getPublicProductCustomizationSchemaCached(productIdOrSlug);
  }
  return loadProductCustomizationSchema(productIdOrSlug, options);
}

export async function getAdminProductCustomizationEditorData(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      category: { include: { parent: true } },
      customizationConfig: true,
      customizationGroups: {
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!product) {
    throw new NotFoundError("Product not found.");
  }

  const categoryGroupsRaw = await db.customizationOptionGroup.findMany({
    where: {
      categoryId: product.categoryId,
    },
    orderBy: { sortOrder: "asc" },
    include: { values: { orderBy: { sortOrder: "asc" } } },
  });

  return {
    productId: product.id,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    enabled: Boolean(product.isCustomizable && (product.customizationConfig?.enabled ?? true)),
    inheritCategoryDefaults: product.customizationConfig?.inheritCategoryDefaults ?? true,
    minLeadTimeDays: product.customizationConfig?.minLeadTimeDays ?? 21,
    disclaimerText:
      product.customizationConfig?.disclaimerText ??
      "This is an estimate. Your final price is confirmed by our jewelers once your stones are selected.",
    detectedPresetKey: detectCategoryPresetKey(`${product.category.slug} ${product.category.name}`),
    productGroups: product.customizationGroups.map((g) => mapGroupRowToDTO(g, "product")),
    categoryGroups: categoryGroupsRaw.map((g) => mapGroupRowToDTO(g, "category")),
  };
}

export async function saveProductCustomizationConfig(
  input: z.infer<typeof saveProductCustomizationConfigSchema>,
  actor: { id: string; email: string; role: string },
) {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: { id: true, slug: true },
  });
  if (!product) throw new NotFoundError("Product not found.");

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { isCustomizable: input.enabled },
    });

    await tx.productCustomizationConfig.upsert({
      where: { productId: product.id },
      update: {
        enabled: input.enabled,
        inheritCategoryDefaults: input.inheritCategoryDefaults,
        minLeadTimeDays: input.minLeadTimeDays ?? null,
        disclaimerText: input.disclaimerText ?? null,
      },
      create: {
        productId: product.id,
        enabled: input.enabled,
        inheritCategoryDefaults: input.inheritCategoryDefaults,
        minLeadTimeDays: input.minLeadTimeDays ?? null,
        disclaimerText: input.disclaimerText ?? null,
      },
    });

    await tx.customizationOptionGroup.deleteMany({
      where: { productId: product.id },
    });

    for (let idx = 0; idx < input.groups.length; idx++) {
      const grp = input.groups[idx]!;
      await tx.customizationOptionGroup.create({
        data: {
          productId: product.id,
          ...buildGroupCreatePayload(grp, idx),
        },
      });
    }
  });

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "PRODUCT_CUSTOMIZATION_CONFIG_UPDATED",
    entityType: "Product",
    entityId: product.id,
    after: { enabled: input.enabled, groupCount: input.groups.length },
  });

  revalidateTag(CACHE_TAGS.products, "max");
  revalidateTag(CACHE_TAGS.product(product.id), "max");
  revalidateTag(CACHE_TAGS.productSlug(product.slug), "max");

  return getAdminProductCustomizationEditorData(product.id);
}

export async function saveCategoryCustomizationGroups(
  input: z.infer<typeof saveCategoryCustomizationGroupsSchema>,
  actor: { id: string; email: string; role: string },
) {
  const category = await db.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, name: true },
  });
  if (!category) throw new NotFoundError("Category not found.");

  await db.$transaction(async (tx) => {
    await tx.customizationOptionGroup.deleteMany({
      where: { categoryId: category.id },
    });

    for (let idx = 0; idx < input.groups.length; idx++) {
      await tx.customizationOptionGroup.create({
        data: {
          categoryId: category.id,
          ...buildGroupCreatePayload(input.groups[idx]!, idx),
        },
      });
    }
  });

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "CATEGORY_CUSTOMIZATION_GROUPS_UPDATED",
    entityType: "Category",
    entityId: category.id,
    after: { groupCount: input.groups.length },
  });

  revalidateTag(CACHE_TAGS.products, "max");
  revalidateTag(CACHE_TAGS.categories, "max");
}

export async function applyCustomizationPreset(
  input: z.infer<typeof applyPresetSchema>,
  actor: { id: string; email: string; role: string },
) {
  const presetGroups = CUSTOMIZATION_CATEGORY_PRESETS[input.presetKey];
  if (input.targetType === "product") {
    const existing = await getAdminProductCustomizationEditorData(input.targetId);
    const nextGroups = input.replaceExisting
      ? presetGroups
      : [
          ...existing.productGroups,
          ...presetGroups.filter((pg) => !existing.productGroups.some((eg) => eg.code === pg.code)),
        ];

    return saveProductCustomizationConfig(
      {
        productId: input.targetId,
        enabled: true,
        inheritCategoryDefaults: false,
        minLeadTimeDays: existing.minLeadTimeDays ?? 21,
        disclaimerText: existing.disclaimerText,
        groups: nextGroups.map((g, idx) => ({
          ...g,
          sortOrder: idx,
          values: g.values.map((v, vIdx) => ({ ...v, sortOrder: vIdx })),
        })),
      },
      actor,
    );
  }

  await saveCategoryCustomizationGroups(
    {
      categoryId: input.targetId,
      groups: presetGroups.map((g, idx) => ({
        ...g,
        sortOrder: idx,
        values: g.values.map((v, vIdx) => ({ ...v, sortOrder: vIdx })),
      })),
    },
    actor,
  );
  return { applied: true, count: presetGroups.length };
}

export async function sendGuestCustomizationVerificationOtp(
  emailRaw: string,
  guestToken: string,
): Promise<{ sent: true; maskedEmail: string }> {
  const email = emailRaw.trim().toLowerCase();
  const ip = await getClientIp();
  await enforceRateLimit("customizationGuestVerify", `${email}:${ip}`);

  const code = String(crypto.randomInt(100000, 999999));
  const valueHash = hashGuestOtpCode(email, code, guestToken);
  const identifier = `cust-guest-otp:${email}`;

  await db.verification.deleteMany({ where: { identifier } });
  await db.verification.create({
    data: {
      id: crypto.randomUUID(),
      identifier,
      value: valueHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  await dispatchEmailWithRetry({
    to: email,
    subject: `Your Verification Code (${code}) — ${env.NEXT_PUBLIC_SITE_NAME}`,
    html: `<p>Use verification code <strong>${code}</strong> to submit your custom design request. It expires in 15 minutes.</p>`,
    text: `Your ${env.NEXT_PUBLIC_SITE_NAME} verification code is: ${code} (expires in 15 minutes).`,
    tag: "customization-guest-otp",
  });

  const [local, domain] = email.split("@");
  const maskedEmail = local && domain ? `${local.slice(0, 2)}***@${domain}` : email;
  return { sent: true, maskedEmail };
}

export async function verifyGuestCustomizationOtp(
  emailRaw: string,
  code: string,
  guestToken: string,
): Promise<{ verified: true }> {
  const email = emailRaw.trim().toLowerCase();
  const ip = await getClientIp();
  await enforceRateLimit("customizationGuestVerify", `verify:${email}:${ip}`);

  const identifier = `cust-guest-otp:${email}`;
  const row = await db.verification.findFirst({
    where: { identifier, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  const expectedHash = hashGuestOtpCode(email, code.trim(), guestToken);
  if (!row || row.value !== expectedHash) {
    throw new ValidationError("Invalid or expired verification code.");
  }

  await db.$transaction([
    db.verification.deleteMany({ where: { identifier } }),
    db.verification.deleteMany({ where: { identifier: `cust-guest-verified:${guestToken}` } }),
    db.verification.create({
      data: {
        id: crypto.randomUUID(),
        identifier: `cust-guest-verified:${guestToken}`,
        value: email,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  return { verified: true };
}

async function assertGuestEmailVerifiedIfAnonymous(
  actor: ActorIdentity,
  email: string,
  inlineCode?: string | null,
): Promise<Date | null> {
  if (actor.userId) return null;
  if (!actor.guestToken) {
    throw new ValidationError(
      "Please confirm your email address before sending your custom request.",
    );
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.verification.findFirst({
    where: {
      identifier: `cust-guest-verified:${actor.guestToken}`,
      value: normalizedEmail,
      expiresAt: { gt: new Date() },
    },
  });
  if (existing) return existing.createdAt;

  if (inlineCode && /^\d{6}$/.test(inlineCode.trim())) {
    await verifyGuestCustomizationOtp(normalizedEmail, inlineCode.trim(), actor.guestToken);
    return new Date();
  }

  throw new ValidationError("Please verify your email with the 6-digit code before submitting.");
}

async function nextCustomizationRequestNumber(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ seq: bigint }>>`
    SELECT nextval('customization_request_number_seq') AS seq
  `;
  const seqNum = Number(rows[0]?.seq ?? 10001);
  return `CR-${new Date().getFullYear()}-${String(seqNum).padStart(5, "0")}`;
}

async function expireStaleQuotesWhereNeeded() {
  const now = new Date();
  const expiring = await db.customizationRequest.findMany({
    where: {
      status: "ACCEPTED",
      quoteExpiresAt: { lt: now },
    },
    select: { id: true },
    take: 50,
  });

  if (expiring.length === 0) return;
  const ids = expiring.map((r) => r.id);

  await db.$transaction(async (tx) => {
    await Promise.all([
      tx.customizationRequest.updateMany({
        where: { id: { in: ids }, status: "ACCEPTED", quoteExpiresAt: { lt: now } },
        data: { status: "EXPIRED" },
      }),
      tx.customizationRequestEvent.createMany({
        data: ids.map((id) => ({
          requestId: id,
          fromStatus: "ACCEPTED",
          toStatus: "EXPIRED",
          eventType: "EXPIRED",
          actorRole: "SYSTEM",
          message: "Quotation validity window elapsed.",
        })),
      }),
    ]);
  });
}

function mapRequestDetail(
  row: {
    id: string;
    requestNumber: string;
    productId: string;
    variantId: string | null;
    status: string;
    displayCurrency: string;
    indicativeMinBase: Prisma.Decimal;
    indicativeMaxBase: Prisma.Decimal;
    quotedPriceBase: Prisma.Decimal | null;
    quoteExpiresAt: Date | null;
    estimatedDeliveryDays: number | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string | null;
    contactPreference: "EMAIL" | "PHONE";
    preferredTimeline: string | null;
    preferredDate: Date | null;
    customerNote: string | null;
    internalNote: string | null;
    adminMessage: string | null;
    rejectionReason: string | null;
    orderId: string | null;
    acceptedAt: Date | null;
    orderedAt: Date | null;
    rejectedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    product: {
      name: string;
      slug: string;
      sku: string;
      images: Array<{ url: string }>;
    };
    order: { orderNumber: string } | null;
    conversations: Array<{ id: string }>;
    item: {
      variantTitleSnapshot: string | null;
      basePriceSnapshot: Prisma.Decimal;
      selections: Prisma.JsonValue;
    } | null;
    images: Array<{
      id: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
      width: number | null;
      height: number | null;
      originalName: string | null;
    }>;
    events: Array<{
      id: string;
      fromStatus: string | null;
      toStatus: string;
      eventType: string;
      message: string | null;
      actorRole: string | null;
      createdAt: Date;
    }>;
  },
  includeInternalNote: boolean,
): CustomizationRequestDetailDTO {
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    productId: row.productId,
    productName: row.product.name,
    productSlug: row.product.slug,
    productSku: row.product.sku,
    productImageUrl: row.product.images[0]?.url ?? null,
    variantId: row.variantId,
    variantTitleSnapshot: row.item?.variantTitleSnapshot ?? null,
    basePriceSnapshot: (row.item?.basePriceSnapshot ?? new Prisma.Decimal(0)).toString(),
    status: row.status,
    displayCurrency: row.displayCurrency,
    indicativeMinBase: row.indicativeMinBase.toString(),
    indicativeMaxBase: row.indicativeMaxBase.toString(),
    quotedPriceBase: row.quotedPriceBase ? row.quotedPriceBase.toString() : null,
    quoteExpiresAt: row.quoteExpiresAt ? row.quoteExpiresAt.toISOString() : null,
    estimatedDeliveryDays: row.estimatedDeliveryDays,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    contactPreference: row.contactPreference,
    preferredTimeline: row.preferredTimeline,
    preferredDate: row.preferredDate ? row.preferredDate.toISOString() : null,
    customerNote: row.customerNote,
    ...(includeInternalNote ? { internalNote: row.internalNote } : {}),
    adminMessage: row.adminMessage,
    rejectionReason: row.rejectionReason,
    orderId: row.orderId,
    orderNumber: row.order?.orderNumber ?? null,
    conversationId: row.conversations[0]?.id ?? null,
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    orderedAt: row.orderedAt ? row.orderedAt.toISOString() : null,
    rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : null,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    selections: Array.isArray(row.item?.selections)
      ? (row.item.selections as unknown as NormalizedCustomizationSelection[])
      : [],
    images: signImageDtos(row.id, row.images),
    events: row.events.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      eventType: e.eventType,
      message: e.message,
      actorRole: e.actorRole,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function createCustomizationRequest(
  input: z.infer<typeof createCustomizationRequestSchema>,
  actor: ActorIdentity,
  displayCurrencyCode = "USD",
): Promise<CustomizationRequestDetailDTO> {
  const ip = await getClientIp();
  await enforceRateLimit("customizationSubmit", `${actor.primaryOwnerKey}:${ip}`);

  const guestVerifiedAt = await assertGuestEmailVerifiedIfAnonymous(
    actor,
    input.customerEmail,
    input.guestVerificationCode,
  );

  const schema = await getProductCustomizationSchema(input.productId, {
    includeInactive: false,
  });
  if (!schema.enabled) {
    throw new ValidationError("Customization is not currently enabled for this creation.");
  }

  for (const img of input.uploadedImages) {
    if (!isStorageKeyOwnedByActor(img.storageKey, "customizations", actor.allOwnerKeys)) {
      throw new ForbiddenError(
        "One or more reference images do not belong to your active session.",
      );
    }
  }

  const validation = validateCustomizationSelections({
    groups: schema.groups,
    inputs: input.selections as Record<string, SubmittedGroupInput>,
    uploadedImageCount: input.uploadedImages.length,
    context: {
      basePriceBase: schema.productBasePriceBase,
      categorySlug: schema.categorySlug,
      categoryName: schema.categoryName,
      productHasStone: schema.productHasStone,
    },
  });

  if (!validation.ok) {
    const fieldErrors: Record<string, string[]> = {};
    for (const err of validation.errors) {
      fieldErrors[err.groupCode] = [err.message];
    }
    throw new ValidationError(
      validation.errors[0]?.message ?? "Invalid customization options.",
      fieldErrors,
    );
  }

  const productMeta = await db.product.findUnique({
    where: { id: schema.productId },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      basePrice: true,
      variants: input.variantId
        ? { where: { id: input.variantId }, select: { id: true, title: true } }
        : { take: 1, select: { id: true, title: true } },
    },
  });
  if (!productMeta) throw new NotFoundError("Product not found.");

  const { currency: activeCurr } = await resolveActiveCurrencyByCode(displayCurrencyCode);
  const customerEmailNormalized = input.customerEmail.trim().toLowerCase();
  const cleanedName = sanitizeCustomizationText(input.customerName);
  const cleanedNote = input.customerNote ? sanitizeCustomizationText(input.customerNote) : null;
  const cleanedTimeline = input.preferredTimeline
    ? sanitizeCustomizationText(input.preferredTimeline)
    : null;

  const created = await db.$transaction(async (tx) => {
    const requestNumber = await nextCustomizationRequestNumber(tx);
    const reqRow = await tx.customizationRequest.create({
      data: {
        requestNumber,
        productId: productMeta.id,
        variantId: productMeta.variants[0]?.id ?? null,
        userId: actor.userId,
        guestEmail: actor.userId ? null : customerEmailNormalized,
        guestEmailVerifiedAt: guestVerifiedAt,
        guestToken: actor.userId ? null : actor.guestToken,
        customerName: cleanedName,
        customerEmail: customerEmailNormalized,
        customerPhone: input.customerPhone?.trim() || null,
        contactPreference: input.contactPreference,
        preferredTimeline: cleanedTimeline,
        preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
        customerNote: cleanedNote,
        status: "SUBMITTED",
        displayCurrency: activeCurr.code,
        indicativeMinBase: new Prisma.Decimal(validation.indicativeMinBase),
        indicativeMaxBase: new Prisma.Decimal(validation.indicativeMaxBase),
        item: {
          create: {
            productNameSnapshot: productMeta.name,
            productSlugSnapshot: productMeta.slug,
            productSkuSnapshot: productMeta.sku,
            variantTitleSnapshot: productMeta.variants[0]?.title ?? null,
            basePriceSnapshot: productMeta.basePrice,
            selections: validation.selections as unknown as Prisma.InputJsonValue,
          },
        },
        images: {
          create: input.uploadedImages.slice(0, MAX_CUSTOMIZATION_FILES).map((img, idx) => ({
            storageKey: img.storageKey,
            url: img.storageKey,
            thumbUrl: img.thumbKey ?? img.storageKey.replace(/\.webp$/, "-thumb.webp"),
            mimeType: img.mimeType,
            sizeBytes: img.sizeBytes,
            width: img.width ?? null,
            height: img.height ?? null,
            originalName: img.originalName ?? null,
            sortOrder: idx,
          })),
        },
        events: {
          create: {
            fromStatus: null,
            toStatus: "SUBMITTED",
            eventType: "SUBMITTED",
            message: "Customization request submitted by customer",
            actorId: actor.userId,
            actorRole: actor.role ?? "CUSTOMER",
          },
        },
      },
    });

    await tx.conversation.create({
      data: {
        contextType: "CUSTOMIZATION_REQUEST",
        contextRefId: reqRow.id,
        customizationRequestId: reqRow.id,
        userId: actor.userId,
        guestEmail: actor.userId ? null : customerEmailNormalized,
        guestEmailVerifiedAt: guestVerifiedAt,
        guestToken: actor.userId ? null : actor.guestToken,
        guestName: cleanedName,
        status: "OPEN",
        tags: ["Customization"],
        ...(actor.userId
          ? { participants: { create: [{ userId: actor.userId, role: "CUSTOMER" }] } }
          : {}),
      },
    });

    return reqRow;
  });

  const minDisplay = formatPrice(validation.indicativeMinBase, activeCurr);
  const maxDisplay = formatPrice(validation.indicativeMaxBase, activeCurr);
  const baseRange = `$${validation.indicativeMinBase} – $${validation.indicativeMaxBase}`;

  await sendCustomizationSubmittedEmails({
    requestId: created.id,
    requestNumber: created.requestNumber,
    productName: productMeta.name,
    customerName: cleanedName,
    customerEmail: customerEmailNormalized,
    indicativeRangeDisplay: `${minDisplay} – ${maxDisplay}`,
    indicativeRangeBase: baseRange,
    selections: validation.selections.map((s) => ({
      label: s.groupLabel,
      value: s.displayValue,
    })),
  });

  await publishRealtimeEvent({
    type: "customization.updated",
    requestId: created.id,
    status: "SUBMITTED",
    customerTargetKeys: [
      ...(actor.userId ? [`user:${actor.userId}`] : []),
      ...(actor.guestToken ? [`guest:${actor.guestToken}`] : []),
    ],
    notifyAdminInbox: true,
  });

  telegramAlerts.customizationRequest({
    id: created.id,
    requestNumber: created.requestNumber,
    productName: productMeta.name,
    customerName: cleanedName,
    customerEmail: customerEmailNormalized,
    summary: validation.selections
      .filter((s) => s.displayValue)
      .map((s) => `${s.groupLabel}: ${s.displayValue}`),
  });

  return getCustomizationRequestDetailForActor(created.id, actor);
}

const REQUEST_DETAIL_INCLUDE = {
  product: {
    select: {
      name: true,
      slug: true,
      sku: true,
      images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
    },
  },
  order: { select: { orderNumber: true } },
  conversations: { select: { id: true }, take: 1 },
  item: true,
  images: { orderBy: { sortOrder: "asc" as const } },
  events: { orderBy: { createdAt: "asc" as const } },
};

export async function listCustomerCustomizationRequests(
  actor: ActorIdentity,
): Promise<CustomizationRequestSummaryDTO[]> {
  await expireStaleQuotesWhereNeeded();
  if (!actor.userId && !actor.guestToken) return [];

  const rows = await db.customizationRequest.findMany({
    where: actor.userId ? { userId: actor.userId } : { guestToken: actor.guestToken! },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          name: true,
          slug: true,
          sku: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        },
      },
      order: { select: { orderNumber: true } },
      conversations: { select: { id: true }, take: 1 },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    requestNumber: row.requestNumber,
    productId: row.productId,
    productName: row.product.name,
    productSlug: row.product.slug,
    productSku: row.product.sku,
    productImageUrl: row.product.images[0]?.url ?? null,
    status: row.status,
    displayCurrency: row.displayCurrency,
    indicativeMinBase: row.indicativeMinBase.toString(),
    indicativeMaxBase: row.indicativeMaxBase.toString(),
    quotedPriceBase: row.quotedPriceBase ? row.quotedPriceBase.toString() : null,
    quoteExpiresAt: row.quoteExpiresAt ? row.quoteExpiresAt.toISOString() : null,
    estimatedDeliveryDays: row.estimatedDeliveryDays,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    orderNumber: row.order?.orderNumber ?? null,
    conversationId: row.conversations[0]?.id ?? null,
  }));
}

export async function getCustomizationRequestDetailForActor(
  requestId: string,
  actor: ActorIdentity,
): Promise<CustomizationRequestDetailDTO> {
  await expireStaleQuotesWhereNeeded();
  const row = await db.customizationRequest.findUnique({
    where: { id: requestId },
    include: REQUEST_DETAIL_INCLUDE,
  });
  if (!row) throw new NotFoundError("Customization request not found.");

  assertCustomerOrGuestOwnership(actor, row, "customization:manage");
  return mapRequestDetail(row, actor.isStaff);
}

export async function editSubmittedCustomizationRequest(
  input: z.infer<typeof editCustomizationRequestSchema>,
  actor: ActorIdentity,
): Promise<CustomizationRequestDetailDTO> {
  const existing = await db.customizationRequest.findUnique({
    where: { id: input.requestId },
    include: { images: true },
  });
  if (!existing) throw new NotFoundError("Customization request not found.");
  assertCustomerOrGuestOwnership(actor, existing, "customization:manage");

  if (existing.status !== "SUBMITTED") {
    throw new ConflictError(
      "You can only edit a request before we start reviewing it. Message us in chat to make changes.",
    );
  }

  const schema = await getProductCustomizationSchema(existing.productId, {
    includeInactive: false,
  });

  const existingKeys = new Set(existing.images.map((i) => i.storageKey));
  for (const img of input.uploadedImages) {
    if (
      !existingKeys.has(img.storageKey) &&
      !isStorageKeyOwnedByActor(img.storageKey, "customizations", actor.allOwnerKeys)
    ) {
      throw new ForbiddenError("Unauthorized reference image key.");
    }
  }

  const validation = validateCustomizationSelections({
    groups: schema.groups,
    inputs: input.selections as Record<string, SubmittedGroupInput>,
    uploadedImageCount: input.uploadedImages.length,
    context: {
      basePriceBase: schema.productBasePriceBase,
      categorySlug: schema.categorySlug,
      categoryName: schema.categoryName,
      productHasStone: schema.productHasStone,
    },
  });

  if (!validation.ok) {
    throw new ValidationError(validation.errors[0]?.message ?? "Invalid customization options.");
  }

  await db.$transaction(async (tx) => {
    await tx.customizationRequest.update({
      where: { id: existing.id },
      data: {
        customerPhone: input.customerPhone?.trim() || null,
        contactPreference: input.contactPreference,
        preferredTimeline: input.preferredTimeline
          ? sanitizeCustomizationText(input.preferredTimeline)
          : null,
        preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
        customerNote: input.customerNote ? sanitizeCustomizationText(input.customerNote) : null,
        indicativeMinBase: new Prisma.Decimal(validation.indicativeMinBase),
        indicativeMaxBase: new Prisma.Decimal(validation.indicativeMaxBase),
      },
    });

    await tx.customizationRequestItem.update({
      where: { requestId: existing.id },
      data: {
        selections: validation.selections as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.customizationRequestImage.deleteMany({ where: { requestId: existing.id } });
    if (input.uploadedImages.length > 0) {
      await tx.customizationRequestImage.createMany({
        data: input.uploadedImages.slice(0, MAX_CUSTOMIZATION_FILES).map((img, idx) => ({
          requestId: existing.id,
          storageKey: img.storageKey,
          url: img.storageKey,
          thumbUrl: img.thumbKey ?? img.storageKey.replace(/\.webp$/, "-thumb.webp"),
          mimeType: img.mimeType,
          sizeBytes: img.sizeBytes,
          width: img.width ?? null,
          height: img.height ?? null,
          originalName: img.originalName ?? null,
          sortOrder: idx,
        })),
      });
    }

    await tx.customizationRequestEvent.create({
      data: {
        requestId: existing.id,
        fromStatus: "SUBMITTED",
        toStatus: "SUBMITTED",
        eventType: "SELECTIONS_EDITED",
        message: "Customer updated configuration specifications",
        actorId: actor.userId,
        actorRole: actor.role ?? "CUSTOMER",
      },
    });
  });

  return getCustomizationRequestDetailForActor(existing.id, actor);
}

export async function cancelCustomizationRequest(
  input: z.infer<typeof cancelCustomizationRequestSchema>,
  actor: ActorIdentity,
): Promise<CustomizationRequestDetailDTO> {
  const existing = await db.customizationRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!existing) throw new NotFoundError("Customization request not found.");
  assertCustomerOrGuestOwnership(actor, existing, "customization:manage");

  if (!["SUBMITTED", "IN_REVIEW", "ACCEPTED"].includes(existing.status)) {
    throw new ConflictError(`Cannot cancel request in status ${existing.status}.`);
  }

  await db.$transaction(async (tx) => {
    await tx.customizationRequest.update({
      where: { id: existing.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });
    await tx.quoteToken.updateMany({
      where: { requestId: existing.id, revokedAt: null, usedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.customizationRequestEvent.create({
      data: {
        requestId: existing.id,
        fromStatus: existing.status,
        toStatus: "CANCELLED",
        eventType: "CANCELLED",
        message: input.reason ? sanitizeCustomizationText(input.reason) : "Cancelled by customer",
        actorId: actor.userId,
        actorRole: actor.role ?? "CUSTOMER",
      },
    });
  });

  return getCustomizationRequestDetailForActor(existing.id, actor);
}

export async function duplicateCustomizationRequest(
  input: z.infer<typeof duplicateCustomizationRequestSchema>,
  actor: ActorIdentity,
  displayCurrencyCode = "USD",
): Promise<CustomizationRequestDetailDTO> {
  const source = await db.customizationRequest.findUnique({
    where: { id: input.requestId },
    include: { item: true, images: true },
  });
  if (!source) throw new NotFoundError("Source customization request not found.");
  assertCustomerOrGuestOwnership(actor, source, "customization:manage");

  const selectionsMap: Record<string, SubmittedGroupInput> = {};
  const prior = Array.isArray(source.item?.selections)
    ? (source.item.selections as unknown as NormalizedCustomizationSelection[])
    : [];

  for (const sel of prior) {
    if (sel.groupType === "SELECT" || sel.groupType === "SWATCH") {
      selectionsMap[sel.groupCode] = { value: sel.valueCodes[0] ?? "" };
    } else if (sel.groupType === "MULTI_SELECT") {
      selectionsMap[sel.groupCode] = { values: sel.valueCodes };
    } else if (sel.groupType === "NUMBER_RANGE") {
      selectionsMap[sel.groupCode] = { numberValue: sel.numberValue };
    } else if (sel.groupType === "TEXT" || sel.groupType === "TEXTAREA") {
      selectionsMap[sel.groupCode] = { textValue: sel.rawText };
    }
  }

  return createCustomizationRequest(
    {
      productId: source.productId,
      variantId: source.variantId,
      selections: selectionsMap,
      uploadedImages: [],
      customerName: actor.userName ?? source.customerName,
      customerEmail: actor.userEmail ?? source.customerEmail,
      customerPhone: source.customerPhone,
      contactPreference: source.contactPreference,
      preferredTimeline: source.preferredTimeline,
      preferredDate: null,
      customerNote: source.customerNote,
    },
    actor,
    displayCurrencyCode,
  );
}

export async function listAdminCustomizationRequests(
  rawFilter: z.input<typeof adminListCustomizationsSchema>,
) {
  await expireStaleQuotesWhereNeeded();
  const page = Math.max(1, Number(rawFilter.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(rawFilter.pageSize ?? 20) || 20));

  const where: Prisma.CustomizationRequestWhereInput = {};
  if (rawFilter.status && rawFilter.status !== "ALL") {
    where.status = rawFilter.status;
  }
  if (rawFilter.productId) {
    where.productId = rawFilter.productId;
  }
  if (rawFilter.dateFrom || rawFilter.dateTo) {
    where.createdAt = {
      ...(rawFilter.dateFrom ? { gte: new Date(rawFilter.dateFrom) } : {}),
      ...(rawFilter.dateTo ? { lte: new Date(`${rawFilter.dateTo}T23:59:59Z`) } : {}),
    };
  }
  if (rawFilter.search?.trim()) {
    const q = rawFilter.search.trim();
    where.OR = [
      { requestNumber: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { product: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const orderBy: Prisma.CustomizationRequestOrderByWithRelationInput =
    rawFilter.sortBy === "oldest"
      ? { createdAt: "asc" }
      : rawFilter.sortBy === "quoted_high"
        ? { quotedPriceBase: { sort: "desc", nulls: "last" } }
        : rawFilter.sortBy === "expiring_soon"
          ? { quoteExpiresAt: { sort: "asc", nulls: "last" } }
          : { createdAt: "desc" };

  const [totalCount, rows] = await Promise.all([
    db.customizationRequest.count({ where }),
    db.customizationRequest.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: {
          select: {
            name: true,
            slug: true,
            sku: true,
            images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          },
        },
        order: { select: { orderNumber: true } },
        conversations: { select: { id: true }, take: 1 },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      requestNumber: row.requestNumber,
      productId: row.productId,
      productName: row.product.name,
      productSlug: row.product.slug,
      productSku: row.product.sku,
      productImageUrl: row.product.images[0]?.url ?? null,
      status: row.status,
      displayCurrency: row.displayCurrency,
      indicativeMinBase: row.indicativeMinBase.toString(),
      indicativeMaxBase: row.indicativeMaxBase.toString(),
      quotedPriceBase: row.quotedPriceBase ? row.quotedPriceBase.toString() : null,
      quoteExpiresAt: row.quoteExpiresAt ? row.quoteExpiresAt.toISOString() : null,
      estimatedDeliveryDays: row.estimatedDeliveryDays,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      orderNumber: row.order?.orderNumber ?? null,
      conversationId: row.conversations[0]?.id ?? null,
    })),
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function adminEditRequestSelections(
  input: z.infer<typeof adminEditSelectionsSchema>,
  staffActor: { id: string; email: string; role: string },
) {
  const reqRow = await db.customizationRequest.findUnique({
    where: { id: input.requestId },
    include: { images: true },
  });
  if (!reqRow) throw new NotFoundError("Customization request not found.");
  if (["ORDERED", "CANCELLED"].includes(reqRow.status)) {
    throw new ConflictError("Ordered or cancelled requests cannot be modified.");
  }

  const schema = await getProductCustomizationSchema(reqRow.productId, {
    includeInactive: false,
  });

  const validation = validateCustomizationSelections({
    groups: schema.groups,
    inputs: input.selections as Record<string, SubmittedGroupInput>,
    uploadedImageCount: reqRow.images.length,
    context: {
      basePriceBase: schema.productBasePriceBase,
      categorySlug: schema.categorySlug,
      categoryName: schema.categoryName,
      productHasStone: schema.productHasStone,
    },
  });

  if (!validation.ok) {
    throw new ValidationError(validation.errors[0]?.message ?? "Invalid customization options.");
  }

  await db.$transaction(async (tx) => {
    await tx.customizationRequest.update({
      where: { id: reqRow.id },
      data: {
        indicativeMinBase: new Prisma.Decimal(validation.indicativeMinBase),
        indicativeMaxBase: new Prisma.Decimal(validation.indicativeMaxBase),
        ...(input.internalNote !== undefined
          ? {
              internalNote: input.internalNote
                ? sanitizeCustomizationText(input.internalNote)
                : null,
            }
          : {}),
        ...(reqRow.status === "SUBMITTED" ? { status: "IN_REVIEW" } : {}),
      },
    });
    await tx.customizationRequestItem.update({
      where: { requestId: reqRow.id },
      data: {
        selections: validation.selections as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.customizationRequestEvent.create({
      data: {
        requestId: reqRow.id,
        fromStatus: reqRow.status,
        toStatus: reqRow.status === "SUBMITTED" ? "IN_REVIEW" : reqRow.status,
        eventType: "ADMIN_SELECTIONS_EDITED",
        message: "Our jewelers updated the details before quoting",
        actorId: staffActor.id,
        actorRole: staffActor.role,
      },
    });
  });

  await writeAuditLog({
    actorId: staffActor.id,
    actorEmail: staffActor.email,
    actorRole: staffActor.role,
    action: "CUSTOMIZATION_SELECTIONS_EDITED",
    entityType: "CustomizationRequest",
    entityId: reqRow.id,
  });

  return getCustomizationRequestDetailForActor(reqRow.id, {
    userId: staffActor.id,
    userEmail: staffActor.email,
    userName: null,
    role: staffActor.role as ActorIdentity["role"],
    guestToken: null,
    primaryOwnerKey: `user:${staffActor.id}`,
    allOwnerKeys: [`user:${staffActor.id}`],
    isStaff: true,
  });
}

export async function adminAcceptCustomizationQuote(
  input: z.infer<typeof adminAcceptQuoteSchema>,
  staffActor: { id: string; email: string; role: string },
) {
  const reqRow = await db.customizationRequest.findUnique({
    where: { id: input.requestId },
    include: { item: true, product: { select: { name: true } } },
  });
  if (!reqRow) throw new NotFoundError("Customization request not found.");
  if (["ORDERED", "CANCELLED"].includes(reqRow.status)) {
    throw new ConflictError("Cannot quote an ordered or cancelled customization request.");
  }

  const lockedBasePrice = new Decimal(input.quotedPriceBase).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  const expiresAt = new Date(Date.now() + input.validityDays * 24 * 60 * 60 * 1000);
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashQuoteToken(rawToken);

  await db.$transaction(async (tx) => {
    await tx.quoteToken.updateMany({
      where: { requestId: reqRow.id, revokedAt: null, usedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.quoteToken.create({
      data: {
        requestId: reqRow.id,
        tokenHash,
        lockedPriceBase: lockedBasePrice.toFixed(2),
        expiresAt,
      },
    });

    await tx.customizationRequest.update({
      where: { id: reqRow.id },
      data: {
        status: "ACCEPTED",
        quotedPriceBase: lockedBasePrice.toFixed(2),
        quoteExpiresAt: expiresAt,
        estimatedDeliveryDays: input.estimatedDeliveryDays ?? null,
        adminMessage: input.adminMessage ? sanitizeCustomizationText(input.adminMessage) : null,
        ...(input.internalNote !== undefined
          ? {
              internalNote: input.internalNote
                ? sanitizeCustomizationText(input.internalNote)
                : null,
            }
          : {}),
        reviewedById: staffActor.id,
        acceptedAt: new Date(),
        reminder24hSentAt: null,
      },
    });

    await tx.customizationRequestEvent.create({
      data: {
        requestId: reqRow.id,
        fromStatus: reqRow.status,
        toStatus: "ACCEPTED",
        eventType: "QUOTED",
        message: `Quoted at $${lockedBasePrice.toFixed(2)} valid until ${expiresAt.toISOString().slice(0, 10)}`,
        actorId: staffActor.id,
        actorRole: staffActor.role,
      },
    });
  });

  await writeAuditLog({
    actorId: staffActor.id,
    actorEmail: staffActor.email,
    actorRole: staffActor.role,
    action: "CUSTOMIZATION_QUOTE_ISSUED",
    entityType: "CustomizationRequest",
    entityId: reqRow.id,
    after: { quotedPriceBase: lockedBasePrice.toFixed(2), validityDays: input.validityDays },
  });

  const { currency: customerCurr } = await resolveActiveCurrencyByCode(reqRow.displayCurrency);
  const { baseCurrency } = await getCurrencyCatalogContext();
  const displayFormatted = formatPrice(lockedBasePrice.toFixed(2), customerCurr, { exact: true });
  const baseFormatted = formatPrice(lockedBasePrice.toFixed(2), baseCurrency, { exact: true });
  const selectionsList = Array.isArray(reqRow.item?.selections)
    ? (reqRow.item.selections as unknown as NormalizedCustomizationSelection[]).map((s) => ({
        label: s.groupLabel,
        value: s.displayValue,
      }))
    : [];

  await sendCustomizationQuoteEmail({
    customerEmail: reqRow.customerEmail,
    customerName: reqRow.customerName,
    requestNumber: reqRow.requestNumber,
    productName: reqRow.product.name,
    finalPriceDisplay: displayFormatted,
    basePriceNote: customerCurr.code !== baseCurrency.code ? `Base price: ${baseFormatted}` : null,
    expiresAtFormatted: expiresAt.toUTCString().replace("GMT", "UTC"),
    estimatedDeliveryDays: input.estimatedDeliveryDays ?? null,
    adminMessage: input.adminMessage ?? null,
    selections: selectionsList,
    rawAcceptToken: rawToken,
  });

  await publishRealtimeEvent({
    type: "customization.updated",
    requestId: reqRow.id,
    status: "ACCEPTED",
    customerTargetKeys: [
      ...(reqRow.userId ? [`user:${reqRow.userId}`] : []),
      ...(reqRow.guestToken ? [`guest:${reqRow.guestToken}`] : []),
    ],
    notifyAdminInbox: true,
  });

  return {
    requestId: reqRow.id,
    quotedPriceBase: lockedBasePrice.toFixed(2),
    quoteExpiresAt: expiresAt.toISOString(),
  };
}

export async function adminRejectCustomizationRequest(
  input: z.infer<typeof adminRejectRequestSchema>,
  staffActor: { id: string; email: string; role: string },
) {
  const reqRow = await db.customizationRequest.findUnique({
    where: { id: input.requestId },
    include: { product: { select: { name: true } } },
  });
  if (!reqRow) throw new NotFoundError("Customization request not found.");
  if (["ORDERED", "CANCELLED"].includes(reqRow.status)) {
    throw new ConflictError("Cannot reject an ordered or cancelled customization request.");
  }

  const reason = sanitizeCustomizationText(input.rejectionReason);

  await db.$transaction(async (tx) => {
    await tx.customizationRequest.update({
      where: { id: reqRow.id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        ...(input.internalNote !== undefined
          ? {
              internalNote: input.internalNote
                ? sanitizeCustomizationText(input.internalNote)
                : null,
            }
          : {}),
        reviewedById: staffActor.id,
        rejectedAt: new Date(),
      },
    });
    await tx.quoteToken.updateMany({
      where: { requestId: reqRow.id, revokedAt: null, usedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.customizationRequestEvent.create({
      data: {
        requestId: reqRow.id,
        fromStatus: reqRow.status,
        toStatus: "REJECTED",
        eventType: "REJECTED",
        message: reason,
        actorId: staffActor.id,
        actorRole: staffActor.role,
      },
    });
  });

  await writeAuditLog({
    actorId: staffActor.id,
    actorEmail: staffActor.email,
    actorRole: staffActor.role,
    action: "CUSTOMIZATION_REJECTED",
    entityType: "CustomizationRequest",
    entityId: reqRow.id,
  });

  await sendCustomizationRejectedEmail({
    requestId: reqRow.id,
    customerEmail: reqRow.customerEmail,
    customerName: reqRow.customerName,
    requestNumber: reqRow.requestNumber,
    productName: reqRow.product.name,
    reason,
  });

  await publishRealtimeEvent({
    type: "customization.updated",
    requestId: reqRow.id,
    status: "REJECTED",
    customerTargetKeys: [
      ...(reqRow.userId ? [`user:${reqRow.userId}`] : []),
      ...(reqRow.guestToken ? [`guest:${reqRow.guestToken}`] : []),
    ],
    notifyAdminInbox: true,
  });

  return { requestId: reqRow.id, status: "REJECTED" };
}

export async function adminRequestMoreInfo(
  input: z.infer<typeof adminRequestInfoSchema>,
  staffActor: { id: string; email: string; name: string | null; role: string },
) {
  const reqRow = await db.customizationRequest.findUnique({
    where: { id: input.requestId },
    include: { product: { select: { name: true } }, conversations: { take: 1 } },
  });
  if (!reqRow) throw new NotFoundError("Customization request not found.");

  const question = sanitizeCustomizationText(input.message);
  const nextStatus = reqRow.status === "SUBMITTED" ? "IN_REVIEW" : reqRow.status;

  const txResult = await db.$transaction(async (tx) => {
    await tx.customizationRequest.update({
      where: { id: reqRow.id },
      data: {
        status: nextStatus,
        ...(input.internalNote !== undefined
          ? {
              internalNote: input.internalNote
                ? sanitizeCustomizationText(input.internalNote)
                : null,
            }
          : {}),
      },
    });

    await tx.customizationRequestEvent.create({
      data: {
        requestId: reqRow.id,
        fromStatus: reqRow.status,
        toStatus: nextStatus,
        eventType: "INFO_REQUESTED",
        message: question,
        actorId: staffActor.id,
        actorRole: staffActor.role,
      },
    });

    let convId = reqRow.conversations[0]?.id;
    if (!convId) {
      const conv = await tx.conversation.create({
        data: {
          contextType: "CUSTOMIZATION_REQUEST",
          contextRefId: reqRow.id,
          customizationRequestId: reqRow.id,
          userId: reqRow.userId,
          guestEmail: reqRow.userId ? null : reqRow.customerEmail,
          guestToken: reqRow.userId ? null : reqRow.guestToken,
          guestName: reqRow.customerName,
          status: "OPEN",
          tags: ["Customization"],
        },
      });
      convId = conv.id;
    }

    const createdMsg = await tx.message.create({
      data: {
        conversationId: convId,
        senderId: staffActor.id,
        senderRole: "ADMIN",
        senderName: staffActor.name ?? "Customer Care",
        type: "TEXT",
        body: question,
        deliveredAt: new Date(),
      },
    });

    await tx.conversation.update({
      where: { id: convId },
      data: {
        status: "OPEN",
        lastMessageAt: createdMsg.createdAt,
        lastMessagePreview: question.slice(0, 140),
      },
    });

    return { convId, createdMsg };
  });

  const conversationId = txResult.convId;
  const targetKeys = [
    ...(reqRow.userId ? [`user:${reqRow.userId}`] : []),
    ...(reqRow.guestToken ? [`guest:${reqRow.guestToken}`] : []),
  ];

  await publishRealtimeEvent({
    type: "message.created",
    conversationId,
    message: {
      id: txResult.createdMsg.id,
      seq: txResult.createdMsg.seq,
      conversationId,
      senderId: txResult.createdMsg.senderId,
      senderRole: txResult.createdMsg.senderRole,
      senderName: txResult.createdMsg.senderName,
      type: txResult.createdMsg.type,
      body: txResult.createdMsg.body,
      attachments: [],
      refId: null,
      refSnapshot: null,
      clientTempId: null,
      deliveredAt: txResult.createdMsg.deliveredAt?.toISOString() ?? null,
      readAt: null,
      createdAt: txResult.createdMsg.createdAt.toISOString(),
    },
    customerTargetKeys: targetKeys,
    notifyAdminInbox: true,
  });

  await publishRealtimeEvent({
    type: "customization.updated",
    requestId: reqRow.id,
    status: nextStatus,
    customerTargetKeys: targetKeys,
    notifyAdminInbox: true,
  });

  await sendCustomizationMoreInfoEmail({
    requestId: reqRow.id,
    customerEmail: reqRow.customerEmail,
    customerName: reqRow.customerName,
    requestNumber: reqRow.requestNumber,
    productName: reqRow.product.name,
    question,
  });

  return { requestId: reqRow.id, conversationId, status: nextStatus };
}

export async function adminUpdateCustomizationInternalNote(
  input: z.infer<typeof adminUpdateRequestNoteSchema>,
  _staffActor: { id: string; email: string; role: string },
) {
  const existing = await db.customizationRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!existing) throw new NotFoundError("Customization request not found.");

  await db.customizationRequest.update({
    where: { id: existing.id },
    data: {
      internalNote: input.internalNote ? sanitizeCustomizationText(input.internalNote) : null,
      ...(input.status && ["SUBMITTED", "IN_REVIEW"].includes(existing.status)
        ? { status: input.status }
        : {}),
    },
  });

  return { requestId: existing.id, saved: true };
}

export type QuoteTokenResolution =
  | {
      state: "VALID";
      tokenRecordId: string;
      requestId: string;
      requestNumber: string;
      productId: string;
      productName: string;
      productSlug: string;
      productImageUrl: string | null;
      variantId: string;
      lockedPriceBase: string;
      displayCurrency: string;
      quoteExpiresAt: string;
      estimatedDeliveryDays: number | null;
      adminMessage: string | null;
      customerName: string;
      customerEmail: string;
      userId: string | null;
      guestToken: string | null;
      selections: NormalizedCustomizationSelection[];
    }
  | {
      state: "EXPIRED" | "USED" | "INVALID" | "REQUIRES_LOGIN";
      productSlug?: string;
      requestId?: string;
      requestNumber?: string;
    };

export async function resolveQuoteAcceptanceToken(
  rawToken: string,
  actor: ActorIdentity | null,
): Promise<QuoteTokenResolution> {
  const tokenHash = hashQuoteToken(rawToken);
  const tokenRow = await db.quoteToken.findUnique({
    where: { tokenHash },
    include: {
      request: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
              variants: {
                where: { isActive: true },
                orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
                take: 1,
                select: { id: true },
              },
            },
          },
          item: true,
        },
      },
    },
  });

  if (!tokenRow || tokenRow.revokedAt) {
    return { state: "INVALID" };
  }
  const req = tokenRow.request;

  if (tokenRow.usedAt || req.status === "ORDERED") {
    return {
      state: "USED",
      productSlug: req.product.slug,
      requestId: req.id,
      requestNumber: req.requestNumber,
    };
  }

  if (tokenRow.expiresAt < new Date() || (req.quoteExpiresAt && req.quoteExpiresAt < new Date())) {
    if (req.status === "ACCEPTED") {
      await db.customizationRequest.update({
        where: { id: req.id },
        data: { status: "EXPIRED" },
      });
    }
    return {
      state: "EXPIRED",
      productSlug: req.product.slug,
      requestId: req.id,
      requestNumber: req.requestNumber,
    };
  }

  if (req.status !== "ACCEPTED" || !req.quotedPriceBase) {
    return {
      state: "INVALID",
      productSlug: req.product.slug,
    };
  }

  // Ownership enforcement: if request belongs to a registered user, verify caller owns it (or prompt login)
  if (req.userId) {
    if (!actor?.userId) {
      return {
        state: "REQUIRES_LOGIN",
        productSlug: req.product.slug,
        requestId: req.id,
        requestNumber: req.requestNumber,
      };
    }
    if (actor.userId !== req.userId && !actor.isStaff) {
      throw new ForbiddenError("This quotation belongs to a different account.");
    }
  } else if (
    actor?.userEmail &&
    actor.userEmail.toLowerCase() !== req.customerEmail.toLowerCase() &&
    !actor.isStaff
  ) {
    throw new ForbiddenError("This quotation is bound to a different customer email.");
  }

  const fallbackVariantId = req.variantId ?? req.product.variants[0]?.id;
  if (!fallbackVariantId) {
    return { state: "INVALID", productSlug: req.product.slug };
  }

  return {
    state: "VALID",
    tokenRecordId: tokenRow.id,
    requestId: req.id,
    requestNumber: req.requestNumber,
    productId: req.product.id,
    productName: req.product.name,
    productSlug: req.product.slug,
    productImageUrl: req.product.images[0]?.url ?? null,
    variantId: fallbackVariantId,
    lockedPriceBase: tokenRow.lockedPriceBase.toFixed(2),
    displayCurrency: req.displayCurrency,
    quoteExpiresAt: tokenRow.expiresAt.toISOString(),
    estimatedDeliveryDays: req.estimatedDeliveryDays,
    adminMessage: req.adminMessage,
    customerName: req.customerName,
    customerEmail: req.customerEmail,
    userId: req.userId,
    guestToken: req.guestToken,
    selections: Array.isArray(req.item?.selections)
      ? (req.item.selections as unknown as NormalizedCustomizationSelection[])
      : [],
  };
}

/**
 * Resolves an accepted quote directly by requestId (for logged-in / owning guest "Accept & Add to Bag" button)
 */
export async function resolveAcceptedRequestForBag(requestId: string, actor: ActorIdentity) {
  await expireStaleQuotesWhereNeeded();
  const req = await db.customizationRequest.findUnique({
    where: { id: requestId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          variants: {
            where: { isActive: true },
            orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
            take: 1,
            select: { id: true },
          },
        },
      },
      item: true,
    },
  });
  if (!req) throw new NotFoundError("Customization request not found.");
  assertCustomerOrGuestOwnership(actor, req, "customization:manage");

  if (req.status !== "ACCEPTED" || !req.quotedPriceBase) {
    throw new ConflictError("This customization request does not have an active quotation.");
  }
  if (req.quoteExpiresAt && req.quoteExpiresAt < new Date()) {
    throw new ConflictError("This quotation has expired. Please request a fresh quote.");
  }
  const variantId = req.variantId ?? req.product.variants[0]?.id;
  if (!variantId) {
    throw new ConflictError("No base SKU variant found for this customized piece.");
  }

  return {
    requestId: req.id,
    requestNumber: req.requestNumber,
    variantId,
    lockedPriceBase: req.quotedPriceBase.toFixed(2),
    selections: Array.isArray(req.item?.selections)
      ? (req.item.selections as unknown as NormalizedCustomizationSelection[])
      : [],
  };
}

export async function runCustomizationExpiryReminderJob(): Promise<{
  expiredCount: number;
  remindedCount: number;
}> {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const stale = await db.customizationRequest.findMany({
    where: { status: "ACCEPTED", quoteExpiresAt: { lt: now } },
    select: { id: true },
  });

  if (stale.length > 0) {
    await db.$transaction(async (tx) => {
      await Promise.all([
        tx.customizationRequest.updateMany({
          where: { id: { in: stale.map((s) => s.id) }, status: "ACCEPTED" },
          data: { status: "EXPIRED" },
        }),
        tx.customizationRequestEvent.createMany({
          data: stale.map((s) => ({
            requestId: s.id,
            fromStatus: "ACCEPTED",
            toStatus: "EXPIRED",
            eventType: "EXPIRED",
            actorRole: "SYSTEM",
            message: "Quotation expired after validity deadline.",
          })),
        }),
      ]);
    });
  }

  const expiringSoon = await db.customizationRequest.findMany({
    where: {
      status: "ACCEPTED",
      reminder24hSentAt: null,
      quoteExpiresAt: { gte: now, lte: in24Hours },
      quotedPriceBase: { not: null },
    },
    include: { product: { select: { name: true } } },
    take: 50,
  });

  const uniqueCurrencyCodes = Array.from(new Set(expiringSoon.map((req) => req.displayCurrency)));
  const currencyByCode = new Map(
    await Promise.all(
      uniqueCurrencyCodes.map(async (code) => {
        const { currency } = await resolveActiveCurrencyByCode(code);
        return [code, currency] as const;
      }),
    ),
  );

  const remindedIds: string[] = [];
  for (const req of expiringSoon) {
    const currency =
      currencyByCode.get(req.displayCurrency) ??
      (await resolveActiveCurrencyByCode(req.displayCurrency)).currency;
    const priceDisplay = formatPrice(req.quotedPriceBase!.toFixed(2), currency, { exact: true });
    const sent = await sendCustomizationQuoteExpiringEmail({
      requestId: req.id,
      customerEmail: req.customerEmail,
      customerName: req.customerName,
      requestNumber: req.requestNumber,
      productName: req.product.name,
      finalPriceDisplay: priceDisplay,
      expiresAtFormatted: req.quoteExpiresAt!.toUTCString().replace("GMT", "UTC"),
    });
    if (sent) {
      remindedIds.push(req.id);
    }
  }

  if (remindedIds.length > 0) {
    await db.customizationRequest.updateMany({
      where: { id: { in: remindedIds } },
      data: { reminder24hSentAt: now },
    });
  }

  return { expiredCount: stale.length, remindedCount: remindedIds.length };
}

export async function consumeQuoteTokenAndAddToBag(
  input: z.infer<typeof acceptQuoteAsOrderSchema>,
  actor: ActorIdentity,
) {
  const { addCustomizedQuoteToBag } = await import("@/modules/cart/cart.service");
  if (input.token) {
    const res = await resolveQuoteAcceptanceToken(input.token, actor);
    if (res.state !== "VALID") {
      throw new ConflictError(
        res.state === "EXPIRED"
          ? "This quotation link has expired."
          : res.state === "USED"
            ? "This quotation link has already been redeemed."
            : res.state === "REQUIRES_LOGIN"
              ? "Please sign in to your account to claim this quotation."
              : "Invalid or revoked quotation link.",
      );
    }

    await db.quoteToken.update({
      where: { id: res.tokenRecordId },
      data: { usedAt: new Date(), usedByUserId: actor.userId },
    });

    return addCustomizedQuoteToBag(
      { userId: actor.userId, guestToken: actor.guestToken },
      {
        requestId: res.requestId,
        requestNumber: res.requestNumber,
        variantId: res.variantId,
        lockedPriceBase: res.lockedPriceBase,
        selections: res.selections,
      },
    );
  }

  if (!input.requestId) {
    throw new ValidationError("Missing quote token or request ID.");
  }

  const resolved = await resolveAcceptedRequestForBag(input.requestId, actor);
  return addCustomizedQuoteToBag({ userId: actor.userId, guestToken: actor.guestToken }, resolved);
}
