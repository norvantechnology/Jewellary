-- Rollback script for 20261112041500_add_customization_and_chat

-- Drop foreign keys on CartItem and OrderItem
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_customizationRequestId_fkey";
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_customizationRequestId_fkey";

-- Drop check constraints
ALTER TABLE "customization_requests" DROP CONSTRAINT IF EXISTS "customization_requests_non_negative_prices";
ALTER TABLE "customization_option_groups" DROP CONSTRAINT IF EXISTS "customization_option_groups_scope_check";

-- Drop child chat tables first
DROP TABLE IF EXISTS "chat_canned_replies";
DROP TABLE IF EXISTS "conversation_notes";
DROP TABLE IF EXISTS "attachments";
DROP TABLE IF EXISTS "messages";
DROP TABLE IF EXISTS "conversation_participants";
DROP TABLE IF EXISTS "conversations";

-- Drop child customization tables
DROP TABLE IF EXISTS "quote_tokens";
DROP TABLE IF EXISTS "customization_request_events";
DROP TABLE IF EXISTS "customization_request_images";
DROP TABLE IF EXISTS "customization_request_items";
DROP TABLE IF EXISTS "customization_requests";
DROP TABLE IF EXISTS "customization_option_values";
DROP TABLE IF EXISTS "customization_option_groups";
DROP TABLE IF EXISTS "product_customization_config";

-- Drop customization sequence
DROP SEQUENCE IF EXISTS customization_request_number_seq;

-- Restore Product column
ALTER TABLE "Product" DROP COLUMN IF EXISTS "isCustomizable";

-- Restore OrderItem columns and indexes
DROP INDEX IF EXISTS "OrderItem_customizationRequestId_idx";
ALTER TABLE "OrderItem"
  DROP COLUMN IF EXISTS "customizationRequestId",
  DROP COLUMN IF EXISTS "customizationSnapshot",
  DROP COLUMN IF EXISTS "quoteCurrency",
  DROP COLUMN IF EXISTS "quoteExchangeRate",
  DROP COLUMN IF EXISTS "quotedBasePrice";

-- Restore CartItem unique index and remove custom-quoted bag items if present
DELETE FROM "CartItem" WHERE "customizationConfigKey" <> '' OR "customizationRequestId" IS NOT NULL;
DROP INDEX IF EXISTS "CartItem_cartId_variantId_customizationConfigKey_key";
DROP INDEX IF EXISTS "CartItem_customizationRequestId_idx";
ALTER TABLE "CartItem"
  DROP COLUMN IF EXISTS "customUnitPriceBase",
  DROP COLUMN IF EXISTS "customizationConfigKey",
  DROP COLUMN IF EXISTS "customizationRequestId",
  DROP COLUMN IF EXISTS "customizationSnapshot";
CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartId_variantId_key" ON "CartItem"("cartId", "variantId");

-- Drop enums
DROP TYPE IF EXISTS "ChatSenderRole";
DROP TYPE IF EXISTS "ChatMessageType";
DROP TYPE IF EXISTS "ConversationStatus";
DROP TYPE IF EXISTS "ConversationContextType";
DROP TYPE IF EXISTS "ContactPreference";
DROP TYPE IF EXISTS "CustomizationRequestStatus";
DROP TYPE IF EXISTS "PriceAdjustmentType";
DROP TYPE IF EXISTS "CustomizationGroupType";

