-- CreateEnum
CREATE TYPE "CurrencySymbolPosition" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "CurrencyRoundingRule" AS ENUM ('HALF_UP', 'HALF_EVEN', 'CEIL', 'FLOOR', 'NONE');

-- AlterTable: User preferred currency
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "preferredCurrency" TEXT;

-- AlterTable: Order currency & immutable base/charge snapshots
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "baseDiscountAmount" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "baseShippingCost" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "baseSubtotal" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "baseTaxAmount" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "baseTotal" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "chargedAmount" DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS "chargedCurrency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "currencyDecimals" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
  ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,3),
  ALTER COLUMN "shippingCost" SET DATA TYPE DECIMAL(14,3),
  ALTER COLUMN "taxAmount" SET DATA TYPE DECIMAL(14,3),
  ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(14,3),
  ALTER COLUMN "total" SET DATA TYPE DECIMAL(14,3),
  ALTER COLUMN "refundedAmount" SET DATA TYPE DECIMAL(14,3);

-- Backfill existing orders so historical records retain exact immutable base & charged snapshots
UPDATE "Order"
SET
  "baseCurrency" = "currency",
  "baseSubtotal" = "subtotal",
  "baseShippingCost" = "shippingCost",
  "baseTaxAmount" = "taxAmount",
  "baseDiscountAmount" = "discountAmount",
  "baseTotal" = "total",
  "chargedCurrency" = "currency",
  "chargedAmount" = "total",
  "currencyDecimals" = CASE
    WHEN UPPER("currency") IN ('BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF') THEN 0
    WHEN UPPER("currency") IN ('BHD','IQD','JOD','KWD','LYD','OMR','TND') THEN 3
    ELSE 2
  END,
  "exchangeRate" = 1;

-- AlterTable: OrderItem precision support up to 3-decimal currencies
ALTER TABLE "OrderItem"
  ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,3),
  ALTER COLUMN "lineTotal" SET DATA TYPE DECIMAL(14,3);

-- AlterTable: PaymentTransaction precision support up to 3-decimal currencies
ALTER TABLE "PaymentTransaction"
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,3);

-- CreateTable: Currency
CREATE TABLE IF NOT EXISTS "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "symbolPosition" "CurrencySymbolPosition" NOT NULL DEFAULT 'BEFORE',
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "roundingRule" "CurrencyRoundingRule" NOT NULL DEFAULT 'HALF_UP',
    "exchangeRate" DECIMAL(18,8) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Currency_exchangeRate_positive" CHECK ("exchangeRate" > 0),
    CONSTRAINT "Currency_decimalPlaces_range" CHECK ("decimalPlaces" >= 0 AND "decimalPlaces" <= 4),
    CONSTRAINT "Currency_base_rate_is_one" CHECK ("isBase" = false OR "exchangeRate" = 1)
);

-- CreateTable: CurrencyRateHistory
CREATE TABLE IF NOT EXISTS "CurrencyRateHistory" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "oldRate" DECIMAL(18,8) NOT NULL,
    "newRate" DECIMAL(18,8) NOT NULL,
    "changedById" TEXT,
    "changedByEmail" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Currency_code_key" ON "Currency"("code");
CREATE INDEX IF NOT EXISTS "Currency_isActive_sortOrder_idx" ON "Currency"("isActive", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "Currency_single_base_key" ON "Currency"("isBase") WHERE "isBase" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "Currency_single_default_key" ON "Currency"("isDefault") WHERE "isDefault" = true;

CREATE INDEX IF NOT EXISTS "CurrencyRateHistory_currencyId_createdAt_idx" ON "CurrencyRateHistory"("currencyId", "createdAt");
CREATE INDEX IF NOT EXISTS "CurrencyRateHistory_currencyCode_createdAt_idx" ON "CurrencyRateHistory"("currencyCode", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CurrencyRateHistory_currencyId_fkey'
  ) THEN
    ALTER TABLE "CurrencyRateHistory"
      ADD CONSTRAINT "CurrencyRateHistory_currencyId_fkey"
      FOREIGN KEY ("currencyId") REFERENCES "Currency"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed base currency from StoreSetting if no base currency exists yet
INSERT INTO "Currency" (
  "id", "code", "name", "symbol", "symbolPosition", "decimalPlaces", "roundingRule",
  "exchangeRate", "isActive", "isDefault", "isBase", "sortOrder", "updatedAt"
)
SELECT
  'curr_base_' || LOWER(COALESCE(s."currency", 'usd')),
  UPPER(COALESCE(s."currency", 'USD')),
  CASE UPPER(COALESCE(s."currency", 'USD'))
    WHEN 'USD' THEN 'US Dollar'
    WHEN 'EUR' THEN 'Euro'
    WHEN 'GBP' THEN 'British Pound'
    ELSE UPPER(COALESCE(s."currency", 'USD'))
  END,
  CASE UPPER(COALESCE(s."currency", 'USD'))
    WHEN 'EUR' THEN '€'
    WHEN 'GBP' THEN '£'
    ELSE '$'
  END,
  'BEFORE'::"CurrencySymbolPosition",
  2,
  'HALF_UP'::"CurrencyRoundingRule",
  1.00000000,
  true,
  true,
  true,
  0,
  NOW()
FROM (SELECT COALESCE((SELECT "currency" FROM "StoreSetting" WHERE "id" = 'default'), 'USD') AS "currency") s
WHERE NOT EXISTS (SELECT 1 FROM "Currency" WHERE "isBase" = true)
ON CONFLICT ("code") DO NOTHING;

