-- Guest portal workspace: messages between host and people on the books.
-- Safe to re-run. Depends on 20260822_trade_portals.sql.

CREATE TABLE IF NOT EXISTS public.trade_portal_messages (
  id bigserial PRIMARY KEY,
  portal_id bigint NOT NULL REFERENCES public.trade_portals(id) ON DELETE CASCADE,
  viewer_id bigint NOT NULL REFERENCES public.trade_portal_viewers(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_portal_messages_author_check CHECK (author IN ('host', 'guest'))
);

CREATE INDEX IF NOT EXISTS idx_trade_portal_messages_viewer
  ON public.trade_portal_messages (viewer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_trade_portal_messages_portal
  ON public.trade_portal_messages (portal_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('trade_portal_messages');
  ELSE
    ALTER TABLE public.trade_portal_messages ENABLE ROW LEVEL SECURITY;
    BEGIN
      ALTER TABLE public.trade_portal_messages FORCE ROW LEVEL SECURITY;
    EXCEPTION WHEN others THEN
      NULL;
    END;
    DROP POLICY IF EXISTS sa_deny_anon ON public.trade_portal_messages;
    DROP POLICY IF EXISTS sa_deny_authenticated ON public.trade_portal_messages;
    CREATE POLICY sa_deny_anon ON public.trade_portal_messages
      FOR ALL TO anon USING (false) WITH CHECK (false);
    CREATE POLICY sa_deny_authenticated ON public.trade_portal_messages
      FOR ALL TO authenticated USING (false) WITH CHECK (false);
    REVOKE ALL ON TABLE public.trade_portal_messages FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

GRANT ALL ON TABLE public.trade_portal_messages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trade_portal_messages_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';
