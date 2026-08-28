-- Brief 11 — signed-in dashboard/home rollup + tenant indexes.
-- Safe to re-run. Paste in the Supabase SQL editor.
-- Twin: docs/RUN_THIS_FOR_BRIEF11.sql

SET statement_timeout = 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('customers');
    PERFORM public.sa_lock_table('srm_suppliers');
    PERFORM public.sa_lock_table('invoices');
    PERFORM public.sa_lock_table('journal_lines');
    PERFORM public.sa_lock_table('opportunities');
    PERFORM public.sa_lock_table('business_connections');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sa_lock_table skip: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS customers_profile_trading_name
  ON customers (profile_id, trading_name);

CREATE INDEX IF NOT EXISTS srm_suppliers_profile_updated_desc
  ON srm_suppliers (profile_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS invoices_profile_direction_status_issue
  ON invoices (profile_id, direction, status, issue_date);

CREATE INDEX IF NOT EXISTS journal_lines_profile_account
  ON journal_lines (profile_id, account_id);

CREATE INDEX IF NOT EXISTS opportunities_profile_updated
  ON opportunities (profile_id, updated_at);

CREATE INDEX IF NOT EXISTS business_connections_requester_updated
  ON business_connections (requester_profile_id, updated_at);

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
  n2 bigint;
  amt numeric;
  amt2 numeric;
  stages jsonb := '[]'::jsonb;
BEGIN
  IF p_profile_id IS NULL OR p_profile_id <= 0 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.business_users
      WHERE profile_id = p_profile_id AND status = 'active';
    SELECT COUNT(*) INTO n2 FROM public.business_users
      WHERE profile_id = p_profile_id AND status IN ('invited', 'pending');
    result := result || jsonb_build_object(
      'team_active', n, 'team_invited', n2, 'team_total', n + n2
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('team_active', 0, 'team_invited', 0, 'team_total', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.invitations
      WHERE profile_id = p_profile_id AND lower(COALESCE(status, '')) IN ('pending', 'invited');
    result := result || jsonb_build_object('pending_invites', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('pending_invites', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.containers WHERE profile_id = p_profile_id;
    SELECT COUNT(*) INTO n2 FROM public.containers
      WHERE profile_id = p_profile_id AND (status IS NULL OR status = 'active');
    result := result || jsonb_build_object('containers_total', n, 'containers_active', n2);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('containers_total', 0, 'containers_active', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.container_inventory
      WHERE profile_id = p_profile_id
        AND qty_on_hand <= COALESCE(reorder_level, 0);
    SELECT COALESCE(SUM(qty_on_hand), 0) INTO amt FROM public.container_inventory
      WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('container_inv_low', n, 'container_units', amt);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('container_inv_low', 0, 'container_units', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.stock_levels
      WHERE profile_id = p_profile_id
        AND qty_on_hand <= COALESCE(reorder_level, 0);
    SELECT COALESCE(SUM(qty_on_hand), 0) INTO amt FROM public.stock_levels
      WHERE profile_id = p_profile_id;
    SELECT COUNT(*) INTO n2 FROM public.warehouses WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('stock_low', n, 'warehouse_units', amt, 'warehouses', n2);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('stock_low', 0, 'warehouse_units', 0, 'warehouses', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.business_connections
      WHERE (requester_profile_id = p_profile_id OR requestee_profile_id = p_profile_id)
        AND status IN ('accepted', 'approved');
    SELECT COUNT(*) INTO n2 FROM public.business_connections
      WHERE requestee_profile_id = p_profile_id AND status = 'pending';
    SELECT COUNT(*) INTO amt FROM public.business_connections
      WHERE requester_profile_id = p_profile_id AND status = 'pending';
    result := result || jsonb_build_object(
      'connections_accepted', n,
      'connections_pending_in', n2,
      'connections_pending_out', amt
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'connections_accepted', 0,
      'connections_pending_in', 0,
      'connections_pending_out', 0
    );
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.container_contractors WHERE profile_id = p_profile_id;
    SELECT COUNT(*) INTO n2 FROM public.container_contractors
      WHERE profile_id = p_profile_id AND status = 'active';
    result := result || jsonb_build_object('contractors_total', n, 'contractors_active', n2);
    SELECT COUNT(*) INTO n FROM public.container_contractors
      WHERE profile_id = p_profile_id AND verification_status = 'verified';
    SELECT COUNT(*) INTO n2 FROM public.container_contractors
      WHERE profile_id = p_profile_id
        AND (portal_status = 'active' OR contract_accepted_at IS NOT NULL);
    result := result || jsonb_build_object('contractors_verified', n, 'contractors_portal', n2);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'contractors_total', 0, 'contractors_active', 0,
      'contractors_verified', 0, 'contractors_portal', 0
    );
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.products WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('products', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('products', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.documents WHERE profile_id = p_profile_id;
    SELECT COUNT(*) INTO n2 FROM public.company_documents WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('documents', n + n2);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('documents', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.projects WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('projects', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('projects', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.riad_logs
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('active', 'open', 'in_progress', 'on_hold', 'mitigated');
    SELECT COUNT(*) INTO n2 FROM public.riad_logs
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('active', 'open', 'in_progress', 'on_hold', 'mitigated')
        AND (
          lower(COALESCE(priority, '')) IN ('critical', 'high')
          OR COALESCE(rpn, 0) >= 50
          OR lower(COALESCE(severity::text, '')) = 'high'
        );
    result := result || jsonb_build_object('open_risks', n, 'high_risks', n2);
    SELECT COUNT(*) INTO n FROM public.riad_logs
      WHERE profile_id = p_profile_id
        AND (module = 'containers' OR container_id IS NOT NULL);
    result := result || jsonb_build_object('container_riads', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('open_risks', 0, 'high_risks', 0, 'container_riads', 0);
  END;

  BEGIN
    SELECT COALESCE(SUM(gross_amount), 0) INTO amt FROM public.container_sales
      WHERE profile_id = p_profile_id AND sale_date = CURRENT_DATE;
    result := result || jsonb_build_object('sales_today', amt);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('sales_today', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.srm_suppliers WHERE profile_id = p_profile_id;
    SELECT COUNT(*) INTO n2 FROM public.srm_suppliers
      WHERE profile_id = p_profile_id
        AND (lower(COALESCE(invite_status, '')) = 'accepted' OR linked_profile_id IS NOT NULL);
    result := result || jsonb_build_object('srm_book_total', n, 'srm_connected', n2);
    SELECT COUNT(*) INTO n FROM public.srm_suppliers
      WHERE profile_id = p_profile_id AND lower(COALESCE(status, '')) IN ('preferred', 'active');
    SELECT COUNT(*) INTO n2 FROM public.srm_suppliers
      WHERE profile_id = p_profile_id AND verified IS TRUE;
    result := result || jsonb_build_object('srm_preferred', n, 'srm_verified', n2);
    SELECT COALESCE(AVG(trust_score), 0), COALESCE(AVG(otifef_pct), 0)
      INTO amt, amt2 FROM public.srm_suppliers WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('srm_avg_trust', round(amt, 1), 'srm_avg_otifef', round(amt2, 1));
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'srm_book_total', 0, 'srm_connected', 0, 'srm_preferred', 0, 'srm_verified', 0,
      'srm_avg_trust', 0, 'srm_avg_otifef', 0
    );
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.supplier_invitations
      WHERE profile_id = p_profile_id AND lower(COALESCE(status, '')) = 'pending';
    result := result || jsonb_build_object('srm_invite_pending', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('srm_invite_pending', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.purchase_orders
      WHERE buyer_profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('draft', 'sent', 'accepted', 'funded');
    SELECT COUNT(*) INTO n2 FROM public.purchase_orders
      WHERE buyer_profile_id = p_profile_id
        AND onchain_po_id IS NOT NULL AND onchain_po_id::text <> '';
    result := result || jsonb_build_object('srm_open_pos', n, 'srm_onchain_pos', n2);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('srm_open_pos', 0, 'srm_onchain_pos', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.customer_riad
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('open', 'active', 'in_progress', 'on_hold', 'mitigated');
    SELECT COUNT(*) INTO n2 FROM public.supplier_riad
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('open', 'active', 'in_progress', 'on_hold', 'mitigated');
    result := result || jsonb_build_object('crm_riad_open', n, 'srm_riad_open', n2);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('crm_riad_open', 0, 'srm_riad_open', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.pricing_agreements
      WHERE seller_profile_id = p_profile_id OR buyer_profile_id = p_profile_id;
    SELECT COUNT(*) INTO n2 FROM public.pricing_agreements
      WHERE (seller_profile_id = p_profile_id OR buyer_profile_id = p_profile_id)
        AND lower(COALESCE(status, '')) = 'active';
    result := result || jsonb_build_object('pricing_agreements', n, 'pricing_active', n2);
    SELECT COUNT(*) INTO n FROM public.pricing_agreements WHERE seller_profile_id = p_profile_id;
    SELECT COUNT(*) INTO n2 FROM public.pricing_agreements WHERE buyer_profile_id = p_profile_id;
    result := result || jsonb_build_object('pricing_selling', n, 'pricing_buying', n2);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'pricing_agreements', 0, 'pricing_active', 0, 'pricing_selling', 0, 'pricing_buying', 0
    );
  END;

  BEGIN
    SELECT COUNT(*), COALESCE(SUM(total_amount), 0) INTO n, amt FROM public.customer_quotes
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('draft', 'sent', 'accepted', 'pending', 'viewed');
    SELECT COALESCE(SUM(total_amount), 0) INTO amt2 FROM public.customer_quotes
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('accepted', 'converted', 'won');
    result := result || jsonb_build_object(
      'quotes_open', n, 'quotes_value', amt, 'quotes_accepted_value', amt2
    );
    SELECT COALESCE(SUM(total_amount), 0) INTO amt FROM public.customer_quotes
      WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('quotes_total_value', amt);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'quotes_open', 0, 'quotes_value', 0, 'quotes_accepted_value', 0, 'quotes_total_value', 0
    );
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.customer_invoices
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('draft', 'sent', 'partial', 'overdue', 'issued', 'unpaid');
    SELECT COUNT(*) INTO n2 FROM public.customer_invoices
      WHERE profile_id = p_profile_id AND lower(COALESCE(status, '')) = 'draft';
    result := result || jsonb_build_object('invoices_open', n, 'invoices_draft', n2);
    SELECT COUNT(*) INTO n FROM public.customer_invoices
      WHERE profile_id = p_profile_id AND lower(COALESCE(status, '')) = 'overdue';
    SELECT COALESCE(SUM(GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0))), 0)
      INTO amt FROM public.customer_invoices
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('draft', 'sent', 'partial', 'overdue', 'issued', 'unpaid');
    result := result || jsonb_build_object('invoices_overdue', n, 'invoices_open_value', amt);
    SELECT COALESCE(SUM(total_amount), 0), COALESCE(SUM(amount_paid), 0)
      INTO amt, amt2 FROM public.customer_invoices WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object('invoices_total_value', amt, 'invoices_collected_value', amt2);
    SELECT COALESCE(SUM(total_amount), 0) INTO amt FROM public.customer_invoices
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(status, '')) IN ('paid', 'settled', 'complete', 'completed');
    result := result || jsonb_build_object('invoices_paid_value', amt);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'invoices_open', 0, 'invoices_draft', 0, 'invoices_overdue', 0,
      'invoices_open_value', 0, 'invoices_paid_value', 0,
      'invoices_total_value', 0, 'invoices_collected_value', 0
    );
  END;

  BEGIN
    SELECT COUNT(*), COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL AND rating > 0), 0),
           COALESCE(AVG(otifef_score) FILTER (WHERE otifef_score IS NOT NULL), 0)
      INTO n, amt, amt2
      FROM public.invoice_feedback WHERE profile_id = p_profile_id;
    result := result || jsonb_build_object(
      'feedback_count', n, 'feedback_avg_stars', round(amt, 1), 'feedback_avg_otifef', round(amt2, 1)
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'feedback_count', 0, 'feedback_avg_stars', 0, 'feedback_avg_otifef', 0
    );
  END;

  BEGIN
    SELECT COUNT(*), COALESCE(AVG(overall) FILTER (WHERE overall IS NOT NULL AND overall > 0), 0)
      INTO n, amt FROM public.company_ratings
      WHERE rater_profile_id = p_profile_id
        AND ratee_role = 'customer' AND status = 'published';
    result := result || jsonb_build_object('peer_rated_count', n, 'peer_avg_stars', round(amt, 1));
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('peer_rated_count', 0, 'peer_avg_stars', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.marketplace_listings
      WHERE seller_profile_id = p_profile_id AND lower(COALESCE(status, '')) = 'active';
    result := result || jsonb_build_object('marketplace_listings', n);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object('marketplace_listings', 0);
  END;

  BEGIN
    SELECT COUNT(*) INTO n FROM public.opportunities WHERE profile_id = p_profile_id;
    SELECT COUNT(*), COALESCE(SUM(COALESCE(amount, opportunity_size, 0)), 0)
      INTO n2, amt FROM public.opportunities
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(stage, status, '')) NOT IN ('closed_won', 'closed_lost', 'won', 'lost');
    result := result || jsonb_build_object(
      'opportunities_total', n, 'opportunities_open', n2, 'pipeline_value', amt
    );
    SELECT COALESCE(SUM(
      COALESCE(amount, opportunity_size, 0) * COALESCE(probability, 10) / 100.0
    ), 0) INTO amt2 FROM public.opportunities
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(stage, status, '')) NOT IN ('closed_won', 'closed_lost', 'won', 'lost');
    result := result || jsonb_build_object('pipeline_weighted', amt2);
    SELECT COUNT(*), COALESCE(SUM(COALESCE(amount, opportunity_size, 0)), 0)
      INTO n, amt FROM public.opportunities
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(stage, status, '')) IN ('closed_won', 'won');
    result := result || jsonb_build_object('won_count', n, 'won_value', amt);
    SELECT COUNT(*), COALESCE(SUM(COALESCE(amount, opportunity_size, 0)), 0)
      INTO n, amt FROM public.opportunities
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(stage, status, '')) = 'invoiced';
    result := result || jsonb_build_object('invoiced_count', n, 'invoiced_value', amt);
    SELECT COUNT(*) INTO n FROM public.opportunities
      WHERE profile_id = p_profile_id
        AND lower(COALESCE(stage, status, '')) IN ('closed_lost', 'lost');
    result := result || jsonb_build_object('lost_count', n);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'stage', st,
      'count', cnt,
      'value', round(val),
      'weighted', round(wtd)
    )), '[]'::jsonb)
    INTO stages
    FROM (
      SELECT
        CASE
          WHEN lower(COALESCE(stage, status, '')) IN ('closed_won', 'won') THEN 'closed_won'
          WHEN lower(COALESCE(stage, status, '')) IN ('closed_lost', 'lost') THEN 'closed_lost'
          WHEN lower(COALESCE(stage, status, '')) IN ('proposal', 'quoted') THEN 'proposal'
          ELSE lower(COALESCE(NULLIF(stage, ''), NULLIF(status, ''), 'prospecting'))
        END AS st,
        COUNT(*)::bigint AS cnt,
        COALESCE(SUM(COALESCE(amount, opportunity_size, 0)), 0) AS val,
        COALESCE(SUM(COALESCE(amount, opportunity_size, 0) * COALESCE(probability, 10) / 100.0), 0) AS wtd
      FROM public.opportunities
      WHERE profile_id = p_profile_id
      GROUP BY 1
    ) s;
    result := result || jsonb_build_object('pipeline_stages', stages);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'opportunities_total', 0, 'opportunities_open', 0, 'pipeline_value', 0,
      'pipeline_weighted', 0, 'won_count', 0, 'won_value', 0,
      'invoiced_count', 0, 'invoiced_value', 0, 'lost_count', 0,
      'pipeline_stages', '[]'::jsonb
    );
  END;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.sa_dashboard_home_rollup(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_dashboard_home_rollup(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_dashboard_home_rollup(bigint) TO authenticated;
