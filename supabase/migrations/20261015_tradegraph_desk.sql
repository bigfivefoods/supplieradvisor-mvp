-- TradeAdvisor® desk: job board statuses and the programme document.
-- Safe to re-run. Do not apply from the app. Not applied to the live database
-- by this change.

ALTER TABLE public.trade_jobs DROP CONSTRAINT IF EXISTS trade_jobs_status_check;
ALTER TABLE public.trade_jobs
  ADD CONSTRAINT trade_jobs_status_check CHECK (
    status IN (
      'enquiry',
      'quoted',
      'scheduled',
      'in_progress',
      'done',
      'invoiced',
      'paid',
      'cancelled'
    )
  );

ALTER TABLE public.trade_workspaces
  ADD COLUMN IF NOT EXISTS desk jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.trade_workspaces.desk IS
  'Price book, Gantt programmes, variation orders, team, and customer PWA extras. Read and written by the service role after company access checks.';

NOTIFY pgrst, 'reload schema';
