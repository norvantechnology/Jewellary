-- Rollback for 20261112163500_backend_perf_indexes

DROP INDEX IF EXISTS "conversation_notes_authorId_idx";
DROP INDEX IF EXISTS "attachments_uploaderId_idx";
DROP INDEX IF EXISTS "attachments_expiresAt_idx";
DROP INDEX IF EXISTS "messages_senderId_idx";
DROP INDEX IF EXISTS "conversations_status_updatedAt_idx";
DROP INDEX IF EXISTS "conversations_status_adminUnreadCount_idx";
DROP INDEX IF EXISTS "conversations_userId_lastMessageAt_idx";
DROP INDEX IF EXISTS "conversations_lastMessageAt_idx";

DROP INDEX IF EXISTS "customization_requests_variantId_idx";
DROP INDEX IF EXISTS "customization_requests_reviewedById_idx";
DROP INDEX IF EXISTS "customization_requests_assignedToId_idx";
DROP INDEX IF EXISTS "customization_requests_status_reminder24hSentAt_quoteExpi_idx";
DROP INDEX IF EXISTS "customization_requests_createdAt_idx";

DROP INDEX IF EXISTS "AuditLog_actorId_idx";
DROP INDEX IF EXISTS "AuditLog_entityType_createdAt_idx";
DROP INDEX IF EXISTS "NewsletterSubscriber_createdAt_idx";
DROP INDEX IF EXISTS "Enquiry_userId_idx";
DROP INDEX IF EXISTS "Enquiry_productId_idx";
DROP INDEX IF EXISTS "Enquiry_createdAt_idx";

DROP INDEX IF EXISTS "Banner_isActive_position_sortOrder_idx";
DROP INDEX IF EXISTS "ShippingZone_isActive_sortOrder_idx";

DROP INDEX IF EXISTS "OrderItem_variantId_idx";
DROP INDEX IF EXISTS "OrderItem_productId_idx";
DROP INDEX IF EXISTS "Order_trackingNumber_trgm_idx";
DROP INDEX IF EXISTS "Order_orderNumber_trgm_idx";
DROP INDEX IF EXISTS "Order_trackingNumber_idx";
DROP INDEX IF EXISTS "Order_shippingZoneId_idx";
DROP INDEX IF EXISTS "Order_status_createdAt_idx";
DROP INDEX IF EXISTS "Order_createdAt_idx";

DROP INDEX IF EXISTS "WishlistItem_variantId_idx";
DROP INDEX IF EXISTS "CartItem_variantId_idx";
DROP INDEX IF EXISTS "Cart_expiresAt_idx";

DROP INDEX IF EXISTS "InventoryTransaction_actorId_idx";
DROP INDEX IF EXISTS "InventoryTransaction_createdAt_idx";
DROP INDEX IF EXISTS "InventoryTransaction_referenceType_referenceId_reason_idx";
DROP INDEX IF EXISTS "ProductFacetValue_optionId_idx";

DROP INDEX IF EXISTS "ProductVariant_isActive_stockQty_reservedQty_idx";
DROP INDEX IF EXISTS "ProductVariant_productId_sortOrder_idx";

DROP INDEX IF EXISTS "Product_caratTotal_idx";
DROP INDEX IF EXISTS "Product_status_deletedAt_isNewArrival_createdAt_idx";
DROP INDEX IF EXISTS "Product_status_deletedAt_isBestseller_createdAt_idx";
DROP INDEX IF EXISTS "Product_status_deletedAt_categoryId_idx";
DROP INDEX IF EXISTS "Product_status_deletedAt_createdAt_idx";
DROP INDEX IF EXISTS "Product_deletedAt_updatedAt_idx";

DROP INDEX IF EXISTS "verification_expiresAt_idx";
DROP INDEX IF EXISTS "session_expiresAt_idx";

DROP INDEX IF EXISTS "user_email_trgm_idx";
DROP INDEX IF EXISTS "user_name_trgm_idx";
DROP INDEX IF EXISTS "user_role_anonymizedAt_createdAt_idx";
DROP INDEX IF EXISTS "user_createdAt_idx";
