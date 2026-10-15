-- ConstructionAdvisor® portal guess counter.
-- Idempotent. Run top to bottom in the SQL editor.
-- Not applied to any live database by this change. Until Craig applies it,
-- portal reads still work and use only the in-memory limiter.
--
-- Rollback (manual, after Craig approves):
--   DROP FUNCTION IF EXISTS public.construction_portal_is_throttled(text);
--   DROP FUNCTION IF EXISTS public.construction_portal_register_failure(text);
--   DROP TABLE IF EXISTS public.construction_portal_attempts;

CREATE TABLE IF NOT EXISTS public.construction_portal_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_hash text NOT NULL,
  at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_construction_portal_attempts_key_recent
  ON public.construction_portal_attempts (key_hash, at DESC);

ALTER TABLE public.construction_portal_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_portal_attempts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.construction_portal_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.construction_portal_attempts TO service_role;
REVOKE ALL ON SEQUENCE public.construction_portal_attempts_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.construction_portal_attempts_id_seq TO service_role;

DROP POLICY IF EXISTS sa_deny_anon ON public.construction_portal_attempts;
DROP POLICY IF EXISTS sa_deny_authenticated ON public.construction_portal_attempts;
CREATE POLICY sa_deny_anon ON public.construction_portal_attempts
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sa_deny_authenticated ON public.construction_portal_attempts
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

COMMENT ON TABLE public.construction_portal_attempts IS
  'Salted SHA-256 of a client IP after a failed ConstructionAdvisor® portal lookup. Never a raw IP and never a token.';

-- Fail closed on a null or empty key. Deletes this key''s rows older than 24 hours.
CREATE OR REPLACE FUNCTION public.construction_portal_register_failure(p_key_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_key_hash IS NULL OR pg_catalog.btrim(p_key_hash) = '' THEN
    RAISE EXCEPTION 'construction_portal_register_failure_closed'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.construction_portal_attempts
  WHERE key_hash = p_key_hash
    AND at < pg_catalog.now() - interval '24 hours';

  INSERT INTO public.construction_portal_attempts (key_hash)
  VALUES (p_key_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.construction_portal_register_failure(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.construction_portal_register_failure(text) TO service_role;

COMMENT ON FUNCTION public.construction_portal_register_failure(text) IS
  'Records one failed ConstructionAdvisor® portal lookup for a salted IP hash.';

-- Throttled when one key hash has more than 30 failures in 15 minutes.
-- A null or empty key is treated as throttled (fail closed).
CREATE OR REPLACE FUNCTION public.construction_portal_is_throttled(p_key_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF p_key_hash IS NULL OR pg_catalog.btrim(p_key_hash) = '' THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.construction_portal_attempts
  WHERE key_hash = p_key_hash
    AND at > pg_catalog.now() - interval '15 minutes';

  RETURN v_count > 30;
END;
$$;

REVOKE ALL ON FUNCTION public.construction_portal_is_throttled(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.construction_portal_is_throttled(text) TO service_role;

COMMENT ON FUNCTION public.construction_portal_is_throttled(text) IS
  'True when a ConstructionAdvisor® portal IP hash has more than 30 failures in 15 minutes.';

NOTIFY pgrst, 'reload schema';
