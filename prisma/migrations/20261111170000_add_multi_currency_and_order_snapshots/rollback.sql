-- Rollback script for 20261111170000_add_multi_currency_and_order_snapshots

DROP TABLE IF EXISTS "CurrencyRateHistory";
DROP INDEX IF EXISTS "Currency_single_default_key";
DROP INDEX IF EXISTS "Currency_single_base_key";
DROP INDEX IF EXISTS "Currency_isActive_sortOrder_idx";
DROP INDEX IF EXISTS "Currency_code_key";
DROP TABLE IF EXISTS "Currency";

ALTER TABLE "PaymentTransaction"
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

ALTER TABLE "OrderItem"
  ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "lineTotal" SET DATA TYPE DECIMAL(12,2);

ALTER TABLE "Order"
  DROP COLUMN IF EXISTS "baseCurrency",
  DROP COLUMN IF EXISTS "baseDiscountAmount",
  DROP COLUMN IF EXISTS "baseShippingCost",
  DROP COLUMN IF EXISTS "baseSubtotal",
  DROP COLUMN IF EXISTS "baseTaxAmount",
  DROP COLUMN IF EXISTS "baseTotal",
  DROP COLUMN IF EXISTS "chargedAmount",
  DROP COLUMN IF EXISTS "chargedCurrency",
  DROP COLUMN IF EXISTS "currencyDecimals",
  DROP COLUMN IF EXISTS "exchangeRate",
  ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "shippingCost" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "taxAmount" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "refundedAmount" SET DATA TYPE DECIMAL(12,2);

ALTER TABLE "user" DROP COLUMN IF EXISTS "preferredCurrency";

DROP TYPE IF EXISTS "CurrencyRoundingRule";
DROP TYPE IF EXISTS "CurrencySymbolPosition";

