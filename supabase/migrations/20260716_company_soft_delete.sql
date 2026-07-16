-- Soft-delete companies (profiles) without hard-wiping trade history.
CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=p_table AND column_name=p_column
  ) THEN
    IF p_default IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    ELSE
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s', p_table, p_column, p_type, p_default);
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

SELECT public.sa_add_column('profiles', 'deleted_at', 'timestamptz');
SELECT public.sa_add_column('profiles', 'deleted_by', 'text');
SELECT public.sa_add_column('profiles', 'deletion_reason', 'text');

COMMENT ON COLUMN public.profiles.deleted_at IS
  'Soft-delete timestamp. Non-null companies are hidden from membership and discovery.';
COMMENT ON COLUMN public.profiles.deleted_by IS
  'Privy user id of owner who requested deletion.';
COMMENT ON COLUMN public.profiles.deletion_reason IS
  'Optional free-text reason supplied at delete time.';

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;
