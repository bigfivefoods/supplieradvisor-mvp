-- Brief 3 leftover speed: accounting KPI rollup in SQL (tenant = profile_id).
-- Safe to re-run. Paste twin: RUN_THIS_FOR_BRIEF3.sql
-- No new indexes — remaining queries use Brief 1/2 indexes + query caps.

SET statement_timeout = 0;

CREATE OR REPLACE FUNCTION public.sa_accounting_kpi_rollup(p_profile_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := jsonb_build_object('ok', true);
  n bigint;
  amt numeric;
BEGIN
  IF p_profile_id IS NULL OR p_profile_id <= 0 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  BEGIN
    SELECT COUNT(*), COALESCE(SUM(GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0))), 0)
      INTO n, amt
      FROM public.invoices
      WHERE profile_id = p_profile_id
        AND direction = 'receivable'
        AND lower(COALESCE(status, '')) NOT IN ('paid', 'void', 'cancelled')
        AND GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0)) > 0;
    result := result || jsonb_build_object('ar_open', n, 'ar_open_amount', amt);

    SELECT COUNT(*), COALESCE(SUM(GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0))), 0)
      INTO n, amt
      FROM public.invoices
      WHERE profile_id = p_profile_id
        AND direction = 'receivable'
        AND lower(COALESCE(status, '')) NOT IN ('paid', 'void', 'cancelled', 'draft')
        AND GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0)) > 0
        AND due_date IS NOT NULL
        AND (due_date::timestamptz + interval '1 day' - interval '1 second') < now();
    result := result || jsonb_build_object('ar_overdue', n, 'ar_overdue_amount', amt);

    SELECT COUNT(*), COALESCE(SUM(GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0))), 0)
      INTO n, amt
      FROM public.invoices
      WHERE profile_id = p_profile_id
        AND direction = 'payable'
        AND lower(COALESCE(status, '')) NOT IN ('paid', 'void', 'cancelled')
        AND GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0)) > 0;
    result := result || jsonb_build_object('ap_open', n, 'ap_open_amount', amt);

    SELECT COUNT(*), COALESCE(SUM(GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0))), 0)
      INTO n, amt
      FROM public.invoices
      WHERE profile_id = p_profile_id
        AND direction = 'payable'
        AND lower(COALESCE(status, '')) NOT IN ('paid', 'void', 'cancelled', 'draft')
        AND GREATEST(0, COALESCE(total_amount, 0) - COALESCE(amount_paid, 0)) > 0
        AND due_date IS NOT NULL
        AND (due_date::timestamptz + interval '1 day' - interval '1 second') < now();
    result := result || jsonb_build_object('ap_overdue', n, 'ap_overdue_amount', amt);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    result := result || jsonb_build_object(
      'ar_open', 0, 'ar_open_amount', 0,
      'ar_overdue', 0, 'ar_overdue_amount', 0,
      'ap_open', 0, 'ap_open_amount', 0,
      'ap_overdue', 0, 'ap_overdue_amount', 0
    );
  END;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.sa_accounting_kpi_rollup(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_accounting_kpi_rollup(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_accounting_kpi_rollup(bigint) TO authenticated;
