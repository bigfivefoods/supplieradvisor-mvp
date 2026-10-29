-- GymAdvisor® merge audit. The member book stays in company_module_stores
-- (module = fitgraph). This table only records a merge after the JSON book
-- has already been updated by the desk. It does not store member rows and it
-- does not unique-constrain email or phone: households share those, and the
-- live book already contains duplicates that a unique index would reject.
--
-- Not applied by this change. Do not run it against production
-- (onkklullmgrdqoertngp). Staging only, after review.

CREATE TABLE IF NOT EXISTS public.gym_member_merge_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keeper_client_id text NOT NULL,
  donor_client_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  actor_user_id text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gym_member_merge_audit_company_created
  ON public.gym_member_merge_audit (company_id, created_at DESC);

ALTER TABLE public.gym_member_merge_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.gym_member_merge_audit FORCE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN
  NULL;
END $$;

DROP POLICY IF EXISTS gym_member_merge_audit_deny_anon ON public.gym_member_merge_audit;
CREATE POLICY gym_member_merge_audit_deny_anon
  ON public.gym_member_merge_audit
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS gym_member_merge_audit_company_read ON public.gym_member_merge_audit;
CREATE POLICY gym_member_merge_audit_company_read
  ON public.gym_member_merge_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.business_users bu
      WHERE bu.profile_id = gym_member_merge_audit.company_id
        AND bu.status = 'active'
        AND (
          bu.user_id = auth.uid()::text
          OR bu.user_id = COALESCE(auth.jwt() ->> 'sub', '')
        )
    )
  );

REVOKE ALL ON TABLE public.gym_member_merge_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.gym_member_merge_audit TO authenticated;
GRANT ALL ON TABLE public.gym_member_merge_audit TO service_role;

COMMENT ON TABLE public.gym_member_merge_audit IS
  'Per-company audit of GymAdvisor member merges. The JSON fitgraph book remains the source of truth.';
