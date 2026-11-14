-- Index tuning
-- Foreign key used when deleting/updating facets and when listing categories per facet.
CREATE INDEX IF NOT EXISTS "CategoryFacet_facetId_idx" ON "CategoryFacet"("facetId");
-- Redundant: a btree on ("conversationId", seq) is scanned backwards for ORDER BY seq DESC.
DROP INDEX IF EXISTS "messages_conversationId_seq_desc_idx";

-- Lock down the public schema for hosted Postgres (Supabase exposes `public` over its REST API
-- to the `anon`/`authenticated` roles). The app connects as the table owner through Prisma,
-- which bypasses RLS, so enabling RLS with no policies blocks only the public API.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated';
    -- Tables created by future migrations stay private too.
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';
  END IF;
END $$;
