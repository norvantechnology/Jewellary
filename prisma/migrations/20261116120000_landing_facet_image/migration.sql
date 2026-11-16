-- Admin-chosen thumbnail for shape landing pages ("Shop by shape" tiles).
ALTER TABLE "landing_facets" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- Separate card thumbnail for categories (the banner image is wide, cards are portrait).
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
