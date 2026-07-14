-- =============================================================================
-- FULL RLS SECURITY LOCKDOWN (SupplierAdvisor multi-tenant)
-- =============================================================================
-- Architecture:
--   • Next.js API routes use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS after JWT
--     + company membership checks in app code).
--   • Browser uses NEXT_PUBLIC_SUPABASE_ANON_KEY — must NOT read/write tenant data.
--   • This migration: enable RLS on every public table, DROP open policies
--     (USING true), REVOKE table privileges from anon/authenticated, deny-by-default.
--
-- SAFE TO RE-RUN (idempotent).
-- Run in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';
-- =============================================================================

-- ── Helper: enable RLS + deny anon + deny authenticated ─────────────────────
CREATE OR REPLACE FUNCTION public.sa_lock_table(p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pol record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table AND table_type = 'BASE TABLE'
  ) THEN
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
  -- Force RLS even for table owner (service_role still bypasses)
  BEGIN
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', p_table);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'FORCE RLS % skip: %', p_table, SQLERRM;
  END;

  -- Drop ALL existing policies (including open USING true)
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table);
  END LOOP;

  -- Explicit deny for anon + authenticated (defense in depth)
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
    'sa_deny_anon', p_table
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
    'sa_deny_authenticated', p_table
  );

  -- No privileges for client roles (service_role is superuser / bypass)
  BEGIN
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', p_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', p_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', p_table);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'REVOKE % skip: %', p_table, SQLERRM;
  END;
END;
$$;

-- ── Lock every base table in public ──────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
    ORDER BY tablename
  LOOP
    PERFORM public.sa_lock_table(r.tablename);
    RAISE NOTICE 'Locked: %', r.tablename;
  END LOOP;
END $$;

-- ── Sequences: no client nextval ─────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated', r.sequence_name);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'seq revoke % skip: %', r.sequence_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ── Default privileges for future tables ─────────────────────────────────────
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- Schema usage only (no table access)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── Views: lock if any ───────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', r.table_name);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'view revoke % skip: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- =============================================================================
-- STORAGE (buckets) — block anonymous write/list of private objects
-- Public read only if bucket is intentionally public (logos, container photos).
-- Uploads should prefer server-side service role APIs.
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    -- Drop known open storage policies by name patterns (best-effort)
    -- Admins should review remaining policies in Dashboard → Storage
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
    DROP POLICY IF EXISTS "Give anon users access to JPG images in folder" ON storage.objects;
    DROP POLICY IF EXISTS "Allow anon uploads" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;
    DROP POLICY IF EXISTS "Public read access" ON storage.objects;

    -- Deny all for anon by default on storage.objects
    DROP POLICY IF EXISTS sa_storage_deny_anon ON storage.objects;
    CREATE POLICY sa_storage_deny_anon ON storage.objects
      FOR ALL TO anon USING (false) WITH CHECK (false);

    DROP POLICY IF EXISTS sa_storage_deny_authenticated ON storage.objects;
    CREATE POLICY sa_storage_deny_authenticated ON storage.objects
      FOR ALL TO authenticated USING (false) WITH CHECK (false);

    -- Optional: public READ for known public asset buckets only (not write)
    DROP POLICY IF EXISTS sa_storage_public_read_assets ON storage.objects;
    CREATE POLICY sa_storage_public_read_assets ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (
        bucket_id IN (
          'container-photos',
          'container-images',
          'company-logos',
          'avatars',
          'public'
        )
      );

    RAISE NOTICE 'Storage objects RLS hardened';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Storage lockdown skip: %', SQLERRM;
END $$;

-- =============================================================================
-- SECURITY NOTES (for operators)
-- =============================================================================
-- 1. Service role key MUST stay server-only (Vercel env, never NEXT_PUBLIC_*).
-- 2. All data access goes through Next.js APIs with Privy JWT + membership checks.
-- 3. Browser anon key cannot SELECT/INSERT/UPDATE/DELETE any public table.
-- 4. Storage: public READ only on logo/photo buckets; uploads need service-role API
--    or you must re-open a tightly scoped storage INSERT policy.
-- 5. After run, re-test: login, invoices, containers, inventory, join invite links
--    (join must use /api/public/… not direct client table access).
-- 6. Verify in SQL:
--      SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
--      SELECT * FROM pg_policies WHERE schemaname='public' LIMIT 50;
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.sa_lock_table(text) IS
  'Enable FORCE RLS, drop all policies, deny anon+authenticated on a public table';
