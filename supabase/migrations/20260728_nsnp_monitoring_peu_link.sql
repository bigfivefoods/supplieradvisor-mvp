-- Link NSNP monitoring tool submissions to planned PEU visits
SELECT public.sa_add_column('nsnp_monitoring_tools', 'peu_visit_id', 'bigint');

CREATE INDEX IF NOT EXISTS idx_nsnp_monitoring_peu_visit
  ON public.nsnp_monitoring_tools (peu_visit_id);

COMMENT ON COLUMN public.nsnp_monitoring_tools.peu_visit_id IS
  'Optional link to nsnp_peu_visits.id — planned PEU visit completed via full KZN monitoring form.';
