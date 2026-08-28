-- Reverse JE-00736 (COGS INV-20260828-Q4HD-R2, R140k).
-- Goods were not on 1140 — PO to Kelpack was raised after the sale invoice.
-- Safe to re-run. Nets 5100/1140 to zero; does not delete the original JE.
-- Paste in the Supabase SQL editor.
-- After this, paste RUN_THIS_FOR_KELPACK_PO_COGS.sql so the Kelpack PO (~R130k)
-- is the COGS when that PO is accepted.

SET statement_timeout = 0;

DO $$
DECLARE
  je RECORD;
  new_id bigint;
  new_num text;
BEGIN
  SELECT *
  INTO je
  FROM public.journal_entries
  WHERE entry_number = 'JE-00736'
    AND source = 'invoice_cogs'
    AND status = 'posted'
    AND COALESCE(memo, '') ILIKE '%INV-20260828-Q4HD-R2%'
    AND COALESCE(metadata->>'reversed_by_journal_id', '') = ''
  ORDER BY id
  LIMIT 1;

  IF je.id IS NULL THEN
    RAISE NOTICE 'JE-00736 invoice_cogs for INV-20260828-Q4HD-R2 not found or already reversed';
    RETURN;
  END IF;

  BEGIN
    new_num := public.sa_next_document_number(je.profile_id::int, 'journal');
  EXCEPTION WHEN OTHERS THEN
    new_num := 'JE-COGS-REV-' || je.id::text;
  END;

  INSERT INTO public.journal_entries (
    profile_id, entry_number, entry_date, memo, status, source, source_id,
    currency, posted_at, metadata
  )
  VALUES (
    je.profile_id,
    new_num,
    je.entry_date,
    'Reverse COGS INV-20260828-Q4HD-R2 (stock not received; PO raised after invoice)',
    'posted',
    'reversal',
    je.id::text,
    COALESCE(je.currency, 'ZAR'),
    now(),
    jsonb_build_object(
      'reverses_journal_id', je.id,
      'reverses_entry_number', je.entry_number,
      'invoice_cogs', true,
      'manual_reverse', true
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
  WHERE jl.journal_entry_id = je.id;

  UPDATE public.journal_entries
  SET metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || jsonb_build_object(
    'reversed_by_journal_id', new_id,
    'reversed_at', now()
  )
  WHERE id = je.id;

  UPDATE public.invoices
  SET
    metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || jsonb_build_object(
      'cogs_voided', true,
      'cogs_skipped', 'manual_reverse',
      'cogs_amount', 0,
      'cogs_journal_id', NULL,
      'prior_cogs_journal_id', je.id
    ),
    updated_at = now()
  WHERE profile_id = je.profile_id
    AND direction = 'receivable'
    AND invoice_number = 'INV-20260828-Q4HD-R2';

  UPDATE public.customer_invoices
  SET
    metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || jsonb_build_object(
      'cogs_voided', true,
      'cogs_skipped', 'manual_reverse',
      'cogs_amount', 0,
      'prior_cogs_journal_id', je.id
    ),
    updated_at = now()
  WHERE profile_id = je.profile_id
    AND invoice_number = 'INV-20260828-Q4HD-R2';

  RAISE NOTICE 'Reversed % with %', je.entry_number, new_num;
END $$;
