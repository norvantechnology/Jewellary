import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { Prisma } from "@/generated/prisma/client";
import {
  CUSTOMIZATION_CATEGORY_PRESETS,
  type CustomizationPresetKey,
} from "@/modules/customization/customization.presets";
import { createPrismaClient } from "@/server/prisma-client";
import { ensureSeedImageAsset } from "./seed-assets";

const prisma = createPrismaClient();

async function ensureUserWithPassword(input: {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
}) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: input.name,
      role: input.role,
      emailVerified: true,
      banned: false,
    },
    create: {
      id: input.id,
      name: input.name,
      email,
      role: input.role,
      emailVerified: true,
    },
  });

  const accountId = `${user.id}_credential`;
  await prisma.account.upsert({
    where: { id: accountId },
    update: { password: passwordHash },
    create: {
      id: accountId,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: passwordHash,
    },
  });

  return user;
}

async function seedProductionBaseline() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Atelier Fine Jewellery";
  const contactEmail = process.env.EMAIL_FROM || "concierge@example.com";

  await prisma.storeSetting.upsert({
    where: { id: "default" },
    update: {
      storeName: siteName,
      contactEmail,
    },
    create: {
      id: "default",
      storeName: siteName,
      tagline: "Architectural Fine Jewellery & Independently Graded Diamonds",
      contactEmail,
      contactPhone: "+1 (212) 555-0184",
      supportHours: "Monday – Saturday, 10:00 – 19:00 EST",
      currency: "USD",
      defaultCountry: "US",
      supportedCountries: ["US", "CA", "GB", "AU", "IN"],
      taxRate: new Prisma.Decimal("0.0800"),
      taxLabel: "Estimated Tax",
      taxInclusive: false,
      freeShippingThreshold: new Prisma.Decimal("1000.00"),
      signatureThreshold: new Prisma.Decimal("500.00"),
      returnWindowDays: 30,
      announcementBarEnabled: true,
      announcementBarText: "Complimentary insured express delivery on orders above $1,000",
      announcementBarHref: "/shipping-returns",
      allowAiCrawlers: true,
      seoDefaultTitlePattern: `%s | ${siteName}`,
      seoDefaultDescription:
        "Certified GIA diamonds, bespoke engagement rings, and 18K recycled gold heirlooms crafted with documented provenance and insured express delivery.",
      socialLinks: [
        { label: "Instagram", href: "https://instagram.com/maisonaurelia" },
        { label: "Pinterest", href: "https://pinterest.com/maisonaurelia" },
      ],
    },
  });

  const existingDefaultCurrency = await prisma.currency.findFirst({
    where: { isDefault: true },
    select: { id: true },
  });

  const initialCurrencies: Array<{
    id: string;
    code: string;
    name: string;
    symbol: string;
    symbolPosition: "BEFORE" | "AFTER";
    decimalPlaces: number;
    roundingRule: "HALF_UP" | "HALF_EVEN" | "CEIL" | "FLOOR" | "NONE";
    exchangeRate: string;
    isActive: boolean;
    isDefault: boolean;
    isBase: boolean;
    sortOrder: number;
  }> = [
    {
      id: "curr_base_usd",
      code: "USD",
      name: "US Dollar",
      symbol: "$",
      symbolPosition: "BEFORE",
      decimalPlaces: 2,
      roundingRule: "HALF_UP",
      exchangeRate: "1.00000000",
      isActive: true,
      isDefault: !existingDefaultCurrency,
      isBase: true,
      sortOrder: 0,
    },
    {
      id: "curr_eur",
      code: "EUR",
      name: "Euro",
      symbol: "€",
      symbolPosition: "BEFORE",
      decimalPlaces: 2,
      roundingRule: "HALF_UP",
      exchangeRate: "0.92000000",
      isActive: true,
      isDefault: false,
      isBase: false,
      sortOrder: 1,
    },
    {
      id: "curr_gbp",
      code: "GBP",
      name: "British Pound",
      symbol: "£",
      symbolPosition: "BEFORE",
      decimalPlaces: 2,
      roundingRule: "HALF_UP",
      exchangeRate: "0.79000000",
      isActive: true,
      isDefault: false,
      isBase: false,
      sortOrder: 2,
    },
    {
      id: "curr_cad",
      code: "CAD",
      name: "Canadian Dollar",
      symbol: "CA$",
      symbolPosition: "BEFORE",
      decimalPlaces: 2,
      roundingRule: "HALF_UP",
      exchangeRate: "1.38000000",
      isActive: true,
      isDefault: false,
      isBase: false,
      sortOrder: 3,
    },
    {
      id: "curr_aud",
      code: "AUD",
      name: "Australian Dollar",
      symbol: "A$",
      symbolPosition: "BEFORE",
      decimalPlaces: 2,
      roundingRule: "HALF_UP",
      exchangeRate: "1.52000000",
      isActive: true,
      isDefault: false,
      isBase: false,
      sortOrder: 4,
    },
    {
      id: "curr_chf",
      code: "CHF",
      name: "Swiss Franc",
      symbol: "CHF ",
      symbolPosition: "BEFORE",
      decimalPlaces: 2,
      roundingRule: "HALF_UP",
      exchangeRate: "0.88000000",
      isActive: true,
      isDefault: false,
      isBase: false,
      sortOrder: 5,
    },
    {
      id: "curr_jpy",
      code: "JPY",
      name: "Japanese Yen",
      symbol: "¥",
      symbolPosition: "BEFORE",
      decimalPlaces: 0,
      roundingRule: "HALF_UP",
      exchangeRate: "152.00000000",
      isActive: true,
      isDefault: false,
      isBase: false,
      sortOrder: 6,
    },
    {
      id: "curr_inr",
      code: "INR",
      name: "Indian Rupee",
      symbol: "₹",
      symbolPosition: "BEFORE",
      decimalPlaces: 2,
      roundingRule: "HALF_UP",
      exchangeRate: "84.20000000",
      isActive: true,
      isDefault: false,
      isBase: false,
      sortOrder: 7,
    },
    {
      id: "curr_aed",
      code: "AED",
      name: "UAE Dirham",
      symbol: "د.إ ",
      symbolPosition: "BEFORE",
      decimalPlaces: 2,
      roundingRule: "HALF_UP",
      exchangeRate: "3.67250000",
      isActive: true,
      isDefault: false,
      isBase: false,
      sortOrder: 8,
    },
    {
      id: "curr_kwd",
      code: "KWD",
      name: "Kuwaiti Dinar",
      symbol: "KD ",
      symbolPosition: "BEFORE",
      decimalPlaces: 3,
      roundingRule: "HALF_UP",
      exchangeRate: "0.30700000",
      isActive: true,
      isDefault: false,
      isBase: false,
      sortOrder: 9,
    },
  ];

  for (const item of initialCurrencies) {
    await prisma.currency.upsert({
      where: { code: item.code },
      update: {},
      create: {
        id: item.id,
        code: item.code,
        name: item.name,
        symbol: item.symbol,
        symbolPosition: item.symbolPosition,
        decimalPlaces: item.decimalPlaces,
        roundingRule: item.roundingRule,
        exchangeRate: new Prisma.Decimal(item.exchangeRate),
        isActive: item.isActive,
        isDefault: item.isDefault,
        isBase: item.isBase,
        sortOrder: item.sortOrder,
      },
    });
  }

  await prisma.shippingZone.upsert({
    where: { id: "zone-us-domestic" },
    update: {},
    create: {
      id: "zone-us-domestic",
      name: "Insured Domestic Express (US)",
      countries: ["US"],
      flatRate: new Prisma.Decimal("25.00"),
      freeThreshold: new Prisma.Decimal("1000.00"),
      estimatedDaysMin: 2,
      estimatedDaysMax: 4,
      isInsured: true,
      isActive: true,
      sortOrder: 1,
    },
  });

  await prisma.shippingZone.upsert({
    where: { id: "zone-intl-express" },
    update: {},
    create: {
      id: "zone-intl-express",
      name: "Insured International Courier",
      countries: ["CA", "GB", "AU", "IN"],
      flatRate: new Prisma.Decimal("55.00"),
      freeThreshold: new Prisma.Decimal("2000.00"),
      estimatedDaysMin: 4,
      estimatedDaysMax: 7,
      isInsured: true,
      isActive: true,
      sortOrder: 2,
    },
  });

  const adminEmail = process.env.ADMIN_SEED_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "AdminChangeMe123!";
  const adminName = process.env.ADMIN_SEED_NAME || "Atelier Director";

  await ensureUserWithPassword({
    id: "seed-admin-user",
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: "ADMIN",
  });

  // Base categories (parent + sub-collections)
  const rings = await prisma.category.upsert({
    where: { slug: "rings" },
    update: {},
    create: {
      name: "Rings",
      slug: "rings",
      path: "rings",
      description:
        "Architectural solitaires, pavé wedding bands, and sapphire statement rings forged in 18K gold and platinum.",
      sortOrder: 1,
      isActive: true,
      seoTitle: "Fine Rings & Solitaires",
      seoDescription:
        "Discover handcrafted 18K gold and platinum rings featuring GIA-graded natural and lab-grown diamonds.",
    },
  });

  const engagementRings = await prisma.category.upsert({
    where: { slug: "engagement-rings" },
    update: {},
    create: {
      name: "Engagement Rings",
      slug: "engagement-rings",
      path: "rings/engagement-rings",
      parentId: rings.id,
      description:
        "Individually selected center diamonds set in low-profile cathedral, solitaire, and halo gallery mounts.",
      sortOrder: 1,
      isActive: true,
      seoTitle: "Engagement Rings — Solitaire, Oval & Emerald Cut",
      seoDescription:
        "Explore GIA-certified solitaire, oval halo, and emerald-cut engagement rings crafted in 18K gold and 950 platinum.",
    },
  });

  const weddingBands = await prisma.category.upsert({
    where: { slug: "wedding-bands" },
    update: {},
    create: {
      name: "Wedding Bands",
      slug: "wedding-bands",
      path: "rings/wedding-bands",
      parentId: rings.id,
      description:
        "Precision-milled court bands, French-cut pavé eternity rings, and contoured bridal companions.",
      sortOrder: 2,
      isActive: true,
      seoTitle: "Wedding & Eternity Bands",
      seoDescription:
        "Half-eternity diamond bands and comfort-fit gold wedding rings designed to sit flush alongside solitaire settings.",
    },
  });

  const necklaces = await prisma.category.upsert({
    where: { slug: "necklaces" },
    update: {},
    create: {
      name: "Necklaces",
      slug: "necklaces",
      path: "necklaces",
      description:
        "Graduated diamond tennis colliers and luminous floating pendants crafted in solid 18K gold.",
      sortOrder: 2,
      isActive: true,
      seoTitle: "Fine Necklaces & Pendants",
      seoDescription:
        "Minimalist diamond pendants and articulated tennis necklaces set in recycled 18K gold.",
    },
  });

  const pendants = await prisma.category.upsert({
    where: { slug: "pendants" },
    update: {},
    create: {
      name: "Diamond Pendants",
      slug: "pendants",
      path: "necklaces/pendants",
      parentId: necklaces.id,
      description: "Solitaire bezel and prong pendants suspended on delicate cable chains.",
      sortOrder: 1,
      isActive: true,
    },
  });

  const earrings = await prisma.category.upsert({
    where: { slug: "earrings" },
    update: {},
    create: {
      name: "Earrings",
      slug: "earrings",
      path: "earrings",
      description: "Matched diamond studs, sculptural huggie hoops, and articulated drop earrings.",
      sortOrder: 3,
      isActive: true,
      seoTitle: "Diamond Studs & Gold Earrings",
      seoDescription:
        "Matched GIA-certified diamond stud earrings and solid 18K gold huggie hoops.",
    },
  });

  const bracelets = await prisma.category.upsert({
    where: { slug: "bracelets" },
    update: {},
    create: {
      name: "Bracelets",
      slug: "bracelets",
      path: "bracelets",
      description:
        "Supple hinged bangles and low-set diamond tennis bracelets with double-safety box clasps.",
      sortOrder: 4,
      isActive: true,
      seoTitle: "Fine Bracelets & Tennis Silhouettes",
      seoDescription: "Hand-set diamond tennis bracelets and solid gold architectural bangles.",
    },
  });

  // Facets & Options
  const facetSpecs: Array<{
    code: string;
    name: string;
    valueType: "TEXT" | "NUMBER" | "BOOLEAN" | "RANGE";
    unit?: string;
    sortOrder: number;
    options: Array<{ value: string; label: string; swatchHex?: string }>;
  }> = [
    {
      code: "metal",
      name: "Precious Metal",
      valueType: "TEXT",
      sortOrder: 1,
      options: [
        { value: "18k-yellow-gold", label: "18K Yellow Gold", swatchHex: "#D4B16A" },
        { value: "18k-white-gold", label: "18K White Gold", swatchHex: "#DDD8CE" },
        { value: "18k-rose-gold", label: "18K Rose Gold", swatchHex: "#D6A38C" },
        { value: "950-platinum", label: "950 Platinum", swatchHex: "#C9C5BD" },
      ],
    },
    {
      code: "stone_shape",
      name: "Diamond Shape",
      valueType: "TEXT",
      sortOrder: 2,
      options: [
        { value: "round", label: "Round Brilliant" },
        { value: "oval", label: "Oval" },
        { value: "emerald", label: "Emerald Step Cut" },
        { value: "cushion", label: "Cushion" },
        { value: "pear", label: "Pear" },
      ],
    },
    {
      code: "stone_origin",
      name: "Stone Origin",
      valueType: "TEXT",
      sortOrder: 3,
      options: [
        { value: "natural", label: "Natural Mined Diamond" },
        { value: "lab-grown", label: "Lab-Grown Diamond" },
      ],
    },
    {
      code: "certification",
      name: "Certification Lab",
      valueType: "TEXT",
      sortOrder: 4,
      options: [
        { value: "gia", label: "GIA Certified" },
        { value: "igi", label: "IGI Certified" },
      ],
    },
  ];

  const facetByCode = new Map<
    string,
    { id: string; options: Map<string, { id: string; label: string }> }
  >();

  for (const spec of facetSpecs) {
    const facet = await prisma.facet.upsert({
      where: { code: spec.code },
      update: { name: spec.name, sortOrder: spec.sortOrder },
      create: {
        code: spec.code,
        name: spec.name,
        valueType: spec.valueType,
        unit: spec.unit,
        sortOrder: spec.sortOrder,
      },
    });

    const optionMap = new Map<string, { id: string; label: string }>();
    for (let idx = 0; idx < spec.options.length; idx++) {
      const opt = spec.options[idx]!;
      const savedOpt = await prisma.facetOption.upsert({
        where: { facetId_value: { facetId: facet.id, value: opt.value } },
        update: { label: opt.label, swatchHex: opt.swatchHex ?? null, sortOrder: idx + 1 },
        create: {
          facetId: facet.id,
          value: opt.value,
          label: opt.label,
          swatchHex: opt.swatchHex ?? null,
          sortOrder: idx + 1,
        },
      });
      optionMap.set(opt.value, { id: savedOpt.id, label: savedOpt.label });
    }
    facetByCode.set(spec.code, { id: facet.id, options: optionMap });
  }

  // Seed default category customization option templates (idempotent: only when category has 0 groups)
  const categoryPresetBindings: Array<{ categoryId: string; key: CustomizationPresetKey }> = [
    { categoryId: rings.id, key: "rings" },
    { categoryId: engagementRings.id, key: "rings" },
    { categoryId: weddingBands.id, key: "rings" },
    { categoryId: necklaces.id, key: "necklaces" },
    { categoryId: pendants.id, key: "necklaces" },
    { categoryId: earrings.id, key: "earrings" },
    { categoryId: bracelets.id, key: "bracelets" },
  ];

  for (const binding of categoryPresetBindings) {
    const existingGroupCount = await prisma.customizationOptionGroup.count({
      where: { categoryId: binding.categoryId },
    });
    if (existingGroupCount > 0) continue;

    const groups = CUSTOMIZATION_CATEGORY_PRESETS[binding.key];
    for (const group of groups) {
      await prisma.customizationOptionGroup.create({
        data: {
          categoryId: binding.categoryId,
          code: group.code,
          label: group.label,
          type: group.type,
          helperText: group.helperText ?? null,
          placeholder: group.placeholder ?? null,
          required: group.required,
          minValue: group.minValue ? new Prisma.Decimal(group.minValue) : null,
          maxValue: group.maxValue ? new Prisma.Decimal(group.maxValue) : null,
          stepValue: group.stepValue ? new Prisma.Decimal(group.stepValue) : null,
          defaultValue: group.defaultValue ?? null,
          maxLength: group.maxLength ?? null,
          maxFiles: group.maxFiles ?? null,
          unit: group.unit ?? null,
          validationRules: group.validationRules
            ? (group.validationRules as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          isActive: group.isActive,
          sortOrder: group.sortOrder,
          values: {
            create: group.values.map((val) => ({
              value: val.value,
              label: val.label,
              swatchHex: val.swatchHex ?? null,
              swatchImageUrl: val.swatchImageUrl ?? null,
              priceAdjustmentType: val.priceAdjustmentType,
              priceAdjustmentValue: new Prisma.Decimal(val.priceAdjustmentValue),
              isAvailable: val.isAvailable,
              sortOrder: val.sortOrder,
            })),
          },
        },
      });
    }
  }

  // Seed default concierge canned replies (idempotent)
  const cannedRepliesSeed = [
    {
      id: "canned-greeting",
      title: "Atelier Greeting & Bespoke Timeline",
      category: "General",
      body: "Bonjour from Maison Aurelia. Our master bench jewelers craft bespoke commissions within 3–4 weeks from final CAD approval. Would you like me to guide you through metal or stone proportions for your piece?",
      sortOrder: 0,
    },
    {
      id: "canned-sizing",
      title: "Ring Sizing & Complimentary Resizing",
      category: "Sizing",
      body: "All bespoke and fine rings include one complimentary resize within 60 days of delivery. If you are selecting as a surprise, our atelier recommends standard size 6 (US) / L½ (UK) / 52 (EU).",
      sortOrder: 1,
    },
    {
      id: "canned-dossier",
      title: "GIA / IGI Dossier & Stone Viewing",
      category: "Diamonds",
      body: "Our gemologists hand-curate every diamond above 0.50 ct with original GIA or IGI laboratory dossiers and laser-inscribed girdles. I can share macro bench imagery or alternative stone pairings upon request.",
      sortOrder: 2,
    },
    {
      id: "canned-quote-walkthrough",
      title: "Reviewing Your Bespoke Quote",
      category: "Customization",
      body: "Your official atelier quotation locks pricing and gold-smithing allocation for 7 days. Once approved, simply follow your secure quotation link or accept directly inside your Customization Requests portal.",
      sortOrder: 3,
    },
    {
      id: "canned-delivery",
      title: "Insured White-Glove Courier Dispatch",
      category: "Shipping",
      body: "Every Maison Aurelia creation dispatches via insured armoured courier with adult signature verification and tamper-sealed presentation packaging.",
      sortOrder: 4,
    },
  ];

  for (const tpl of cannedRepliesSeed) {
    await prisma.chatCannedReply.upsert({
      where: { id: tpl.id },
      update: {
        title: tpl.title,
        category: tpl.category,
        body: tpl.body,
        sortOrder: tpl.sortOrder,
        isActive: true,
      },
      create: {
        id: tpl.id,
        title: tpl.title,
        category: tpl.category,
        body: tpl.body,
        sortOrder: tpl.sortOrder,
        isActive: true,
      },
    });
  }

  return {
    categories: {
      rings,
      engagementRings,
      weddingBands,
      necklaces,
      pendants,
      earrings,
      bracelets,
    },
    facets: facetByCode,
    siteName,
  };
}

