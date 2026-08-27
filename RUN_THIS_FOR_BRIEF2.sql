-- Brief 2: hub rollup RPCs, PO idempotency / onchain unique, dunning unique.
-- Safe to re-run. Paste twin: RUN_THIS_FOR_BRIEF2.sql

SET statement_timeout = 0;

-- ── Hub summaries (counts in SQL, tenant = profile_id) ───────────────────────
CREATE OR REPLACE FUNCTION public.sa_customers_hub_summary(
  p_profile_id bigint,
  p_tree_ids bigint[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids bigint[];
  result jsonb := jsonb_build_object('ok', true);
  n bigint;
  pipeline numeric := 0;
  weighted numeric := 0;
  won_value numeric := 0;
BEGIN
  IF p_profile_id IS NULL OR p_profile_id <= 0 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  ids := COALESCE(NULLIF(p_tree_ids, '{}'::bigint[]), ARRAY[p_profile_id]);

  BEGIN
    SELECT COUNT(*) INTO n FROM public.customers WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('customers', n);
    SELECT COUNT(*) INTO n FROM public.customers
      WHERE profile_id = p_profile_id AND status = 'active';
    result := result || jsonb_build_object('customers_active', n);
    SELECT COUNT(*) INTO n FROM public.customers
      WHERE profile_id = p_profile_id AND lower(COALESCE(invite_status, '')) = 'invited';
    result := result || jsonb_build_object('invite_pending', n);
    SELECT COUNT(*) INTO n FROM public.customers
      WHERE profile_id = p_profile_id AND lower(COALESCE(invite_status, '')) = 'accepted';
    result := result || jsonb_build_object('invite_accepted', n);
    SELECT COUNT(*) INTO n FROM public.customers
      WHERE profile_id = p_profile_id AND lower(COALESCE(invite_status, '')) = 'suspended';
    result := result || jsonb_build_object('invite_suspended', n);
    SELECT COUNT(*) INTO n FROM public.customers
      WHERE profile_id = p_profile_id AND lower(COALESCE(invite_status, '')) = 'expired';
    result := result || jsonb_build_object('invite_expired', n);
    SELECT COUNT(*) INTO n FROM public.customers
      WHERE profile_id = p_profile_id AND lower(COALESCE(invite_status, '')) = 'declined';
    result := result || jsonb_build_object('invite_declined', n);
    SELECT COUNT(*) INTO n FROM public.customers
      WHERE profile_id = p_profile_id
        AND (invite_status IS NULL OR lower(invite_status) IN ('', 'not_invited'));
    result := result || jsonb_build_object('invite_not_invited', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'customers', 0, 'customers_active', 0, 'invite_pending', 0, 'invite_accepted', 0,
      'invite_suspended', 0, 'invite_expired', 0, 'invite_declined', 0, 'invite_not_invited', 0
    );
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.leads WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('leads', n);
    SELECT COUNT(*) INTO n FROM public.leads
      WHERE profile_id = p_profile_id
        AND COALESCE(status, '') NOT IN ('converted', 'unqualified', 'recycled');
    result := result || jsonb_build_object('leads_open', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('leads', 0, 'leads_open', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.opportunities WHERE profile_id = ANY (ids);
    result := result || jsonb_build_object('opportunities', n);
    SELECT COUNT(*) INTO n FROM public.opportunities
      WHERE profile_id = ANY (ids)
        AND lower(COALESCE(stage, status, '')) NOT IN ('closed_won', 'closed_lost', 'won', 'lost');
    result := result || jsonb_build_object('opportunities_open', n);
    SELECT COALESCE(SUM(COALESCE(amount, opportunity_size, 0)), 0) INTO pipeline
      FROM public.opportunities
      WHERE profile_id = ANY (ids)
        AND lower(COALESCE(stage, status, '')) NOT IN ('closed_won', 'closed_lost', 'won', 'lost');
    SELECT COALESCE(SUM(COALESCE(amount, opportunity_size, 0)), 0) INTO won_value
      FROM public.opportunities
      WHERE profile_id = ANY (ids)
        AND lower(COALESCE(stage, status, '')) IN ('closed_won', 'won');
    result := result || jsonb_build_object(
      'pipeline_value', pipeline,
      'won_value', won_value,
      'weighted_pipeline', round(pipeline)
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'opportunities', 0, 'opportunities_open', 0, 'pipeline_value', 0, 'won_value', 0, 'weighted_pipeline', 0
    );
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.customer_invitations WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('invitations_total', n);
    SELECT COUNT(*) INTO n FROM public.customer_invitations
      WHERE profile_id = p_profile_id AND lower(COALESCE(status, '')) = 'pending';
    result := result || jsonb_build_object('invitations_pending', n);
    SELECT COUNT(*) INTO n FROM public.customer_invitations
      WHERE profile_id = p_profile_id AND lower(COALESCE(status, '')) = 'claiming';
    result := result || jsonb_build_object('invitations_claiming', n);
    SELECT COUNT(*) INTO n FROM public.customer_invitations
      WHERE profile_id = p_profile_id AND lower(COALESCE(status, '')) = 'expired';
    result := result || jsonb_build_object('invitations_expired', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'invitations_total', 0, 'invitations_pending', 0, 'invitations_claiming', 0, 'invitations_expired', 0
    );
  END;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_suppliers_hub_summary(p_profile_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := jsonb_build_object('ok', true);
  n bigint;
  avg_trust numeric := 0;
BEGIN
  IF p_profile_id IS NULL OR p_profile_id <= 0 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.srm_suppliers WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('total', n);
    SELECT COUNT(*) INTO n FROM public.srm_suppliers
      WHERE profile_id = p_profile_id AND status IN ('active', 'preferred');
    result := result || jsonb_build_object('active', n);
    SELECT COUNT(*) INTO n FROM public.srm_suppliers
      WHERE profile_id = p_profile_id AND status = 'preferred';
    result := result || jsonb_build_object('preferred', n);
    SELECT COUNT(*) INTO n FROM public.srm_suppliers
      WHERE profile_id = p_profile_id
        AND (invite_status = 'accepted' OR linked_profile_id IS NOT NULL);
    result := result || jsonb_build_object('connected', n);
    SELECT COUNT(*) INTO n FROM public.srm_suppliers
      WHERE profile_id = p_profile_id AND invite_status = 'invited';
    result := result || jsonb_build_object('invited', n);
    SELECT COUNT(*) INTO n FROM public.srm_suppliers
      WHERE profile_id = p_profile_id AND verified IS TRUE;
    result := result || jsonb_build_object('verified', n);
    SELECT COALESCE(AVG(trust_score), 0) INTO avg_trust
      FROM public.srm_suppliers WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('avg_trust', round(avg_trust * 10) / 10);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'total', 0, 'active', 0, 'preferred', 0, 'connected', 0, 'invited', 0, 'verified', 0, 'avg_trust', 0
    );
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.purchase_orders
      WHERE buyer_profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('sent', 'accepted', 'funded', 'invoiced');
    result := result || jsonb_build_object('open_pos', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('open_pos', 0);
  END;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_containers_hub_summary(p_profile_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := jsonb_build_object('ok', true);
  n bigint;
  mapped bigint := 0;
  with_c bigint := 0;
BEGIN
  IF p_profile_id IS NULL OR p_profile_id <= 0 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.containers WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('total', n);
    SELECT COUNT(*) INTO n FROM public.containers
      WHERE profile_id = p_profile_id
        AND (status IS NULL OR lower(status) IN ('active', 'deployed', 'operational', 'open', ''));
    result := result || jsonb_build_object('active', n);
    SELECT COUNT(*) INTO mapped FROM public.containers
      WHERE profile_id = p_profile_id AND latitude IS NOT NULL AND longitude IS NOT NULL;
    SELECT COUNT(*) INTO with_c FROM public.containers
      WHERE profile_id = p_profile_id
        AND (contractor_id IS NOT NULL OR COALESCE(assigned_contractor, '') <> '');
    result := result || jsonb_build_object(
      'mapped', mapped, 'unmapped', GREATEST(n - mapped, 0), 'with_contractor', with_c
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'total', 0, 'active', 0, 'mapped', 0, 'unmapped', 0, 'with_contractor', 0
    );
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.container_contractors WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('contractors', n);
    SELECT COUNT(*) INTO n FROM public.container_contractors
      WHERE profile_id = p_profile_id AND lower(COALESCE(verification_status, '')) = 'verified';
    result := result || jsonb_build_object('contractors_verified', n);
    SELECT COUNT(*) INTO n FROM public.container_contractors
      WHERE profile_id = p_profile_id AND training_status = 'certified';
    result := result || jsonb_build_object('training_certified', n);
    SELECT COUNT(*) INTO n FROM public.container_contractors
      WHERE profile_id = p_profile_id
        AND (training_status IS NULL OR training_status = 'pending');
    result := result || jsonb_build_object('training_pending', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'contractors', 0, 'contractors_verified', 0, 'training_certified', 0, 'training_pending', 0
    );
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.container_resellers WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('resellers', n);
    SELECT COUNT(*) INTO n FROM public.container_resellers
      WHERE profile_id = p_profile_id AND lower(COALESCE(verification_status, '')) = 'verified';
    result := result || jsonb_build_object('resellers_verified', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('resellers', 0, 'resellers_verified', 0);
  END;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.sa_customers_hub_summary(bigint, bigint[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sa_suppliers_hub_summary(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sa_containers_hub_summary(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_customers_hub_summary(bigint, bigint[]) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_suppliers_hub_summary(bigint) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_containers_hub_summary(bigint) TO service_role, authenticated;

-- PO idempotency + unique chain tx
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'idempotency_key'
    ) THEN
      ALTER TABLE public.purchase_orders ADD COLUMN idempotency_key text;
    END IF;
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_po_buyer_idempotency ON public.purchase_orders (buyer_profile_id, idempotency_key) WHERE idempotency_key IS NOT NULL';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_po_onchain_tx ON public.purchase_orders (onchain_tx) WHERE onchain_tx IS NOT NULL AND length(trim(onchain_tx)) > 0';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'po unique indexes skip: %', SQLERRM;
END $$;

-- Dunning unique (invoice_id, day)
CREATE TABLE IF NOT EXISTS public.invoice_dunning_sends (
  invoice_id bigint NOT NULL,
  dunning_day integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (invoice_id, dunning_day)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('invoice_dunning_sends');
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'lock invoice_dunning_sends skip: %', SQLERRM;
END $$;

-- Composite already in Brief 1; keep if missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'containers' AND column_name = 'profile_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_containers_profile_updated ON public.containers (profile_id, updated_at DESC)';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'idx_containers_profile_updated skip: %', SQLERRM;
END $$;
