-- Backend performance indexes across orders, catalog, users, customization, chat, and cleanup jobs.
-- Safe, idempotent migration matching prisma/schema.prisma @@index declarations plus pg_trgm search indexes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- User
CREATE INDEX IF NOT EXISTS "user_createdAt_idx" ON "user"("createdAt");
CREATE INDEX IF NOT EXISTS "user_role_anonymizedAt_createdAt_idx" ON "user"("role", "anonymizedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "user_name_trgm_idx" ON "user" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_email_trgm_idx" ON "user" USING gin ("email" gin_trgm_ops);

-- Session & Verification cleanup / TTL
CREATE INDEX IF NOT EXISTS "session_expiresAt_idx" ON "session"("expiresAt");
CREATE INDEX IF NOT EXISTS "verification_expiresAt_idx" ON "verification"("expiresAt");

-- Product
CREATE INDEX IF NOT EXISTS "Product_deletedAt_updatedAt_idx" ON "Product"("deletedAt", "updatedAt");
CREATE INDEX IF NOT EXISTS "Product_status_deletedAt_createdAt_idx" ON "Product"("status", "deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_status_deletedAt_categoryId_idx" ON "Product"("status", "deletedAt", "categoryId");
CREATE INDEX IF NOT EXISTS "Product_status_deletedAt_isBestseller_createdAt_idx" ON "Product"("status", "deletedAt", "isBestseller", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_status_deletedAt_isNewArrival_createdAt_idx" ON "Product"("status", "deletedAt", "isNewArrival", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_caratTotal_idx" ON "Product"("caratTotal");

-- ProductVariant
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_sortOrder_idx" ON "ProductVariant"("productId", "sortOrder");
CREATE INDEX IF NOT EXISTS "ProductVariant_isActive_stockQty_reservedQty_idx" ON "ProductVariant"("isActive", "stockQty", "reservedQty");

-- ProductFacetValue & InventoryTransaction
CREATE INDEX IF NOT EXISTS "ProductFacetValue_optionId_idx" ON "ProductFacetValue"("optionId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_referenceType_referenceId_reason_idx" ON "InventoryTransaction"("referenceType", "referenceId", "reason");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_createdAt_idx" ON "InventoryTransaction"("createdAt");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_actorId_idx" ON "InventoryTransaction"("actorId");

-- Cart, CartItem & WishlistItem
CREATE INDEX IF NOT EXISTS "Cart_expiresAt_idx" ON "Cart"("expiresAt");
CREATE INDEX IF NOT EXISTS "CartItem_variantId_idx" ON "CartItem"("variantId");
CREATE INDEX IF NOT EXISTS "WishlistItem_variantId_idx" ON "WishlistItem"("variantId");

-- Order & OrderItem
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_shippingZoneId_idx" ON "Order"("shippingZoneId");
CREATE INDEX IF NOT EXISTS "Order_trackingNumber_idx" ON "Order"("trackingNumber");
CREATE INDEX IF NOT EXISTS "Order_orderNumber_trgm_idx" ON "Order" USING gin ("orderNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Order_trackingNumber_trgm_idx" ON "Order" USING gin ("trackingNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- ShippingZone & Banner
CREATE INDEX IF NOT EXISTS "ShippingZone_isActive_sortOrder_idx" ON "ShippingZone"("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "Banner_isActive_position_sortOrder_idx" ON "Banner"("isActive", "position", "sortOrder");

-- Enquiry, NewsletterSubscriber & AuditLog
CREATE INDEX IF NOT EXISTS "Enquiry_createdAt_idx" ON "Enquiry"("createdAt");
CREATE INDEX IF NOT EXISTS "Enquiry_productId_idx" ON "Enquiry"("productId");
CREATE INDEX IF NOT EXISTS "Enquiry_userId_idx" ON "Enquiry"("userId");
CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_createdAt_idx" ON "NewsletterSubscriber"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_createdAt_idx" ON "AuditLog"("entityType", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CustomizationRequest
CREATE INDEX IF NOT EXISTS "customization_requests_createdAt_idx" ON "customization_requests"("createdAt");
CREATE INDEX IF NOT EXISTS "customization_requests_status_reminder24hSentAt_quoteExpi_idx" ON "customization_requests"("status", "reminder24hSentAt", "quoteExpiresAt");
CREATE INDEX IF NOT EXISTS "customization_requests_assignedToId_idx" ON "customization_requests"("assignedToId");
CREATE INDEX IF NOT EXISTS "customization_requests_reviewedById_idx" ON "customization_requests"("reviewedById");
CREATE INDEX IF NOT EXISTS "customization_requests_variantId_idx" ON "customization_requests"("variantId");

-- Chat models
CREATE INDEX IF NOT EXISTS "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "conversations_userId_lastMessageAt_idx" ON "conversations"("userId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "conversations_status_adminUnreadCount_idx" ON "conversations"("status", "adminUnreadCount");
CREATE INDEX IF NOT EXISTS "conversations_status_updatedAt_idx" ON "conversations"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "messages_senderId_idx" ON "messages"("senderId");
CREATE INDEX IF NOT EXISTS "attachments_expiresAt_idx" ON "attachments"("expiresAt");
CREATE INDEX IF NOT EXISTS "attachments_uploaderId_idx" ON "attachments"("uploaderId");
CREATE INDEX IF NOT EXISTS "conversation_notes_authorId_idx" ON "conversation_notes"("authorId");
