-- Security / reliability / speed (2026-08-27)
-- Safe to re-run in the Supabase SQL editor.
-- Pair with repo paste file RUN_THIS_FOR_SECURITY_RELIABILITY.sql
--
-- 1. Re-lock order-chain tables that were created with USING (true)
-- 2. Fail-closed Paystack webhook claim (in-flight lock)
-- 3. Atomic company register + owner membership
-- 4. Dashboard home rollup RPC (NSNP-style)
-- 5. PO / container / dashboard indexes

SET statement_timeout = 0;

-- ── Re-lock order-chain tables ───────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('order_chain_setups');
    PERFORM public.sa_lock_table('order_links');
    PERFORM public.sa_lock_table('order_batches');
    PERFORM public.sa_lock_table('supplier_payments');
  ELSE
    RAISE NOTICE 'sa_lock_table missing — run RUN_THIS_IN_SUPABASE.sql first, then re-run this file';
  END IF;
END $$;

-- ── Paystack claim: in-flight lock + stale reclaim (2 minutes) ───────────────
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
  stale_before timestamptz;
BEGIN
  ref := NULLIF(trim(COALESCE(p_reference, '')), '');
  ev := NULLIF(trim(COALESCE(p_event, '')), '');
  IF ref IS NULL OR ev IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'first', true, 'hits', 0, 'in_flight', false);
  END IF;

  stale_before := now() - interval '2 minutes';

  INSERT INTO public.paystack_webhook_events (reference, event, hits, first_at, last_at, handled)
  VALUES (ref, ev, 1, now(), now(), NULL)
  ON CONFLICT (reference, event) DO NOTHING
  RETURNING * INTO rec;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'first', true, 'hits', 1, 'handled', NULL, 'in_flight', false
    );
  END IF;

  SELECT * INTO rec
  FROM public.paystack_webhook_events
  WHERE reference = ref AND event = ev
  FOR UPDATE;

  IF rec.handled IS NOT NULL THEN
    UPDATE public.paystack_webhook_events
      SET hits = hits + 1
      WHERE reference = ref AND event = ev;
    RETURN jsonb_build_object(
      'ok', true,
      'first', false,
      'hits', rec.hits + 1,
      'handled', rec.handled,
      'in_flight', false
    );
  END IF;

  IF rec.last_at >= stale_before THEN
    UPDATE public.paystack_webhook_events
      SET hits = hits + 1
      WHERE reference = ref AND event = ev;
    RETURN jsonb_build_object(
      'ok', true,
      'first', false,
      'hits', rec.hits + 1,
      'handled', NULL,
      'in_flight', true
    );
  END IF;

  UPDATE public.paystack_webhook_events
    SET hits = hits + 1, last_at = now()
    WHERE reference = ref AND event = ev AND handled IS NULL
    RETURNING * INTO rec;

  RETURN jsonb_build_object(
    'ok', true, 'first', true, 'hits', rec.hits, 'handled', NULL, 'in_flight', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sa_claim_paystack_webhook(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_claim_paystack_webhook(text, text) TO service_role;

-- ── Atomic company + owner membership ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sa_register_company_with_owner(
  p_user_id text,
  p_email text,
  p_name text,
  p_profile jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id bigint;
  trading text;
  email text;
BEGIN
  trading := NULLIF(trim(COALESCE(p_profile->>'trading_name', '')), '');
  email := NULLIF(trim(COALESCE(p_email, p_profile->>'email', '')), '');
  IF p_user_id IS NULL OR length(trim(p_user_id)) < 4 THEN
    RAISE EXCEPTION 'user_id required';
  END IF;
  IF trading IS NULL THEN
    RAISE EXCEPTION 'trading_name required';
  END IF;

  BEGIN
    INSERT INTO public.profiles (
      trading_name,
      legal_name,
      email,
      user_id,
      supplier_status,
      country,
      city,
      website,
      contact_name,
      contact_phone,
      industry,
      business_type,
      is_discoverable,
      claimed_at,
      created_at
    ) VALUES (
      trading,
      COALESCE(NULLIF(trim(p_profile->>'legal_name'), ''), trading),
      email,
      trim(p_user_id),
      'active',
      COALESCE(NULLIF(trim(p_profile->>'country'), ''), 'South Africa'),
      NULLIF(trim(p_profile->>'city'), ''),
      NULLIF(trim(p_profile->>'website'), ''),
      COALESCE(NULLIF(trim(p_name), ''), NULLIF(trim(p_profile->>'contact_name'), '')),
      NULLIF(trim(p_profile->>'contact_phone'), ''),
      NULLIF(trim(p_profile->>'industry'), ''),
      NULLIF(trim(p_profile->>'business_type'), ''),
      true,
      now(),
      now()
    )
    RETURNING id INTO new_id;
  EXCEPTION WHEN undefined_column THEN
    INSERT INTO public.profiles (
      trading_name, legal_name, email, user_id, supplier_status
    ) VALUES (
      trading,
      COALESCE(NULLIF(trim(p_profile->>'legal_name'), ''), trading),
      email,
      trim(p_user_id),
      'active'
    )
    RETURNING id INTO new_id;
  END;

  BEGIN
    INSERT INTO public.business_users (
      user_id, profile_id, role, status, email, name, joined_at, created_at
    ) VALUES (
      trim(p_user_id),
      new_id,
      'owner',
      'active',
      email,
      COALESCE(NULLIF(trim(p_name), ''), NULLIF(trim(p_profile->>'contact_name'), '')),
      now(),
      now()
    );
  EXCEPTION WHEN undefined_column THEN
    INSERT INTO public.business_users (
      user_id, profile_id, role, status, email
    ) VALUES (
      trim(p_user_id), new_id, 'owner', 'active', email
    );
  END;

  RETURN jsonb_build_object('ok', true, 'profile_id', new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.sa_register_company_with_owner(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_register_company_with_owner(text, text, text, jsonb) TO service_role;

-- ── Dashboard home rollup (counts; tenant key profile_id) ────────────────────
CREATE OR REPLACE FUNCTION public.sa_dashboard_home_rollup(p_profile_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := jsonb_build_object('ok', true);
  n bigint;
BEGIN
  IF p_profile_id IS NULL OR p_profile_id <= 0 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.business_users
      WHERE profile_id = p_profile_id AND status = 'active';
    result := result || jsonb_build_object('team_active', n);
    SELECT COUNT(*) INTO n FROM public.business_users
      WHERE profile_id = p_profile_id AND status IN ('invited', 'pending');
    result := result || jsonb_build_object('team_invited', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('team_active', 0, 'team_invited', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.containers WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('containers_total', n);
    SELECT COUNT(*) INTO n FROM public.containers
      WHERE profile_id = p_profile_id AND (status IS NULL OR status = 'active');
    result := result || jsonb_build_object('containers_active', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('containers_total', 0, 'containers_active', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.container_inventory
      WHERE profile_id = p_profile_id
        AND qty_on_hand <= COALESCE(reorder_level, 0);
    result := result || jsonb_build_object('container_inv_low', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('container_inv_low', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.stock_levels
      WHERE profile_id = p_profile_id
        AND qty_on_hand <= COALESCE(reorder_level, 0);
    result := result || jsonb_build_object('stock_low', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('stock_low', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.business_connections
      WHERE (requester_profile_id = p_profile_id OR requestee_profile_id = p_profile_id)
        AND status IN ('accepted', 'approved');
    result := result || jsonb_build_object('connections_accepted', n);
    SELECT COUNT(*) INTO n FROM public.business_connections
      WHERE requestee_profile_id = p_profile_id AND status = 'pending';
    result := result || jsonb_build_object('connections_pending_in', n);
    SELECT COUNT(*) INTO n FROM public.business_connections
      WHERE requester_profile_id = p_profile_id AND status = 'pending';
    result := result || jsonb_build_object('connections_pending_out', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'connections_accepted', 0,
      'connections_pending_in', 0,
      'connections_pending_out', 0
    );
  END;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.sa_dashboard_home_rollup(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_dashboard_home_rollup(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_dashboard_home_rollup(bigint) TO authenticated;

-- ── Hot-path indexes (skip if column missing) ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'buyer_profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_po_buyer_created ON public.purchase_orders (buyer_profile_id, created_at DESC)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'buyer_profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'actual_delivery_date'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_po_buyer_delivery ON public.purchase_orders (buyer_profile_id, actual_delivery_date)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'buyer_profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'promised_date'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_po_buyer_promised ON public.purchase_orders (buyer_profile_id, promised_date)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'containers'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_containers_profile_created ON public.containers (profile_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_containers_profile_updated ON public.containers (profile_id, updated_at DESC)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'container_inventory'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_container_inv_profile ON public.container_inventory (profile_id)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_levels'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_stock_levels_profile ON public.stock_levels (profile_id)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_users'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_business_users_profile_status ON public.business_users (profile_id, status)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_connections'
      AND column_name = 'requester_profile_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bc_requester_status ON public.business_connections (requester_profile_id, status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bc_requestee_status ON public.business_connections (requestee_profile_id, status)';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'hotpath index skip: %', SQLERRM;
END $$;
