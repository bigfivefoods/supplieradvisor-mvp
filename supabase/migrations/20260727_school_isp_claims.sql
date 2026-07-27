-- SP ↔ school claim / connect flow
-- SP requests (pending) → school accepts (active) or rejects

SELECT public.sa_add_column('school_isp_links', 'requested_by', 'text');
-- requested_by: 'isp' | 'school'
SELECT public.sa_add_column('school_isp_links', 'requested_at', 'timestamptz');
SELECT public.sa_add_column('school_isp_links', 'accepted_at', 'timestamptz');
SELECT public.sa_add_column('school_isp_links', 'requested_by_user_id', 'text');

CREATE INDEX IF NOT EXISTS idx_school_isp_links_status
  ON public.school_isp_links (status);

CREATE INDEX IF NOT EXISTS idx_school_isp_links_isp_status
  ON public.school_isp_links (isp_profile_id, status);

COMMENT ON COLUMN public.school_isp_links.requested_by IS
  'Who initiated: isp (claim) or school (invite/link)';
COMMENT ON COLUMN public.school_isp_links.status IS
  'pending | active | rejected | blocked | left';
