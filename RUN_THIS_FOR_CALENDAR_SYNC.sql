-- Two-way sales diary links to Google, Outlook, and Apple.
-- Does not copy events. Paste the root copy RUN_THIS_FOR_CALENDAR_SYNC.sql if you are rebuilding a database.

CREATE TABLE IF NOT EXISTS public.crm_calendar_links (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_email TEXT,
  calendar_id TEXT,
  calendar_name TEXT,
  secret_enc TEXT,
  sync_cursor TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_crm_calendar_links_profile
  ON public.crm_calendar_links (profile_id, user_id);

CREATE TABLE IF NOT EXISTS public.crm_calendar_bindings (
  id BIGSERIAL PRIMARY KEY,
  link_id BIGINT NOT NULL REFERENCES public.crm_calendar_links (id) ON DELETE CASCADE,
  profile_id BIGINT NOT NULL,
  local_key TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  remote_etag TEXT,
  snapshot TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (link_id, local_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_calendar_bindings_remote
  ON public.crm_calendar_bindings (link_id, remote_id);

ALTER TABLE public.crm_calendar_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_calendar_bindings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.crm_calendar_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_calendar_bindings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.crm_calendar_links TO service_role;
GRANT ALL ON TABLE public.crm_calendar_bindings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.crm_calendar_links_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.crm_calendar_bindings_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';
