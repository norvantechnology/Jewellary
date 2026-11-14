-- Admin overrides for storefront page content (defaults live in data/frontend/site-content.json).
CREATE TABLE IF NOT EXISTS "site_content" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "data" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("id")
);

-- Repair drift: this index from 20261112163500_backend_perf_indexes was missing in some databases.
CREATE INDEX IF NOT EXISTS "conversations_status_adminUnreadCount_idx" ON "conversations"("status", "adminUnreadCount");
