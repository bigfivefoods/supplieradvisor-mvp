-- Personal (user-scoped) message inbox — deliver by platform user id from any module.
-- Threads are dual-written here in addition to company_inbox so a user receives
-- messages even when not viewing a particular company workspace.

CREATE TABLE IF NOT EXISTS public.platform_user_inboxes (
  user_id text PRIMARY KEY,
  threads jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_user_inboxes_updated
  ON public.platform_user_inboxes (updated_at DESC);

COMMENT ON TABLE public.platform_user_inboxes IS
  'System-wide personal message inbox keyed by Privy / platform user id.';
