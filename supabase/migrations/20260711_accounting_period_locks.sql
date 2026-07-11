-- Accounting period locks (YYYY-MM)
CREATE TABLE IF NOT EXISTS accounting_period_locks (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  period_key TEXT NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_period_locks_profile
  ON accounting_period_locks (profile_id, period_key DESC);

ALTER TABLE accounting_period_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounting_period_locks_deny_anon ON accounting_period_locks;
CREATE POLICY accounting_period_locks_deny_anon ON accounting_period_locks
  FOR ALL TO anon USING (false) WITH CHECK (false);

COMMENT ON TABLE accounting_period_locks IS
  'Month-end locks — posted journals blocked for locked YYYY-MM periods';
