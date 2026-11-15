-- Abandoned-cart reminder and post-delivery feedback email markers.
ALTER TABLE "Cart" ADD COLUMN IF NOT EXISTS "recoveryEmailSentAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reviewRequestSentAt" TIMESTAMP(3);
