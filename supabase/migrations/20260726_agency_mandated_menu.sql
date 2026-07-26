-- Department (DBE/DoH) mandated menu cycles — schools & SPs inherit live

SELECT public.sa_add_column('school_menu_cycles', 'agency_profile_id', 'bigint');
SELECT public.sa_add_column('school_menu_cycles', 'is_agency_menu', 'boolean', 'false');
SELECT public.sa_add_column('school_menu_cycles', 'published_at', 'timestamptz');
SELECT public.sa_add_column('school_menu_cycles', 'mandatory', 'boolean', 'true');

CREATE INDEX IF NOT EXISTS idx_school_menu_agency
  ON public.school_menu_cycles (agency_profile_id, active)
  WHERE agency_profile_id IS NOT NULL;

COMMENT ON COLUMN public.school_menu_cycles.agency_profile_id IS
  'When set, this menu is owned by DBE/DoH and inherited by associated schools/SPs';
COMMENT ON COLUMN public.school_menu_cycles.is_agency_menu IS
  'True for department-mandated menus (not school-local drafts)';
COMMENT ON COLUMN public.school_menu_cycles.mandatory IS
  'Schools are rated on adherence to this menu when mandatory';
