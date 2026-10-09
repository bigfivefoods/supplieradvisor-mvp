-- Server-side gym member seed. Replaces contract files that used to live in the repo.
-- Service role only. Anon and authenticated roles cannot read or write.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.gym_member_seeds (
  company_id integer PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  import_version text NOT NULL,
  submissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  roster jsonb NOT NULL DEFAULT '[]'::jsonb,
  name_folds jsonb NOT NULL DEFAULT '[]'::jsonb,
  coaches jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gym_member_seeds_submissions_array CHECK (jsonb_typeof(submissions) = 'array'),
  CONSTRAINT gym_member_seeds_roster_array CHECK (jsonb_typeof(roster) = 'array'),
  CONSTRAINT gym_member_seeds_name_folds_array CHECK (jsonb_typeof(name_folds) = 'array'),
  CONSTRAINT gym_member_seeds_coaches_array CHECK (jsonb_typeof(coaches) = 'array')
);

ALTER TABLE public.gym_member_seeds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.gym_member_seeds FORCE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN
  NULL;
END $$;

DROP POLICY IF EXISTS sa_deny_anon ON public.gym_member_seeds;
CREATE POLICY sa_deny_anon ON public.gym_member_seeds
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS sa_deny_authenticated ON public.gym_member_seeds;
CREATE POLICY sa_deny_authenticated ON public.gym_member_seeds
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.gym_member_seeds FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gym_member_seeds TO service_role;

DO $$
BEGIN
  PERFORM public.sa_lock_table('gym_member_seeds');
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

NOTIFY pgrst, 'reload schema';
