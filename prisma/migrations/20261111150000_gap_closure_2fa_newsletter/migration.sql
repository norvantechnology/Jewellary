-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED');

-- AlterTable
ALTER TABLE "NewsletterSubscriber"
  ADD COLUMN "confirmTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "confirmTokenHash" TEXT,
  ADD COLUMN "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "status" "NewsletterStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "unsubscribeToken" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- Backfill unsubscribeToken and status for any existing rows
UPDATE "NewsletterSubscriber"
SET
  "unsubscribeToken" = COALESCE("unsubscribeToken", md5("id" || clock_timestamp()::text || random()::text)),
  "status" = CASE WHEN "unsubscribedAt" IS NOT NULL THEN 'UNSUBSCRIBED'::"NewsletterStatus" ELSE 'CONFIRMED'::"NewsletterStatus" END,
  "verifiedAt" = CASE WHEN "unsubscribedAt" IS NULL THEN "createdAt" ELSE NULL END;

ALTER TABLE "NewsletterSubscriber"
  ALTER COLUMN "unsubscribeToken" SET NOT NULL;

-- AlterTable
ALTER TABLE "StoreSetting"
  ADD COLUMN "requireAdminTwoFactor" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user"
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_confirmTokenHash_key" ON "NewsletterSubscriber"("confirmTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_unsubscribeToken_key" ON "NewsletterSubscriber"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_status_createdAt_idx" ON "NewsletterSubscriber"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

