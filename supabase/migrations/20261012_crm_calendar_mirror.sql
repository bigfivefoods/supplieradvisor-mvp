-- Read-only copy of the connected user's other Apple calendars.
-- These rows are shown on that person's diary. They are not company tasks.
-- Paste the root copy RUN_THIS_FOR_CALENDAR_MIRROR.sql if you are rebuilding a database.

CREATE TABLE IF NOT EXISTS public.crm_calendar_mirror (
  id BIGSERIAL PRIMARY KEY,
  link_id BIGINT NOT NULL REFERENCES public.crm_calendar_links (id) ON DELETE CASCADE,
  profile_id BIGINT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  starts_on DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (link_id, remote_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_calendar_mirror_user
  ON public.crm_calendar_mirror (profile_id, user_id, starts_on);

ALTER TABLE public.crm_calendar_mirror ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.crm_calendar_mirror FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.crm_calendar_mirror TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.crm_calendar_mirror_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';
