-- ISP ↔ Agency association (same pattern as school_agency_links)
-- ISP requests join → DBE/PEU/DoH must approve before schools under that agency can trade with them

CREATE TABLE IF NOT EXISTS public.nsnp_isp_agency_links (
  id bigserial PRIMARY KEY,
  isp_profile_id bigint NOT NULL, -- company id of ISP
  agency_profile_id bigint NOT NULL, -- company id of DBE/PEU/DoH
  status text NOT NULL DEFAULT 'pending',
  -- pending | active | suspended | left | rejected
  requested_by text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  reviewed_by text,
  notes text,
  rejection_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (isp_profile_id, agency_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_isp_agency_links_isp
  ON public.nsnp_isp_agency_links (isp_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_isp_agency_links_agency
  ON public.nsnp_isp_agency_links (agency_profile_id, status);

COMMENT ON TABLE public.nsnp_isp_agency_links IS
  'ISP requests association with DBE/PEU/DoH; agency must approve before schools under that agency can order from the ISP';
