-- CreateEnum
CREATE TYPE "CustomizationGroupType" AS ENUM ('SELECT', 'MULTI_SELECT', 'SWATCH', 'NUMBER_RANGE', 'TEXT', 'TEXTAREA', 'IMAGE_UPLOAD');

-- CreateEnum
CREATE TYPE "PriceAdjustmentType" AS ENUM ('NONE', 'FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "CustomizationRequestStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ORDERED');

-- CreateEnum
CREATE TYPE "ContactPreference" AS ENUM ('EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "ConversationContextType" AS ENUM ('GENERAL', 'PRODUCT', 'CUSTOMIZATION_REQUEST', 'ORDER');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'IMAGE', 'PRODUCT', 'REQUEST', 'ORDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChatSenderRole" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN', 'SYSTEM');

-- DropIndex
DROP INDEX "CartItem_cartId_variantId_key";

-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS customization_request_number_seq START WITH 1 INCREMENT BY 1;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "customUnitPriceBase" DECIMAL(12,2),
ADD COLUMN     "customizationConfigKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "customizationRequestId" TEXT,
ADD COLUMN     "customizationSnapshot" JSONB;

-- AlterTable
ALTER TABLE "Currency" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "customizationRequestId" TEXT,
ADD COLUMN     "customizationSnapshot" JSONB,
ADD COLUMN     "quoteCurrency" TEXT,
ADD COLUMN     "quoteExchangeRate" DECIMAL(18,8),
ADD COLUMN     "quotedBasePrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isCustomizable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "product_customization_config" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "inheritCategoryDefaults" BOOLEAN NOT NULL DEFAULT true,
    "minLeadTimeDays" INTEGER,
    "disclaimerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_customization_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_option_groups" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomizationGroupType" NOT NULL,
    "helperText" TEXT,
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minValue" DECIMAL(12,4),
    "maxValue" DECIMAL(12,4),
    "stepValue" DECIMAL(12,4),
    "defaultValue" TEXT,
    "maxLength" INTEGER,
    "maxFiles" INTEGER,
    "unit" TEXT,
    "validationRules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customization_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_option_values" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "swatchHex" TEXT,
    "swatchImageUrl" TEXT,
    "priceAdjustmentType" "PriceAdjustmentType" NOT NULL DEFAULT 'NONE',
    "priceAdjustmentValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customization_option_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "userId" TEXT,
    "guestEmail" TEXT,
    "guestEmailVerifiedAt" TIMESTAMP(3),
    "guestToken" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "contactPreference" "ContactPreference" NOT NULL DEFAULT 'EMAIL',
    "preferredTimeline" TEXT,
    "preferredDate" TIMESTAMP(3),
    "customerNote" TEXT,
    "internalNote" TEXT,
    "status" "CustomizationRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "displayCurrency" TEXT NOT NULL DEFAULT 'USD',
    "indicativeMinBase" DECIMAL(12,2) NOT NULL,
    "indicativeMaxBase" DECIMAL(12,2) NOT NULL,
    "quotedPriceBase" DECIMAL(12,2),
    "quoteExpiresAt" TIMESTAMP(3),
    "estimatedDeliveryDays" INTEGER,
    "adminMessage" TEXT,
    "rejectionReason" TEXT,
    "orderId" TEXT,
    "assignedToId" TEXT,
    "reviewedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "reminder24hSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_request_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "productSlugSnapshot" TEXT NOT NULL,
    "productSkuSnapshot" TEXT NOT NULL,
    "variantTitleSnapshot" TEXT,
    "basePriceSnapshot" DECIMAL(12,2) NOT NULL,
    "selections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customization_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_request_images" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "groupId" TEXT,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customization_request_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_request_events" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "CustomizationRequestStatus",
    "toStatus" "CustomizationRequestStatus" NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "actorId" TEXT,
    "actorRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customization_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_tokens" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lockedPriceBase" DECIMAL(12,2) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "contextType" "ConversationContextType" NOT NULL DEFAULT 'GENERAL',
    "contextRefId" TEXT,
    "customizationRequestId" TEXT,
    "userId" TEXT,
    "guestEmail" TEXT,
    "guestEmailVerifiedAt" TIMESTAMP(3),
    "guestToken" TEXT,
    "guestName" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignedToId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "lastOfflineEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT,
    "guestEmail" TEXT,
    "role" "ChatSenderRole" NOT NULL DEFAULT 'CUSTOMER',
    "lastReadSeq" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderRole" "ChatSenderRole" NOT NULL,
    "senderName" TEXT NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "refId" TEXT,
    "refSnapshot" JSONB,
    "clientTempId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "uploaderId" TEXT,
    "guestToken" TEXT,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "exifStripped" BOOLEAN NOT NULL DEFAULT true,
    "scanStatus" TEXT NOT NULL DEFAULT 'CLEAN',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_notes" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_canned_replies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_canned_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_customization_config_productId_key" ON "product_customization_config"("productId");

-- CreateIndex
CREATE INDEX "customization_option_groups_productId_isActive_sortOrder_idx" ON "customization_option_groups"("productId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "customization_option_groups_categoryId_isActive_sortOrder_idx" ON "customization_option_groups"("categoryId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "customization_option_groups_productId_code_key" ON "customization_option_groups"("productId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customization_option_groups_categoryId_code_key" ON "customization_option_groups"("categoryId", "code");

-- CreateIndex
CREATE INDEX "customization_option_values_groupId_isAvailable_sortOrder_idx" ON "customization_option_values"("groupId", "isAvailable", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "customization_option_values_groupId_value_key" ON "customization_option_values"("groupId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "customization_requests_requestNumber_key" ON "customization_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "customization_requests_userId_createdAt_idx" ON "customization_requests"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "customization_requests_guestEmail_createdAt_idx" ON "customization_requests"("guestEmail", "createdAt");

-- CreateIndex
CREATE INDEX "customization_requests_guestToken_createdAt_idx" ON "customization_requests"("guestToken", "createdAt");

-- CreateIndex
CREATE INDEX "customization_requests_status_createdAt_idx" ON "customization_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "customization_requests_productId_status_idx" ON "customization_requests"("productId", "status");

-- CreateIndex
CREATE INDEX "customization_requests_status_quoteExpiresAt_idx" ON "customization_requests"("status", "quoteExpiresAt");

-- CreateIndex
CREATE INDEX "customization_requests_orderId_idx" ON "customization_requests"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "customization_request_items_requestId_key" ON "customization_request_items"("requestId");

-- CreateIndex
CREATE INDEX "customization_request_images_requestId_sortOrder_idx" ON "customization_request_images"("requestId", "sortOrder");

-- CreateIndex
CREATE INDEX "customization_request_events_requestId_createdAt_idx" ON "customization_request_events"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "quote_tokens_tokenHash_key" ON "quote_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "quote_tokens_requestId_expiresAt_idx" ON "quote_tokens"("requestId", "expiresAt");

-- CreateIndex
CREATE INDEX "conversations_userId_status_lastMessageAt_idx" ON "conversations"("userId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_guestToken_status_idx" ON "conversations"("guestToken", "status");

-- CreateIndex
CREATE INDEX "conversations_guestEmail_status_idx" ON "conversations"("guestEmail", "status");

-- CreateIndex
CREATE INDEX "conversations_status_lastMessageAt_idx" ON "conversations"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_contextType_contextRefId_idx" ON "conversations"("contextType", "contextRefId");

-- CreateIndex
CREATE INDEX "conversations_assignedToId_status_idx" ON "conversations"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "conversations_customizationRequestId_idx" ON "conversations"("customizationRequestId");

-- CreateIndex
CREATE INDEX "conversation_participants_userId_idx" ON "conversation_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversationId_userId_key" ON "conversation_participants"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "messages_seq_key" ON "messages"("seq");

-- CreateIndex
CREATE INDEX "messages_conversationId_seq_idx" ON "messages"("conversationId", "seq");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversationId_clientTempId_key" ON "messages"("conversationId", "clientTempId");

-- CreateIndex
CREATE INDEX "attachments_conversationId_createdAt_idx" ON "attachments"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "attachments_messageId_idx" ON "attachments"("messageId");

-- CreateIndex
CREATE INDEX "conversation_notes_conversationId_createdAt_idx" ON "conversation_notes"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_canned_replies_isActive_sortOrder_idx" ON "chat_canned_replies"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "CartItem_customizationRequestId_idx" ON "CartItem"("customizationRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_variantId_customizationConfigKey_key" ON "CartItem"("cartId", "variantId", "customizationConfigKey");

-- CreateIndex
CREATE INDEX "OrderItem_customizationRequestId_idx" ON "OrderItem"("customizationRequestId");

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_customizationRequestId_fkey" FOREIGN KEY ("customizationRequestId") REFERENCES "customization_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_customizationRequestId_fkey" FOREIGN KEY ("customizationRequestId") REFERENCES "customization_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_customization_config" ADD CONSTRAINT "product_customization_config_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_option_groups" ADD CONSTRAINT "customization_option_groups_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_option_groups" ADD CONSTRAINT "customization_option_groups_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_option_values" ADD CONSTRAINT "customization_option_values_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "customization_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_request_items" ADD CONSTRAINT "customization_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "customization_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_request_images" ADD CONSTRAINT "customization_request_images_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "customization_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_request_events" ADD CONSTRAINT "customization_request_events_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "customization_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_tokens" ADD CONSTRAINT "quote_tokens_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "customization_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customizationRequestId_fkey" FOREIGN KEY ("customizationRequestId") REFERENCES "customization_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraints
ALTER TABLE "customization_option_groups" ADD CONSTRAINT "customization_option_groups_scope_check" CHECK (("productId" IS NOT NULL AND "categoryId" IS NULL) OR ("productId" IS NULL AND "categoryId" IS NOT NULL));
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_non_negative_prices" CHECK ("indicativeMinBase" >= 0 AND "indicativeMaxBase" >= "indicativeMinBase" AND ("quotedPriceBase" IS NULL OR "quotedPriceBase" >= 0));
