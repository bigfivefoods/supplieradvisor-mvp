-- Ensure school ↔ SP link claim/accept columns exist.
-- Fixes: "Could not find the 'accepted_at' column of 'school_isp_links' in the schema cache"
-- (idempotent — safe if 20260727_school_isp_claims.sql already applied)

ALTER TABLE public.school_isp_links
  ADD COLUMN IF NOT EXISTS requested_by text;

ALTER TABLE public.school_isp_links
  ADD COLUMN IF NOT EXISTS requested_at timestamptz;

ALTER TABLE public.school_isp_links
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

ALTER TABLE public.school_isp_links
  ADD COLUMN IF NOT EXISTS requested_by_user_id text;

CREATE INDEX IF NOT EXISTS idx_school_isp_links_status
  ON public.school_isp_links (status);

CREATE INDEX IF NOT EXISTS idx_school_isp_links_isp_status
  ON public.school_isp_links (isp_profile_id, status);

COMMENT ON COLUMN public.school_isp_links.requested_by IS
  'Who initiated: isp (claim) or school (invite/link)';
COMMENT ON COLUMN public.school_isp_links.accepted_at IS
  'When the link became active (school accepted SP, or school linked SP)';
COMMENT ON COLUMN public.school_isp_links.status IS
  'pending | active | rejected | blocked | left';

-- Nudge PostgREST / Supabase schema cache after DDL (no-op if not supported)
NOTIFY pgrst, 'reload schema';