async function seedDemoCatalogue(ctx: Awaited<ReturnType<typeof seedProductionBaseline>>) {
  await ensureUserWithPassword({
    id: "seed-staff-user",
    name: "Atelier Curator",
    email: "staff@example.com",
    password: "StaffDemoPass123!",
    role: "STAFF",
  });

  const demoCustomer = await ensureUserWithPassword({
    id: "seed-customer-user",
    name: "Claire Laurent",
    email: "claire@example.com",
    password: "CustomerDemoPass123!",
    role: "CUSTOMER",
  });

  await prisma.address.upsert({
    where: { id: "seed-addr-claire-ny" },
    update: {},
    create: {
      id: "seed-addr-claire-ny",
      userId: demoCustomer.id,
      label: "Primary Residence",
      fullName: "Claire Laurent",
      phone: "+1 212 555 0140",
      line1: "412 Mercer Street, Apt 6B",
      city: "New York",
      state: "NY",
      postalCode: "10013",
      country: "US",
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
  });

  const { categories, facets } = ctx;

  // Bind facets to categories
  const categoryFacetMatrix: Array<{ catId: string; codes: string[] }> = [
    {
      catId: categories.rings.id,
      codes: ["metal", "stone_shape", "stone_origin", "certification"],
    },
    {
      catId: categories.engagementRings.id,
      codes: ["metal", "stone_shape", "stone_origin", "certification"],
    },
    { catId: categories.weddingBands.id, codes: ["metal", "stone_origin"] },
    { catId: categories.necklaces.id, codes: ["metal", "stone_shape", "stone_origin"] },
    {
      catId: categories.pendants.id,
      codes: ["metal", "stone_shape", "stone_origin", "certification"],
    },
    { catId: categories.earrings.id, codes: ["metal", "stone_shape", "stone_origin"] },
    { catId: categories.bracelets.id, codes: ["metal", "stone_origin"] },
  ];

  for (const row of categoryFacetMatrix) {
    for (let i = 0; i < row.codes.length; i++) {
      const f = facets.get(row.codes[i]!);
      if (!f) continue;
      await prisma.categoryFacet.upsert({
        where: { categoryId_facetId: { categoryId: row.catId, facetId: f.id } },
        update: { sortOrder: i + 1 },
        create: { categoryId: row.catId, facetId: f.id, sortOrder: i + 1 },
      });
    }
  }

  const productsSeed: Array<{
    sku: string;
    name: string;
    slug: string;
    categoryId: string;
    subtitle: string;
    description: string;
    priceMode: "FIXED" | "PRICE_ON_REQUEST";
    basePrice: string;
    compareAtPrice?: string;
    metalType: string;
    metalFacetVal: string;
    metalColor: string;
    metalPurity: string;
    metalWeightGrams: string;
    stoneOrigin?: string;
    stoneOriginFacetVal?: string;
    stoneShape?: string;
    stoneShapeFacetVal?: string;
    caratTotal?: string;
    caratCenter?: string;
    colorGrade?: string;
    clarityGrade?: string;
    cutGrade?: string;
    certificationLab?: string;
    certFacetVal?: string;
    certificateNumber?: string;
    hasSizing?: boolean;
    isFeatured?: boolean;
    isNewArrival?: boolean;
    isBestseller?: boolean;
    motif: "solitaire" | "band" | "pendant" | "earrings" | "bracelet";
    altText: string;
    variants: Array<{
      sku: string;
      title: string;
      size?: string;
      metal: string;
      stockQty: number;
      priceOverride?: string;
      isDefault?: boolean;
    }>;
  }> = [
    {
      sku: "AUR-SOL-150",
      name: "Celeste Cathedral Solitaire Ring",
      slug: "celeste-cathedral-solitaire-ring",
      categoryId: categories.engagementRings.id,
      subtitle: "1.50 ct GIA Round Brilliant in 18K Yellow Gold",
      description:
        "Sculpted six-claw tulip gallery elevating a hand-matched 1.50 carat round brilliant diamond so light enters from every angle while sitting flush against a wedding band.",
      priceMode: "FIXED",
      basePrice: "6850.00",
      compareAtPrice: "7400.00",
      metalType: "18K Yellow Gold",
      metalFacetVal: "18k-yellow-gold",
      metalColor: "Yellow",
      metalPurity: "750",
      metalWeightGrams: "4.10",
      stoneOrigin: "Natural Mined Diamond",
      stoneOriginFacetVal: "natural",
      stoneShape: "Round Brilliant",
      stoneShapeFacetVal: "round",
      caratTotal: "1.50",
      caratCenter: "1.50",
      colorGrade: "E",
      clarityGrade: "VS1",
      cutGrade: "Ideal",
      certificationLab: "GIA",
      certFacetVal: "gia",
      certificateNumber: "GIA-2489103847",
      hasSizing: true,
      isFeatured: true,
      isBestseller: true,
      motif: "solitaire",
      altText:
        "Celeste Cathedral Solitaire engagement ring with round brilliant diamond in polished 18K yellow gold on warm ivory stone",
      variants: [
        {
          sku: "AUR-SOL-150-5",
          title: "Size 5 / 18K Yellow Gold",
          size: "5",
          metal: "18K Yellow Gold",
          stockQty: 3,
          isDefault: true,
        },
        {
          sku: "AUR-SOL-150-6",
          title: "Size 6 / 18K Yellow Gold",
          size: "6",
          metal: "18K Yellow Gold",
          stockQty: 4,
        },
        {
          sku: "AUR-SOL-150-7",
          title: "Size 7 / 18K Yellow Gold",
          size: "7",
          metal: "18K Yellow Gold",
          stockQty: 2,
        },
        {
          sku: "AUR-SOL-150-PT-6",
          title: "Size 6 / 950 Platinum",
          size: "6",
          metal: "950 Platinum",
          stockQty: 2,
          priceOverride: "7150.00",
        },
      ],
    },
    {
      sku: "AUR-OVL-205",
      name: "Lumière Oval Halo Ring",
      slug: "lumiere-oval-halo-ring",
      categoryId: categories.engagementRings.id,
      subtitle: "2.05 ct Total GIA Oval Diamond in 950 Platinum",
      description:
        "An elongated oval center diamond framed by scalloped micro-pavé melee diamonds set down the knife-edge shank for luminous scintillation.",
      priceMode: "FIXED",
      basePrice: "11400.00",
      metalType: "950 Platinum",
      metalFacetVal: "950-platinum",
      metalColor: "White",
      metalPurity: "950",
      metalWeightGrams: "5.20",
      stoneOrigin: "Natural Mined Diamond",
      stoneOriginFacetVal: "natural",
      stoneShape: "Oval",
      stoneShapeFacetVal: "oval",
      caratTotal: "2.05",
      caratCenter: "1.75",
      colorGrade: "D",
      clarityGrade: "VVS2",
      cutGrade: "Excellent",
      certificationLab: "GIA",
      certFacetVal: "gia",
      certificateNumber: "GIA-6490218493",
      hasSizing: true,
      isFeatured: true,
      isNewArrival: true,
      motif: "solitaire",
      altText:
        "Lumière oval diamond halo engagement ring handcrafted in 950 platinum showing fine pavé shoulder setting",
      variants: [
        {
          sku: "AUR-OVL-205-5",
          title: "Size 5 / 950 Platinum",
          size: "5",
          metal: "950 Platinum",
          stockQty: 1,
          isDefault: true,
        },
        {
          sku: "AUR-OVL-205-6",
          title: "Size 6 / 950 Platinum",
          size: "6",
          metal: "950 Platinum",
          stockQty: 2,
        },
      ],
    },
    {
      sku: "AUR-EMR-180",
      name: "Versailles Step-Cut Emerald Ring",
      slug: "versailles-step-cut-emerald-ring",
      categoryId: categories.engagementRings.id,
      subtitle: "1.80 ct IGI Lab-Grown Emerald Cut in 18K White Gold",
      description:
        "Architectural emerald-cut center stone flanked by tapered baguettes in hand-finished white gold talons, showcasing hall-of-mirrors clarity.",
      priceMode: "FIXED",
      basePrice: "4950.00",
      metalType: "18K White Gold",
      metalFacetVal: "18k-white-gold",
      metalColor: "White",
      metalPurity: "750",
      metalWeightGrams: "4.65",
      stoneOrigin: "Lab-Grown Diamond",
      stoneOriginFacetVal: "lab-grown",
      stoneShape: "Emerald Step Cut",
      stoneShapeFacetVal: "emerald",
      caratTotal: "2.10",
      caratCenter: "1.80",
      colorGrade: "E",
      clarityGrade: "VVS1",
      cutGrade: "Ideal",
      certificationLab: "IGI",
      certFacetVal: "igi",
      certificateNumber: "IGI-LG619482750",
      hasSizing: true,
      isNewArrival: true,
      isBestseller: true,
      motif: "solitaire",
      altText:
        "Versailles emerald-cut diamond engagement ring flanked by tapered baguettes in 18K white gold",
      variants: [
        {
          sku: "AUR-EMR-180-6",
          title: "Size 6 / 18K White Gold",
          size: "6",
          metal: "18K White Gold",
          stockQty: 5,
          isDefault: true,
        },
        {
          sku: "AUR-EMR-180-7",
          title: "Size 7 / 18K White Gold",
          size: "7",
          metal: "18K White Gold",
          stockQty: 4,
        },
      ],
    },
    {
      sku: "AUR-CSH-400",
      name: "Sovereign Atelier High Jewellery Cushion Ring",
      slug: "sovereign-atelier-high-jewellery-cushion-ring",
      categoryId: categories.engagementRings.id,
      subtitle: "4.02 ct Type IIa GIA Cushion Diamond — Price Upon Request",
      description:
        "One-of-one antique-proportioned cushion diamond accompanied by original GIA Type IIa dossier and private concierge viewing.",
      priceMode: "PRICE_ON_REQUEST",
      basePrice: "0.00",
      metalType: "950 Platinum",
      metalFacetVal: "950-platinum",
      metalColor: "White",
      metalPurity: "950",
      metalWeightGrams: "6.40",
      stoneOrigin: "Natural Mined Diamond",
      stoneOriginFacetVal: "natural",
      stoneShape: "Cushion",
      stoneShapeFacetVal: "cushion",
      caratTotal: "4.02",
      caratCenter: "4.02",
      colorGrade: "D",
      clarityGrade: "IF",
      cutGrade: "Ideal",
      certificationLab: "GIA",
      certFacetVal: "gia",
      certificateNumber: "GIA-1198374620",
      hasSizing: true,
      isFeatured: true,
      motif: "solitaire",
      altText:
        "Sovereign 4.02 carat Type IIa cushion diamond ring hand-forged in 950 platinum for private viewing",
      variants: [
        {
          sku: "AUR-CSH-400-ONREQ",
          title: "Bespoke Fit / 950 Platinum",
          size: "6",
          metal: "950 Platinum",
          stockQty: 1,
          isDefault: true,
        },
      ],
    },
    {
      sku: "AUR-BND-FRN",
      name: "Rivoli French-Pavé Eternity Band",
      slug: "rivoli-french-pave-eternity-band",
      categoryId: categories.weddingBands.id,
      subtitle: "0.85 ctw Natural Diamonds in 18K Yellow Gold",
      description:
        "Three-quarter eternity wedding band with minimal metal visibility and precision U-cut galleries for daily wear.",
      priceMode: "FIXED",
      basePrice: "2250.00",
      metalType: "18K Yellow Gold",
      metalFacetVal: "18k-yellow-gold",
      metalColor: "Yellow",
      metalPurity: "750",
      metalWeightGrams: "2.90",
      stoneOrigin: "Natural Mined Diamond",
      stoneOriginFacetVal: "natural",
      stoneShape: "Round Brilliant",
      stoneShapeFacetVal: "round",
      caratTotal: "0.85",
      colorGrade: "F",
      clarityGrade: "VS1",
      cutGrade: "Excellent",
      hasSizing: true,
      isBestseller: true,
      motif: "band",
      altText: "Rivoli French-pavé diamond three-quarter eternity band in 18K yellow gold",
      variants: [
        {
          sku: "AUR-BND-FRN-5",
          title: "Size 5 / 18K Yellow Gold",
          size: "5",
          metal: "18K Yellow Gold",
          stockQty: 8,
          isDefault: true,
        },
        {
          sku: "AUR-BND-FRN-6",
          title: "Size 6 / 18K Yellow Gold",
          size: "6",
          metal: "18K Yellow Gold",
          stockQty: 6,
        },
        {
          sku: "AUR-BND-FRN-RG-6",
          title: "Size 6 / 18K Rose Gold",
          size: "6",
          metal: "18K Rose Gold",
          stockQty: 4,
        },
      ],
    },
    {
      sku: "AUR-BND-CRT",
      name: "Marais Heavy Court Band 4mm",
      slug: "marais-heavy-court-band-4mm",
      categoryId: categories.weddingBands.id,
      subtitle: "Solid Recycled 18K Rose Gold Comfort-Fit Band",
      description:
        "Hand-turned classic 4mm court profile curved smoothly inside and out for effortless everyday comfort.",
      priceMode: "FIXED",
      basePrice: "1180.00",
      metalType: "18K Rose Gold",
      metalFacetVal: "18k-rose-gold",
      metalColor: "Rose",
      metalPurity: "750",
      metalWeightGrams: "5.40",
      hasSizing: true,
      motif: "band",
      altText: "Marais 4mm heavy comfort-fit solid 18K rose gold wedding band",
      variants: [
        {
          sku: "AUR-BND-CRT-7",
          title: "Size 7 / 18K Rose Gold",
          size: "7",
          metal: "18K Rose Gold",
          stockQty: 10,
          isDefault: true,
        },
        {
          sku: "AUR-BND-CRT-9",
          title: "Size 9 / 18K Rose Gold",
          size: "9",
          metal: "18K Rose Gold",
          stockQty: 7,
        },
      ],
    },
    {
      sku: "AUR-PND-PR",
      name: "Étoile Floating Pear Diamond Pendant",
      slug: "etoile-floating-pear-diamond-pendant",
      categoryId: categories.pendants.id,
      subtitle: "0.75 ct GIA Pear Diamond on 18K Yellow Gold Chain",
      description:
        "Delicate three-prong pendant holding an icy pear-cut diamond suspended along an adjustable 16–18 inch diamond-cut cable chain.",
      priceMode: "FIXED",
      basePrice: "2680.00",
      metalType: "18K Yellow Gold",
      metalFacetVal: "18k-yellow-gold",
      metalColor: "Yellow",
      metalPurity: "750",
      metalWeightGrams: "2.30",
      stoneOrigin: "Natural Mined Diamond",
      stoneOriginFacetVal: "natural",
      stoneShape: "Pear",
      stoneShapeFacetVal: "pear",
      caratTotal: "0.75",
      caratCenter: "0.75",
      colorGrade: "E",
      clarityGrade: "VS1",
      cutGrade: "Excellent",
      certificationLab: "GIA",
      certFacetVal: "gia",
      certificateNumber: "GIA-5482910442",
      isFeatured: true,
      isNewArrival: true,
      motif: "pendant",
      altText:
        "Étoile pear-shaped diamond solitaire pendant necklace on fine 18K yellow gold chain",
      variants: [
        {
          sku: "AUR-PND-PR-18Y",
          title: "16–18 in / 18K Yellow Gold",
          size: "16-18 in",
          metal: "18K Yellow Gold",
          stockQty: 5,
          isDefault: true,
        },
        {
          sku: "AUR-PND-PR-18W",
          title: "16–18 in / 18K White Gold",
          size: "16-18 in",
          metal: "18K White Gold",
          stockQty: 3,
        },
      ],
    },
    {
      sku: "AUR-PND-SOL",
      name: "Nocturne Bezel Solitaire Necklace",
      slug: "nocturne-bezel-solitaire-necklace",
      categoryId: categories.pendants.id,
      subtitle: "0.50 ct IGI Lab-Grown Round Diamond in 18K Rose Gold",
      description:
        "Clean rub-over bezel frame offering modern silhouette protection for daily layering.",
      priceMode: "FIXED",
      basePrice: "1390.00",
      compareAtPrice: "1550.00",
      metalType: "18K Rose Gold",
      metalFacetVal: "18k-rose-gold",
      metalColor: "Rose",
      metalPurity: "750",
      metalWeightGrams: "2.05",
      stoneOrigin: "Lab-Grown Diamond",
      stoneOriginFacetVal: "lab-grown",
      stoneShape: "Round Brilliant",
      stoneShapeFacetVal: "round",
      caratTotal: "0.50",
      caratCenter: "0.50",
      colorGrade: "E",
      clarityGrade: "VS1",
      cutGrade: "Ideal",
      certificationLab: "IGI",
      certFacetVal: "igi",
      certificateNumber: "IGI-LG402918231",
      isBestseller: true,
      motif: "pendant",
      altText: "Nocturne bezel-set round diamond pendant crafted in warm 18K rose gold",
      variants: [
        {
          sku: "AUR-PND-SOL-18R",
          title: "16–18 in / 18K Rose Gold",
          size: "16-18 in",
          metal: "18K Rose Gold",
          stockQty: 9,
          isDefault: true,
        },
      ],
    },
    {
      sku: "AUR-EAR-STD",
      name: "Clairvoyant Four-Prong Diamond Studs",
      slug: "clairvoyant-four-prong-diamond-studs",
      categoryId: categories.earrings.id,
      subtitle: "1.00 ctw Matched GIA Pair in 18K White Gold",
      description:
        "Precision-matched 0.50 ct per ear round brilliants fitted with secure La Poussette locking backs.",
      priceMode: "FIXED",
      basePrice: "3250.00",
      metalType: "18K White Gold",
      metalFacetVal: "18k-white-gold",
      metalColor: "White",
      metalPurity: "750",
      metalWeightGrams: "1.95",
      stoneOrigin: "Natural Mined Diamond",
      stoneOriginFacetVal: "natural",
      stoneShape: "Round Brilliant",
      stoneShapeFacetVal: "round",
      caratTotal: "1.00",
      colorGrade: "F",
      clarityGrade: "VS1",
      cutGrade: "Ideal",
      certificationLab: "GIA",
      certFacetVal: "gia",
      certificateNumber: "GIA-7401928371",
      isFeatured: true,
      isBestseller: true,
      motif: "earrings",
      altText: "Pair of 1.00 total carat four-prong round diamond stud earrings in 18K white gold",
      variants: [
        {
          sku: "AUR-EAR-STD-18W",
          title: "1.00 ctw / 18K White Gold",
          metal: "18K White Gold",
          stockQty: 6,
          isDefault: true,
        },
        {
          sku: "AUR-EAR-STD-18Y",
          title: "1.00 ctw / 18K Yellow Gold",
          metal: "18K Yellow Gold",
          stockQty: 4,
        },
      ],
    },
    {
      sku: "AUR-BRC-TEN",
      name: "Avenue Graduated Tennis Bracelet",
      slug: "avenue-graduated-tennis-bracelet",
      categoryId: categories.bracelets.id,
      subtitle: "3.00 ctw IGI Lab-Grown Diamonds in 18K Yellow Gold",
      description:
        "Articulated four-prong basket links curving fluidly across the wrist with hidden figure-eight safety clasp.",
      priceMode: "FIXED",
      basePrice: "4100.00",
      metalType: "18K Yellow Gold",
      metalFacetVal: "18k-yellow-gold",
      metalColor: "Yellow",
      metalPurity: "750",
      metalWeightGrams: "11.20",
      stoneOrigin: "Lab-Grown Diamond",
      stoneOriginFacetVal: "lab-grown",
      stoneShape: "Round Brilliant",
      stoneShapeFacetVal: "round",
      caratTotal: "3.00",
      colorGrade: "E",
      clarityGrade: "VVS2",
      cutGrade: "Ideal",
      certificationLab: "IGI",
      certFacetVal: "igi",
      certificateNumber: "IGI-LG771203948",
      isFeatured: true,
      isNewArrival: true,
      motif: "bracelet",
      altText: "Avenue 3.00 total carat round diamond tennis bracelet crafted in 18K yellow gold",
      variants: [
        {
          sku: "AUR-BRC-TEN-65",
          title: "6.5 in / 18K Yellow Gold",
          size: "6.5 in",
          metal: "18K Yellow Gold",
          stockQty: 4,
          isDefault: true,
        },
        {
          sku: "AUR-BRC-TEN-70",
          title: "7.0 in / 18K Yellow Gold",
          size: "7.0 in",
          metal: "18K Yellow Gold",
          stockQty: 3,
        },
      ],
    },
  ];

  const createdProductIds: string[] = [];

  for (const item of productsSeed) {
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        subtitle: item.subtitle,
        description: item.description,
        status: "ACTIVE",
        categoryId: item.categoryId,
        priceMode: item.priceMode,
        basePrice: new Prisma.Decimal(item.basePrice),
        compareAtPrice: item.compareAtPrice ? new Prisma.Decimal(item.compareAtPrice) : null,
        metalType: item.metalType,
        metalColor: item.metalColor,
        metalPurity: item.metalPurity,
        metalWeightGrams: new Prisma.Decimal(item.metalWeightGrams),
        stoneOrigin: item.stoneOrigin ?? null,
        stoneShape: item.stoneShape ?? null,
        caratTotal: item.caratTotal ? new Prisma.Decimal(item.caratTotal) : null,
        caratCenter: item.caratCenter ? new Prisma.Decimal(item.caratCenter) : null,
        colorGrade: item.colorGrade ?? null,
        clarityGrade: item.clarityGrade ?? null,
        cutGrade: item.cutGrade ?? null,
        certificationLab: item.certificationLab ?? null,
        certificateNumber: item.certificateNumber ?? null,
        hasSizing: item.hasSizing ?? false,
        isFeatured: item.isFeatured ?? false,
        isNewArrival: item.isNewArrival ?? false,
        isBestseller: item.isBestseller ?? false,
        isCustomizable: item.priceMode === "FIXED",
      },
      create: {
        sku: item.sku,
        name: item.name,
        slug: item.slug,
        status: "ACTIVE",
        categoryId: item.categoryId,
        subtitle: item.subtitle,
        description: item.description,
        priceMode: item.priceMode,
        basePrice: new Prisma.Decimal(item.basePrice),
        compareAtPrice: item.compareAtPrice ? new Prisma.Decimal(item.compareAtPrice) : null,
        metalType: item.metalType,
        metalColor: item.metalColor,
        metalPurity: item.metalPurity,
        metalWeightGrams: new Prisma.Decimal(item.metalWeightGrams),
        stoneOrigin: item.stoneOrigin ?? null,
        stoneShape: item.stoneShape ?? null,
        caratTotal: item.caratTotal ? new Prisma.Decimal(item.caratTotal) : null,
        caratCenter: item.caratCenter ? new Prisma.Decimal(item.caratCenter) : null,
        colorGrade: item.colorGrade ?? null,
        clarityGrade: item.clarityGrade ?? null,
        cutGrade: item.cutGrade ?? null,
        certificationLab: item.certificationLab ?? null,
        certificateNumber: item.certificateNumber ?? null,
        hasSizing: item.hasSizing ?? false,
        isFeatured: item.isFeatured ?? false,
        isNewArrival: item.isNewArrival ?? false,
        isBestseller: item.isBestseller ?? false,
        isCustomizable: item.priceMode === "FIXED",
      },
    });
    createdProductIds.push(product.id);

    await prisma.productCustomizationConfig.upsert({
      where: { productId: product.id },
      update: {
        enabled: item.priceMode === "FIXED",
        inheritCategoryDefaults: true,
        minLeadTimeDays: 21,
        disclaimerText: "Crafted to order in our New York & Paris ateliers (typically 3–4 weeks).",
      },
      create: {
        productId: product.id,
        enabled: item.priceMode === "FIXED",
        inheritCategoryDefaults: true,
        minLeadTimeDays: 21,
        disclaimerText: "Crafted to order in our New York & Paris ateliers (typically 3–4 weeks).",
      },
    });

    // Variants & initial inventory ledger
    for (let vIdx = 0; vIdx < item.variants.length; vIdx++) {
      const v = item.variants[vIdx]!;
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          title: v.title,
          size: v.size ?? null,
          metal: v.metal,
          priceOverride: v.priceOverride ? new Prisma.Decimal(v.priceOverride) : null,
          isDefault: v.isDefault ?? false,
          isActive: true,
          sortOrder: vIdx + 1,
        },
        create: {
          productId: product.id,
          sku: v.sku,
          title: v.title,
          size: v.size ?? null,
          metal: v.metal,
          priceOverride: v.priceOverride ? new Prisma.Decimal(v.priceOverride) : null,
          stockQty: v.stockQty,
          reservedQty: 0,
          lowStockThreshold: 2,
          isDefault: v.isDefault ?? false,
          isActive: true,
          sortOrder: vIdx + 1,
        },
      });

      const existingLedger = await prisma.inventoryTransaction.findFirst({
        where: { variantId: variant.id },
      });
      if (!existingLedger) {
        await prisma.inventoryTransaction.create({
          data: {
            variantId: variant.id,
            reason: "INITIAL",
            delta: v.stockQty,
            balanceAfter: v.stockQty,
            referenceType: "SEED",
            referenceId: product.id,
            note: "Initial atelier inventory allocation",
          },
        });
      }
    }

    // Asset generation + primary image
    const asset = await ensureSeedImageAsset({
      slug: item.slug,
      title: item.name,
      subtitle: item.subtitle,
      motif: item.motif,
    });

    const existingImg = await prisma.productImage.findFirst({
      where: { productId: product.id, storageKey: asset.storageKey },
    });
    if (!existingImg) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          storageKey: asset.storageKey,
          url: asset.url,
          mediumUrl: asset.mediumUrl,
          thumbUrl: asset.thumbUrl,
          altText: item.altText,
          width: asset.width,
          height: asset.height,
          isPrimary: true,
          sortOrder: 1,
        },
      });
    }

    // Facet assignments
    const facetAssignments: Array<{ code: string; optVal?: string }> = [
      { code: "metal", optVal: item.metalFacetVal },
      { code: "stone_shape", optVal: item.stoneShapeFacetVal },
      { code: "stone_origin", optVal: item.stoneOriginFacetVal },
      { code: "certification", optVal: item.certFacetVal },
    ];

    for (const assign of facetAssignments) {
      if (!assign.optVal) continue;
      const f = facets.get(assign.code);
      const opt = f?.options.get(assign.optVal);
      if (!f || !opt) continue;
      await prisma.productFacetValue.upsert({
        where: {
          productId_facetId_optionId: {
            productId: product.id,
            facetId: f.id,
            optionId: opt.id,
          },
        },
        update: {},
        create: {
          productId: product.id,
          facetId: f.id,
          optionId: opt.id,
          valueText: opt.label,
        },
      });
    }
  }

  // Banners
  const heroAsset = await ensureSeedImageAsset({
    slug: "hero-bridal-2026",
    title: "The Lumière Solitaire Collection",
    subtitle: "Handcrafted in Recycled 18K Gold & 950 Platinum",
    motif: "banner",
    width: 1600,
    height: 1200,
  });

  const existingHero = await prisma.banner.findFirst({
    where: { title: "Timeless Form, Certified Radiance" },
  });
  if (!existingHero) {
    await prisma.banner.create({
      data: {
        title: "Timeless Form, Certified Radiance",
        subtitle:
          "GIA-graded diamonds sculpted into low-profile cathedral mounts with documented provenance.",
        ctaLabel: "Explore Engagement Rings",
        ctaHref: "/collections/rings/engagement-rings",
        imageUrl: heroAsset.url,
        mobileImageUrl: heroAsset.mediumUrl,
        altText: "Lumière Solitaire diamond ring showcased against warm champagne ivory marble",
        position: "HERO",
        isActive: true,
        sortOrder: 1,
      },
    });
  }

  // Editorial Buying Guides
  const articlesSeed = [
    {
      slug: "understanding-diamond-4cs",
      title: "Understanding the Diamond 4Cs: Cut, Color, Clarity & Carat",
      excerpt:
        "How cut proportions govern brilliance more than any other characteristic, and how to balance color and clarity for natural luminance.",
      authorName: "Claire Moreau, GG (GIA)",
      relatedCategorySlug: "rings/engagement-rings",
      bodyMarkdown: `## Why Cut Governs Light Performance\n\nAmong the four grading pillars—Cut, Color, Clarity, and Carat—**Cut** is the only human craft variable. Even a D-Flawless stone appears dull if cut too deep or too shallow.\n\n### Recommended Atelier Balance\n\n- **Cut Grade:** Prioritize Ideal or GIA Excellent.\n- **Color:** D–F appears icy colorless against platinum; G–H harmonizes warmly with 18K yellow gold.\n- **Clarity:** VS1–VS2 delivers complete eye-clean purity without paying collector premiums for VVS inclusions visible only under 10x loupe magnification.`,
    },
    {
      slug: "natural-vs-lab-grown-diamonds",
      title: "Natural vs. Lab-Grown Diamonds: Provenance & Value Compared",
      excerpt:
        "An objective gemological comparison of crystal structure, grading transparency, and heirloom considerations.",
      authorName: "Dr. Henri Vance, Senior Gemologist",
      relatedCategorySlug: "necklaces/pendants",
      bodyMarkdown: `## Identical Optics, Distinct Provenance\n\nBoth natural and lab-grown diamonds share pure carbon crystal lattice structure, hardness (10 Mohs), and refractive index.\n\n- **Natural Mined Diamonds:** Formed over billions of years beneath Earth's mantle; selected by our atelier exclusively under Kimberley Process compliance and GIA grading.\n- **Lab-Grown Diamonds:** Grown via CVD or HPHT in controlled chambers and independently graded by IGI or GIA with laser inscription.`,
    },
    {
      slug: "fine-jewellery-care-guide",
      title: "Atelier Care: Maintaining 18K Gold, Platinum & Diamond Fire",
      excerpt:
        "Simple home care rituals and annual prong inspection schedules to preserve mirror brilliance for generations.",
      authorName: "Atelier Bench Team",
      relatedCategorySlug: "rings/wedding-bands",
      bodyMarkdown: `## Restoring Everyday Radiance\n\nLotions, soaps, and natural skin oils gently film underneath the pavilion facets of a diamond, muting its fire.\n\n1. Soak for 15 minutes in lukewarm water with two drops of mild dish soap.\n2. Gently sweep behind the basket with a soft-bristled baby toothbrush.\n3. Rinse thoroughly in clear water over a closed drain and buff dry with a lint-free chamois cloth.`,
    },
  ];

  for (const article of articlesSeed) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: {
        title: article.title,
        excerpt: article.excerpt,
        bodyMarkdown: article.bodyMarkdown,
        relatedCategorySlug: article.relatedCategorySlug,
        isPublished: true,
        publishedAt: new Date("2026-09-15T10:00:00Z"),
      },
      create: {
        ...article,
        isPublished: true,
        publishedAt: new Date("2026-09-15T10:00:00Z"),
      },
    });
  }

  // Sample completed order for Claire Laurent
  const existingSampleOrder = await prisma.order.findUnique({
    where: { orderNumber: "ORD-2026-10001" },
  });
  if (!existingSampleOrder) {
    const studProduct = await prisma.product.findUnique({
      where: { sku: "AUR-EAR-STD" },
      include: { variants: true, images: true },
    });
    const variant = studProduct?.variants[0];
    if (studProduct && variant) {
      await prisma.order.create({
        data: {
          orderNumber: "ORD-2026-10001",
          userId: demoCustomer.id,
          status: "DELIVERED",
          currency: "USD",
          currencyDecimals: 2,
          baseCurrency: "USD",
          exchangeRate: new Prisma.Decimal("1.00000000"),
          subtotal: new Prisma.Decimal("3250.00"),
          shippingCost: new Prisma.Decimal("0.00"),
          taxAmount: new Prisma.Decimal("260.00"),
          taxRateSnapshot: new Prisma.Decimal("0.0800"),
          total: new Prisma.Decimal("3510.00"),
          baseSubtotal: new Prisma.Decimal("3250.00"),
          baseShippingCost: new Prisma.Decimal("0.00"),
          baseTaxAmount: new Prisma.Decimal("260.00"),
          baseDiscountAmount: new Prisma.Decimal("0.00"),
          baseTotal: new Prisma.Decimal("3510.00"),
          chargedCurrency: "USD",
          chargedAmount: new Prisma.Decimal("3510.00"),
          shippingMethodName: "Insured Domestic Express (US)",
          shippingZoneId: "zone-us-domestic",
          signatureRequired: true,
          paidAt: new Date("2026-10-01T14:20:00Z"),
          shippedAt: new Date("2026-10-02T17:10:00Z"),
          deliveredAt: new Date("2026-10-04T11:30:00Z"),
          carrier: "Malca-Amit Insured Express",
          trackingNumber: "MA-849201948",
          shippingAddress: {
            fullName: "Claire Laurent",
            line1: "412 Mercer Street, Apt 6B",
            city: "New York",
            state: "NY",
            postalCode: "10013",
            country: "US",
            phone: "+1 212 555 0140",
          },
          billingAddress: {
            fullName: "Claire Laurent",
            line1: "412 Mercer Street, Apt 6B",
            city: "New York",
            state: "NY",
            postalCode: "10013",
            country: "US",
            phone: "+1 212 555 0140",
          },
          items: {
            create: [
              {
                variantId: variant.id,
                productId: studProduct.id,
                skuSnapshot: variant.sku,
                titleSnapshot: studProduct.name,
                variantTitleSnapshot: variant.title,
                imageUrlSnapshot: studProduct.images[0]?.url ?? null,
                quantity: 1,
                unitPrice: new Prisma.Decimal("3250.00"),
                lineTotal: new Prisma.Decimal("3250.00"),
              },
            ],
          },
          events: {
            create: [
              {
                toStatus: "PENDING_PAYMENT",
                note: "Order created and stock reserved",
              },
              {
                fromStatus: "PENDING_PAYMENT",
                toStatus: "PAID",
                note: "Payment authorized via Stripe",
              },
              {
                fromStatus: "PAID",
                toStatus: "SHIPPED",
                note: "Dispatched via Malca-Amit Insured Express",
              },
              {
                fromStatus: "SHIPPED",
                toStatus: "DELIVERED",
                note: "Adult signature captured upon arrival",
              },
            ],
          },
        },
      });
      await prisma.$executeRaw`SELECT setval('order_number_seq', 10002, false)`;
    }
  }

  // Sample Customization Request & Attached Atelier Chat for Claire Laurent
  const existingCustomReq = await prisma.customizationRequest.findUnique({
    where: { requestNumber: "CR-2026-10001" },
  });
  if (!existingCustomReq) {
    const customProduct = await prisma.product.findUnique({
      where: { sku: "AUR-EMR-180" },
      include: { images: true, variants: true },
    });
    if (customProduct) {
      const custReq = await prisma.customizationRequest.create({
        data: {
          id: "seed-cust-req-10001",
          requestNumber: "CR-2026-10001",
          userId: demoCustomer.id,
          productId: customProduct.id,
          variantId: customProduct.variants[0]?.id ?? null,
          status: "IN_REVIEW",
          displayCurrency: "USD",
          indicativeMinBase: new Prisma.Decimal("5497.00"),
          indicativeMaxBase: new Prisma.Decimal("6046.70"),
          contactPreference: "EMAIL",
          customerName: demoCustomer.name,
          customerEmail: demoCustomer.email,
          preferredTimeline: "Mid next month",
          customerNote:
            "Could we keep the cathedral gallery ultra low-profile to sit flush with a pavé band?",
          item: {
            create: {
              productNameSnapshot: customProduct.name,
              productSlugSnapshot: customProduct.slug,
              productSkuSnapshot: customProduct.sku,
              variantTitleSnapshot: customProduct.variants[0]?.title ?? null,
              basePriceSnapshot: customProduct.basePrice,
              selections: [
                {
                  groupId: "seed-metal",
                  groupCode: "metal",
                  groupLabel: "Precious Metal",
                  groupType: "SWATCH",
                  valueCodes: ["platinum_950"],
                  rawText: null,
                  numberValue: null,
                  displayValue: "Platinum 950",
                  swatchHex: "#D6D8DC",
                  priceDeltaBase: "250.00",
                },
                {
                  groupId: "seed-stone",
                  groupCode: "stone_shape",
                  groupLabel: "Center Stone Cut",
                  groupType: "SELECT",
                  valueCodes: ["emerald"],
                  rawText: null,
                  numberValue: null,
                  displayValue: "Emerald Step-Cut",
                  swatchHex: null,
                  priceDeltaBase: "297.00",
                },
                {
                  groupId: "seed-carat",
                  groupCode: "carat_weight",
                  groupLabel: "Preferred Carat Weight",
                  groupType: "NUMBER_RANGE",
                  valueCodes: [],
                  rawText: null,
                  numberValue: "2.0",
                  displayValue: "2.0 ct",
                  swatchHex: null,
                  priceDeltaBase: "0.00",
                },
                {
                  groupId: "seed-size",
                  groupCode: "ring_size",
                  groupLabel: "Ring Size (US / UK / EU)",
                  groupType: "SELECT",
                  valueCodes: ["US_6"],
                  rawText: null,
                  numberValue: null,
                  displayValue: "US 6 · UK L 1/2 · EU 52",
                  swatchHex: null,
                  priceDeltaBase: "0.00",
                },
                {
                  groupId: "seed-engraving",
                  groupCode: "engraving",
                  groupLabel: "Inner Band Engraving",
                  groupType: "TEXT",
                  valueCodes: [],
                  rawText: "12.11.26 C&J",
                  numberValue: null,
                  displayValue: "12.11.26 C&J",
                  swatchHex: null,
                  priceDeltaBase: "0.00",
                },
              ] as Prisma.InputJsonValue,
            },
          },
          events: {
            create: [
              {
                actorId: demoCustomer.id,
                actorRole: "CUSTOMER",
                toStatus: "SUBMITTED",
                eventType: "SUBMITTED",
                message: "Bespoke customization request submitted",
              },
              {
                fromStatus: "SUBMITTED",
                toStatus: "IN_REVIEW",
                actorRole: "ADMIN",
                eventType: "STATUS_CHANGED",
                message: "Assigned to Paris stone-sourcing bench for emerald pair matching",
              },
            ],
          },
        },
      });

      const conversation = await prisma.conversation.upsert({
        where: { id: "seed-conv-cust-10001" },
        update: {},
        create: {
          id: "seed-conv-cust-10001",
          userId: demoCustomer.id,
          contextType: "CUSTOMIZATION_REQUEST",
          contextRefId: custReq.id,
          customizationRequestId: custReq.id,
          status: "OPEN",
          tags: ["Customization"],
          lastMessageAt: new Date("2026-10-12T15:15:00Z"),
          lastMessagePreview:
            "Our head setter is confirming gallery clearance for a flush wedding band stack.",
          participants: {
            create: [{ userId: demoCustomer.id, lastReadAt: new Date("2026-10-12T14:00:00Z") }],
          },
        },
      });

      await prisma.message.createMany({
        data: [
          {
            id: "seed-msg-cust-1",
            conversationId: conversation.id,
            senderId: demoCustomer.id,
            senderRole: "CUSTOMER",
            senderName: demoCustomer.name,
            clientTempId: "seed-1",
            type: "TEXT",
            body: "Hello! I just submitted CR-2026-10001 for the Versailles Emerald Cut in 950 Platinum and wanted to double-check band stack height.",
            createdAt: new Date("2026-10-12T14:05:00Z"),
          },
          {
            id: "seed-msg-cust-2",
            conversationId: conversation.id,
            senderRole: "ADMIN",
            senderName: "Atelier Concierge",
            clientTempId: "seed-2",
            type: "TEXT",
            body: "Bonjour Claire — we have received your specifications! Our head setter is confirming gallery clearance for a flush wedding band stack and will prepare your quotation shortly.",
            createdAt: new Date("2026-10-12T15:15:00Z"),
          },
        ],
        skipDuplicates: true,
      });

      await prisma.$executeRaw`SELECT setval('customization_request_number_seq', 10002, false)`;
    }
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO_DATA === "true") {
    throw new Error("Refusing to seed demo data when NODE_ENV=production.");
  }
  const baseline = await seedProductionBaseline();
  if (process.env.SEED_DEMO_DATA === "true") {
    await seedDemoCatalogue(baseline);
    console.log("Seed completed: production baseline + demo jewellery catalogue.");
  } else {
    console.log("Seed completed: production baseline only (SEED_DEMO_DATA !== true).");
  }
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
