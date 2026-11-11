-- Enable full-text accent stripping and trigram fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Trigger function to maintain weighted tsvector on Product rows
CREATE OR REPLACE FUNCTION product_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', unaccent(coalesce(NEW.name, ''))), 'A') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW.sku, ''))), 'A') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW.subtitle, ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW."metalType", ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW."stoneShape", ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW."stoneOrigin", ''))), 'B') ||
    setweight(to_tsvector('english', unaccent(coalesce(NEW.description, ''))), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_search_vector ON "Product";
CREATE TRIGGER trg_product_search_vector
  BEFORE INSERT OR UPDATE ON "Product"
  FOR EACH ROW EXECUTE FUNCTION product_search_vector_update();

-- GIN indexes for weighted full-text search and trigram typo tolerance
CREATE INDEX IF NOT EXISTS product_search_vector_idx
  ON "Product" USING GIN ("searchVector");

CREATE INDEX IF NOT EXISTS product_name_trgm_idx
  ON "Product" USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_sku_trgm_idx
  ON "Product" USING GIN (sku gin_trgm_ops);

-- Domain integrity CHECK constraints
ALTER TABLE "ProductVariant"
  ADD CONSTRAINT variant_stock_nonneg
  CHECK ("stockQty" >= 0 AND "reservedQty" >= 0 AND "reservedQty" <= "stockQty");

ALTER TABLE "Product"
  ADD CONSTRAINT product_price_nonneg
  CHECK ("basePrice" >= 0);

ALTER TABLE "Order"
  ADD CONSTRAINT order_totals_nonneg
  CHECK ("subtotal" >= 0 AND "shippingCost" >= 0 AND "taxAmount" >= 0 AND "total" >= 0);

ALTER TABLE "CartItem"
  ADD CONSTRAINT cartitem_qty_positive
  CHECK ("quantity" > 0);

-- Monotonic order number sequence (formatted in application code as ORD-YYYY-NNNNN)
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 10001;

