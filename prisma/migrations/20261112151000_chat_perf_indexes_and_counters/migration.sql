-- Add denormalized chat sequence/unread counters + composite/partial/trigram indexes

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "lastMessageSeq" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "customerUnreadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "adminUnreadCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill lastMessageSeq and unread counts from existing messages & participants
WITH msg_stats AS (
  SELECT
    m."conversationId",
    COALESCE(MAX(m."seq"), 0) AS max_seq
  FROM "messages" m
  GROUP BY m."conversationId"
),
part_stats AS (
  SELECT
    p."conversationId",
    COALESCE(MAX(CASE WHEN p."role" = 'CUSTOMER' THEN p."lastReadSeq" ELSE 0 END), 0) AS cust_read_seq,
    COALESCE(MAX(CASE WHEN p."role" IN ('ADMIN', 'STAFF') THEN p."lastReadSeq" ELSE 0 END), 0) AS admin_read_seq
  FROM "conversation_participants" p
  GROUP BY p."conversationId"
),
unread_counts AS (
  SELECT
    m."conversationId",
    COUNT(*) FILTER (WHERE m."senderRole" <> 'CUSTOMER' AND m."seq" > COALESCE(ps.cust_read_seq, 0))::int AS cust_unread,
    COUNT(*) FILTER (WHERE m."senderRole" = 'CUSTOMER' AND m."seq" > COALESCE(ps.admin_read_seq, 0))::int AS admin_unread
  FROM "messages" m
  LEFT JOIN part_stats ps ON ps."conversationId" = m."conversationId"
  GROUP BY m."conversationId"
)
UPDATE "conversations" c
SET
  "lastMessageSeq" = COALESCE(ms.max_seq, 0),
  "customerUnreadCount" = COALESCE(uc.cust_unread, 0),
  "adminUnreadCount" = COALESCE(uc.admin_unread, 0)
FROM msg_stats ms
FULL OUTER JOIN unread_counts uc ON uc."conversationId" = ms."conversationId"
WHERE c."id" = COALESCE(ms."conversationId", uc."conversationId");

-- Composite & partial indexes for chat speed
CREATE INDEX IF NOT EXISTS "conversations_guestToken_status_lastMessageAt_idx"
  ON "conversations" ("guestToken", "status", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "conversation_participants_conversationId_role_idx"
  ON "conversation_participants" ("conversationId", "role");

CREATE INDEX IF NOT EXISTS "messages_conversationId_seq_desc_idx"
  ON "messages" ("conversationId", "seq" DESC);

CREATE INDEX IF NOT EXISTS "messages_conversationId_senderRole_readAt_idx"
  ON "messages" ("conversationId", "senderRole", "readAt");

-- Ensure pg_trgm is available and index Product slug + active featured ordering for fast product picker
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "product_slug_trgm_idx"
  ON "Product" USING gin ("slug" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "product_active_featured_updated_idx"
  ON "Product" ("isFeatured" DESC, "updatedAt" DESC)
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

