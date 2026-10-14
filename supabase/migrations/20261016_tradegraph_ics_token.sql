-- TradeAdvisor® private calendar subscribe secret.
-- Safe to re-run. Do not apply from the app. Not applied to the live database
-- by this change. The desk mints and rotates the value; it is not the public book token.

ALTER TABLE public.trade_workspaces
  ADD COLUMN IF NOT EXISTS ics_token text;

ALTER TABLE public.trade_workspaces
  DROP CONSTRAINT IF EXISTS trade_workspaces_ics_token_check;

ALTER TABLE public.trade_workspaces
  ADD CONSTRAINT trade_workspaces_ics_token_check CHECK (
    ics_token IS NULL OR ics_token ~ '^[A-Za-z0-9_-]{32,80}$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_workspaces_ics_token
  ON public.trade_workspaces (ics_token)
  WHERE ics_token IS NOT NULL;

COMMENT ON COLUMN public.trade_workspaces.ics_token IS
  'Private calendar subscribe secret for the tradesperson. At least 128 bits. Not the public book token, and not shown to customers or in the embed. Rotated from the desk.';

NOTIFY pgrst, 'reload schema';
