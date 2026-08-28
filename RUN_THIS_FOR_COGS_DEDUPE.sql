-- Reverse extra IAS 2 COGS journals (source = invoice_cogs).
-- Keeps the earliest live journal per invoice; reverses the rest.
-- Safe to re-run. Does not touch a single COGS posting (e.g. JE-00736).
-- Paste in the Supabase SQL editor.

SET statement_timeout = 0;

DO $$
DECLARE
  extra RECORD;
  new_id bigint;
  new_num text;
BEGIN
  FOR extra IN
    WITH live AS (
      SELECT
        je.id,
        je.profile_id,
        je.source_id,
        je.entry_date,
        je.currency,
        je.entry_number,
        je.memo,
        ROW_NUMBER() OVER (
          PARTITION BY je.profile_id, je.source_id
          ORDER BY je.id
        ) AS rn
      FROM public.journal_entries je
      WHERE je.source = 'invoice_cogs'
        AND je.status = 'posted'
        AND je.source_id IS NOT NULL
        AND btrim(je.source_id) <> ''
        AND COALESCE(je.metadata->>'reversed_by_journal_id', '') = ''
    )
    SELECT * FROM live WHERE rn > 1
  LOOP
    BEGIN
      new_num := public.sa_next_document_number(extra.profile_id::int, 'journal');
    EXCEPTION WHEN OTHERS THEN
      new_num := 'JE-COGS-REV-' || extra.id::text;
    END;

    INSERT INTO public.journal_entries (
      profile_id, entry_number, entry_date, memo, status, source, source_id,
      currency, posted_at, metadata
    )
    VALUES (
      extra.profile_id,
      new_num,
      extra.entry_date,
      'Reverse duplicate COGS ' || COALESCE(extra.entry_number, extra.id::text),
      'posted',
      'reversal',
      extra.id::text,
      COALESCE(extra.currency, 'ZAR'),
      now(),
      jsonb_build_object(
        'reverses_journal_id', extra.id,
        'dedupe', true,
        'invoice_cogs', true
      )
    )
    RETURNING id INTO new_id;

    INSERT INTO public.journal_lines (
      journal_entry_id, profile_id, account_id, debit, credit, memo
    )
    SELECT
      new_id,
      jl.profile_id,
      jl.account_id,
      COALESCE(jl.credit, 0),
      COALESCE(jl.debit, 0),
      jl.memo
    FROM public.journal_lines jl
    WHERE jl.journal_entry_id = extra.id;

    UPDATE public.journal_entries
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'reversed_by_journal_id', new_id,
      'reversed_at', now()
    )
    WHERE id = extra.id;
  END LOOP;
END $$;
