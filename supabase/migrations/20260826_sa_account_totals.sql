-- Posted-journal debit/credit totals by account (trial balance / AFS / GL opening).
-- Paste in the Supabase SQL editor. Safe to re-run.
-- App falls back to paged JS reads until this exists.

SET statement_timeout = 0;

CREATE OR REPLACE FUNCTION public.sa_account_totals(
  p_company_id integer,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_exclude_sources text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company id required');
  END IF;

  WITH posted AS (
    SELECT id
    FROM public.journal_entries
    WHERE profile_id = p_company_id
      AND status = 'posted'
      AND (p_from IS NULL OR entry_date >= p_from)
      AND (p_to IS NULL OR entry_date <= p_to)
      AND (
        p_exclude_sources IS NULL
        OR COALESCE(source, '') <> ALL (p_exclude_sources)
      )
  ),
  agg AS (
    SELECT
      l.account_id,
      round(sum(COALESCE(l.debit, 0))::numeric, 2) AS debit,
      round(sum(COALESCE(l.credit, 0))::numeric, 2) AS credit
    FROM public.journal_lines l
    INNER JOIN posted p ON p.id = l.journal_entry_id
    GROUP BY l.account_id
  )
  SELECT jsonb_build_object(
    'ok', true,
    'entry_count', (SELECT count(*)::int FROM posted),
    'total_debit', COALESCE((SELECT round(sum(debit), 2) FROM agg), 0),
    'total_credit', COALESCE((SELECT round(sum(credit), 2) FROM agg), 0),
    'rows', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'account_id', a.account_id,
          'debit', a.debit,
          'credit', a.credit,
          'code', c.code,
          'name', c.name,
          'account_type', c.account_type
        )
        ORDER BY c.code NULLS LAST, a.account_id
      )
      FROM agg a
      LEFT JOIN public.chart_of_accounts c ON c.id = a.account_id
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.sa_account_totals(integer, date, date, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_account_totals(integer, date, date, text[])
  TO service_role;
