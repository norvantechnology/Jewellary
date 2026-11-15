import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { Prisma } from "@/generated/prisma/client";
import { createPrismaClient } from "@/server/prisma-client";

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
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Fine Jewelry Store";
  const contactEmail = process.env.EMAIL_FROM || "help@example.com";

  await prisma.storeSetting.upsert({
    where: { id: "default" },
    update: {
      storeName: siteName,
      contactEmail,
    },
    create: {
      id: "default",
      storeName: siteName,
      tagline: "Certified Diamond Engagement Rings & Fine Jewelry",
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
        "GIA certified diamonds, custom engagement rings and 18K recycled gold jewelry, with free insured shipping.",
      socialLinks: [
        { label: "Instagram", href: "https://instagram.com/shinorajewels" },
        { label: "Pinterest", href: "https://pinterest.com/shinorajewels" },
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
      name: "Insured Express Shipping (US)",
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
      name: "Insured International Shipping",
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
  const adminName = process.env.ADMIN_SEED_NAME || "Store Admin";

  await ensureUserWithPassword({
    id: "seed-admin-user",
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: "ADMIN",
  });

  // Seed default concierge canned replies (idempotent)
  const cannedRepliesSeed = [
    {
      id: "canned-greeting",
      title: "Welcome & custom design timeline",
      category: "General",
      body: "Hi, thanks for reaching out! Our jewelers make custom pieces in 3–4 weeks after you approve the final design. Would you like help choosing a metal or stone?",
      sortOrder: 0,
    },
    {
      id: "canned-sizing",
      title: "Ring sizing & free resizing",
      category: "Sizing",
      body: "Every ring includes one free resize within 60 days of delivery. If it's a surprise and you don't know their size, we recommend a US size 6 (UK L½ / EU 52).",
      sortOrder: 1,
    },
    {
      id: "canned-dossier",
      title: "GIA / IGI certificates & diamond photos",
      category: "Diamonds",
      body: "Every diamond over 0.50 ct comes with its original GIA or IGI certificate and a laser-inscribed ID number. I can send close-up photos or suggest other stones if you'd like.",
      sortOrder: 2,
    },
    {
      id: "canned-quote-walkthrough",
      title: "Reviewing your custom quote",
      category: "Customization",
      body: "Your quote locks in your price for 7 days. To accept, use the secure link in your email or go to Custom designs in your account.",
      sortOrder: 3,
    },
    {
      id: "canned-delivery",
      title: "Insured shipping",
      category: "Shipping",
      body: "Every order ships fully insured in tamper-proof packaging, and an adult signature is required on delivery.",
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
}

async function main() {
  await seedProductionBaseline();
  console.log("Seed completed: store settings, currencies, shipping zones and admin account.");
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
