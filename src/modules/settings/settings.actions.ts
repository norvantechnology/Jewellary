"use server";

import { revalidateTag, updateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import {
  deleteShippingZoneSchema,
  shippingZoneSchema,
  updateStoreSettingsSchema,
} from "@/modules/settings/settings.schemas";
import { normalizeTaxDecimal } from "@/modules/settings/settings.service";
import { CACHE_TAGS } from "@/server/cache-tags";
import { createAction } from "@/server/create-action";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

export const updateStoreSettingsAction = createAction(
  {
    name: "settings.update",
    schema: updateStoreSettingsSchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SETTINGS_UPDATE",
      entityType: "StoreSetting",
      entityId: () => "default",
    },
  },
  async (input) => {
    const taxRate = normalizeTaxDecimal(input.taxRatePercent);
    const hasPhysicalAddress = Boolean(
      input.physicalStore?.name || input.physicalStore?.streetAddress,
    );

    const updated = await db.storeSetting.upsert({
      where: { id: "default" },
      update: {
        storeName: input.storeName,
        tagline: input.tagline || null,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone || null,
        supportHours: input.supportHours || null,
        currency: input.currency,
        defaultCountry: input.defaultCountry,
        supportedCountries: input.supportedCountries,
        taxRate,
        taxLabel: input.taxLabel,
        taxInclusive: input.taxInclusive,
        freeShippingThreshold: input.freeShippingThreshold
          ? new Prisma.Decimal(input.freeShippingThreshold)
          : null,
        signatureThreshold: new Prisma.Decimal(input.signatureThreshold),
        returnWindowDays: input.returnWindowDays,
        announcementBarEnabled: input.announcementBarEnabled,
        announcementBarText: input.announcementBarText || null,
        announcementBarHref: input.announcementBarHref || null,
        logoUrl: input.logoUrl || null,
        allowAiCrawlers: input.allowAiCrawlers,
        requireAdminTwoFactor: input.requireAdminTwoFactor,
        seoDefaultTitlePattern: input.seoDefaultTitlePattern || null,
        seoDefaultDescription: input.seoDefaultDescription || null,
        defaultOgImageUrl: input.defaultOgImageUrl || null,
        socialLinks: input.socialLinks ?? [],
        physicalStore: hasPhysicalAddress
          ? (input.physicalStore ?? Prisma.JsonNull)
          : Prisma.JsonNull,
      },
      create: {
        id: "default",
        storeName: input.storeName,
        tagline: input.tagline || null,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone || null,
        supportHours: input.supportHours || null,
        currency: input.currency,
        defaultCountry: input.defaultCountry,
        supportedCountries: input.supportedCountries,
        taxRate,
        taxLabel: input.taxLabel,
        taxInclusive: input.taxInclusive,
        freeShippingThreshold: input.freeShippingThreshold
          ? new Prisma.Decimal(input.freeShippingThreshold)
          : null,
        signatureThreshold: new Prisma.Decimal(input.signatureThreshold),
        returnWindowDays: input.returnWindowDays,
        announcementBarEnabled: input.announcementBarEnabled,
        announcementBarText: input.announcementBarText || null,
        announcementBarHref: input.announcementBarHref || null,
        logoUrl: input.logoUrl || null,
        allowAiCrawlers: input.allowAiCrawlers,
        requireAdminTwoFactor: input.requireAdminTwoFactor,
        seoDefaultTitlePattern: input.seoDefaultTitlePattern || null,
        seoDefaultDescription: input.seoDefaultDescription || null,
        defaultOgImageUrl: input.defaultOgImageUrl || null,
        socialLinks: input.socialLinks ?? [],
        physicalStore: hasPhysicalAddress
          ? (input.physicalStore ?? Prisma.JsonNull)
          : Prisma.JsonNull,
      },
    });

    updateTag(CACHE_TAGS.settings);
    revalidateTag(CACHE_TAGS.settings, "max");

    return { id: updated.id, storeName: updated.storeName };
  },
);

export const upsertShippingZoneAction = createAction(
  {
    name: "shippingZone.upsert",
    schema: shippingZoneSchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SHIPPING_ZONE_UPSERT",
      entityType: "ShippingZone",
      entityId: (_input, res: { id: string }) => res.id,
    },
  },
  async (input) => {
    const payload = {
      name: input.name,
      countries: input.countries,
      flatRate: new Prisma.Decimal(input.flatRate),
      freeThreshold: input.freeThreshold ? new Prisma.Decimal(input.freeThreshold) : null,
      estimatedDaysMin: input.estimatedDaysMin,
      estimatedDaysMax: input.estimatedDaysMax,
      isInsured: input.isInsured,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    };

    const zone = input.id
      ? await db.shippingZone.update({ where: { id: input.id }, data: payload })
      : await db.shippingZone.create({ data: payload });

    updateTag(CACHE_TAGS.shipping);
    revalidateTag(CACHE_TAGS.shipping, "max");

    return { id: zone.id, name: zone.name };
  },
);

export const deleteShippingZoneAction = createAction(
  {
    name: "shippingZone.delete",
    schema: deleteShippingZoneSchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SHIPPING_ZONE_DELETE",
      entityType: "ShippingZone",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    const existing = await db.shippingZone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Shipping zone not found.");

    await db.shippingZone.delete({ where: { id } });
    updateTag(CACHE_TAGS.shipping);
    revalidateTag(CACHE_TAGS.shipping, "max");
    return { id };
  },
);
