-- SaaS reliability: Paystack webhook idempotency, serialize module-store
-- writes, extra token indexes. Safe to re-run after 20260821_saas_db_harden.sql.
-- Paste in the Supabase SQL editor. SELECT sa_ensure_reliability();

SET statement_timeout = 0;

CREATE TABLE IF NOT EXISTS public.paystack_webhook_events (
  reference text NOT NULL,
  event text NOT NULL,
  handled text,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1,
  PRIMARY KEY (reference, event)
);

CREATE INDEX IF NOT EXISTS idx_paystack_webhook_events_last
  ON public.paystack_webhook_events (last_at DESC);

CREATE OR REPLACE FUNCTION public.sa_claim_paystack_webhook(
  p_reference text,
  p_event text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.paystack_webhook_events%ROWTYPE;
  ref text;
  ev text;
BEGIN
  ref := NULLIF(trim(COALESCE(p_reference, '')), '');
  ev := NULLIF(trim(COALESCE(p_event, '')), '');
  IF ref IS NULL OR ev IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'first', true, 'hits', 0);
  END IF;

  INSERT INTO public.paystack_webhook_events (reference, event, hits, first_at, last_at)
  VALUES (ref, ev, 1, now(), now())
  ON CONFLICT (reference, event) DO UPDATE
    SET
      hits = public.paystack_webhook_events.hits + 1,
      last_at = now()
  RETURNING * INTO rec;

  RETURN jsonb_build_object(
    'ok', true,
    'first', rec.hits = 1,
    'hits', rec.hits,
    'handled', rec.handled
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_mark_paystack_webhook(
  p_reference text,
  p_event text,
  p_handled text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.paystack_webhook_events
  SET handled = NULLIF(trim(COALESCE(p_handled, '')), ''), last_at = now()
  WHERE reference = NULLIF(trim(COALESCE(p_reference, '')), '')
    AND event = NULLIF(trim(COALESCE(p_event, '')), '');
END;
$$;

-- Serialize gym/clinic store writes so two desk saves cannot interleave
-- on the same (company, module) row. Signature unchanged.
CREATE OR REPLACE FUNCTION public.sa_put_module_store(
  p_company_id integer,
  p_module text,
  p_data jsonb,
  p_indexes jsonb DEFAULT '{}'::jsonb,
  p_public_token text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  idx jsonb;
BEGIN
  PERFORM public.sa_assert_advisor_module(p_module);
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RAISE EXCEPTION 'company id required';
  END IF;
  PERFORM pg_advisory_xact_lock(p_company_id, hashtext(p_module));
  idx := public.sa_module_index_patch(p_module, p_indexes);

  INSERT INTO public.company_module_stores (
    company_id, module, data, public_token, updated_at
  )
  VALUES (
    p_company_id,
    p_module,
    COALESCE(p_data, '{}'::jsonb),
    NULLIF(trim(COALESCE(p_public_token, '')), ''),
    now()
  )
  ON CONFLICT (company_id, module) DO UPDATE
    SET
      data = EXCLUDED.data,
      public_token = COALESCE(
        EXCLUDED.public_token,
        public.company_module_stores.public_token
      ),
      updated_at = now();

  IF idx <> '{}'::jsonb THEN
    PERFORM public.sa_merge_profile_metadata(p_company_id, idx);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_ensure_reliability()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_idx integer := 0;
  idx_result text;
  stmt text;
  statements text[];
BEGIN
  statements := ARRAY[
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_company_module_stores_public_token_uid ON public.company_module_stores (public_token) WHERE public_token IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_company_module_stores_updated ON public.company_module_stores (updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_profiles_psychiatrygraph_patient_tokens ON public.profiles USING gin ((metadata -> ''psychiatrygraph_patient_tokens'')) WHERE metadata ? ''psychiatrygraph_patient_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_dentalgraph_patient_tokens ON public.profiles USING gin ((metadata -> ''dentalgraph_patient_tokens'')) WHERE metadata ? ''dentalgraph_patient_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_hiregraph_customer_tokens ON public.profiles USING gin ((metadata -> ''hiregraph_customer_tokens'')) WHERE metadata ? ''hiregraph_customer_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_fitgraph_staff_tokens ON public.profiles USING gin ((metadata -> ''fitgraph_staff_tokens'')) WHERE metadata ? ''fitgraph_staff_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_physiograph_staff_tokens ON public.profiles USING gin ((metadata -> ''physiograph_staff_tokens'')) WHERE metadata ? ''physiograph_staff_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_medicalgraph_staff_tokens ON public.profiles USING gin ((metadata -> ''medicalgraph_staff_tokens'')) WHERE metadata ? ''medicalgraph_staff_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_psychiatrygraph_staff_tokens ON public.profiles USING gin ((metadata -> ''psychiatrygraph_staff_tokens'')) WHERE metadata ? ''psychiatrygraph_staff_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_dentalgraph_staff_tokens ON public.profiles USING gin ((metadata -> ''dentalgraph_staff_tokens'')) WHERE metadata ? ''dentalgraph_staff_tokens''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_physiograph_public_token ON public.profiles ((metadata->>''physiograph_public_token'')) WHERE metadata ? ''physiograph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_medicalgraph_public_token ON public.profiles ((metadata->>''medicalgraph_public_token'')) WHERE metadata ? ''medicalgraph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_psychiatrygraph_public_token ON public.profiles ((metadata->>''psychiatrygraph_public_token'')) WHERE metadata ? ''psychiatrygraph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_profiles_dentalgraph_public_token ON public.profiles ((metadata->>''dentalgraph_public_token'')) WHERE metadata ? ''dentalgraph_public_token''',
    'CREATE INDEX IF NOT EXISTS idx_customers_profile_email ON public.customers (profile_id, lower(email)) WHERE email IS NOT NULL AND length(trim(email)) > 3',
    'CREATE INDEX IF NOT EXISTS idx_business_users_active_email ON public.business_users (lower(email)) WHERE status = ''active'' AND email IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_business_users_active_invited_email ON public.business_users (lower(invited_email)) WHERE status = ''active'' AND invited_email IS NOT NULL'
  ];
  FOREACH stmt IN ARRAY statements
  LOOP
    BEGIN
      EXECUTE stmt;
      n_idx := n_idx + 1;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('paystack_webhook_events');
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'trade_portals'
    ) THEN
      PERFORM public.sa_lock_table('trade_portals');
      PERFORM public.sa_lock_table('trade_portal_viewers');
    END IF;
  END IF;

  BEGIN
    GRANT ALL ON TABLE public.paystack_webhook_events TO service_role;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'hot_indexes_ok', n_idx);
END;
$$;

REVOKE ALL ON FUNCTION public.sa_claim_paystack_webhook(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_mark_paystack_webhook(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sa_ensure_reliability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paystack_webhook_events FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sa_claim_paystack_webhook(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_mark_paystack_webhook(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_ensure_reliability() TO service_role;
GRANT ALL ON TABLE public.paystack_webhook_events TO service_role;

SELECT public.sa_ensure_reliability();

NOTIFY pgrst, 'reload schema';
