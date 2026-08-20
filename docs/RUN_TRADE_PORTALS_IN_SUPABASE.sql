-- Guest customer / supplier portals.
-- People who have not joined SupplierAdvisor get a branded link to the
-- quotes, invoices, POs, and documents that belong to them.
-- Safe to re-run. App uses service role after JWT + membership checks.

CREATE TABLE IF NOT EXISTS public.trade_portals (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  public_token text NOT NULL,
  title text,
  welcome_message text,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_portals_kind_check CHECK (kind IN ('customer', 'supplier')),
  CONSTRAINT trade_portals_status_check CHECK (status IN ('active', 'paused')),
  UNIQUE (profile_id, kind)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_portals_public_token
  ON public.trade_portals (public_token);

CREATE INDEX IF NOT EXISTS idx_trade_portals_profile
  ON public.trade_portals (profile_id);

CREATE TABLE IF NOT EXISTS public.trade_portal_viewers (
  id bigserial PRIMARY KEY,
  portal_id bigint NOT NULL REFERENCES public.trade_portals(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  job_title text,
  token text NOT NULL,
  customer_id bigint,
  supplier_id bigint,
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamptz,
  invited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_portal_viewers_status_check CHECK (status IN ('active', 'revoked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_portal_viewers_token
  ON public.trade_portal_viewers (token);

CREATE INDEX IF NOT EXISTS idx_trade_portal_viewers_portal
  ON public.trade_portal_viewers (portal_id, status);

CREATE INDEX IF NOT EXISTS idx_trade_portal_viewers_profile
  ON public.trade_portal_viewers (profile_id, status);

CREATE INDEX IF NOT EXISTS idx_trade_portal_viewers_customer
  ON public.trade_portal_viewers (profile_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trade_portal_viewers_supplier
  ON public.trade_portal_viewers (profile_id, supplier_id)
  WHERE supplier_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('trade_portals');
    PERFORM public.sa_lock_table('trade_portal_viewers');
  ELSE
    ALTER TABLE public.trade_portals ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.trade_portal_viewers ENABLE ROW LEVEL SECURITY;
    BEGIN
      ALTER TABLE public.trade_portals FORCE ROW LEVEL SECURITY;
      ALTER TABLE public.trade_portal_viewers FORCE ROW LEVEL SECURITY;
    EXCEPTION WHEN others THEN
      NULL;
    END;
    DROP POLICY IF EXISTS sa_deny_anon ON public.trade_portals;
    DROP POLICY IF EXISTS sa_deny_authenticated ON public.trade_portals;
    CREATE POLICY sa_deny_anon ON public.trade_portals
      FOR ALL TO anon USING (false) WITH CHECK (false);
    CREATE POLICY sa_deny_authenticated ON public.trade_portals
      FOR ALL TO authenticated USING (false) WITH CHECK (false);
    DROP POLICY IF EXISTS sa_deny_anon ON public.trade_portal_viewers;
    DROP POLICY IF EXISTS sa_deny_authenticated ON public.trade_portal_viewers;
    CREATE POLICY sa_deny_anon ON public.trade_portal_viewers
      FOR ALL TO anon USING (false) WITH CHECK (false);
    CREATE POLICY sa_deny_authenticated ON public.trade_portal_viewers
      FOR ALL TO authenticated USING (false) WITH CHECK (false);
    REVOKE ALL ON TABLE public.trade_portals FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON TABLE public.trade_portal_viewers FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

GRANT ALL ON TABLE public.trade_portals TO service_role;
GRANT ALL ON TABLE public.trade_portal_viewers TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trade_portals_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trade_portal_viewers_id_seq TO service_role;

COMMENT ON TABLE public.trade_portals IS
  'One guest portal per company per kind (customer | supplier). Browser has no table access.';
COMMENT ON TABLE public.trade_portal_viewers IS
  'Named people who can open a guest portal link without joining the OS.';

NOTIFY pgrst, 'reload schema';
