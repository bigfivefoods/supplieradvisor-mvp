-- Kelpack PO (~R130k) is the cost of INV-20260828-Q4HD-R2 when accepted.
--
-- 1) Reverse JE-00736 (catalogue R140k) if it is still live
-- 2) Find the Big Five Foods → Kelpack purchase order near R130,000
-- 3) Link it to INV-20260828-Q4HD-R2
-- 4) If the PO is already accepted (or later), post:
--      Dr 1140  Cr AP-Kelpack   at the PO amount
--      Dr 5100  Cr 1140         same amount as COGS
-- Safe to re-run. Does not create a PO if none exists — raise it on
-- /dashboard/suppliers/po and mark accepted after this link if needed.
-- Paste in the Supabase SQL editor.

SET statement_timeout = 0;

-- ── 1. Reverse the catalogue 140k if still posted ─────────────────────────
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
    RAISE NOTICE 'JE-00736 already reversed or not found';
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

-- ── 2–4. Link Kelpack PO and post 130k books if accepted ──────────────────
DO $$
DECLARE
  inv RECORD;
  po RECORD;
  po_amt numeric;
  inv1140 bigint;
  cogs5100 bigint;
  ap_id bigint;
  srm_id bigint;
  live_inv bigint;
  live_cogs bigint;
  je_inv_id bigint;
  je_cogs_id bigint;
  je_inv_num text;
  je_cogs_num text;
  po_status text;
BEGIN
  SELECT *
  INTO inv
  FROM public.invoices
  WHERE invoice_number = 'INV-20260828-Q4HD-R2'
    AND COALESCE(direction, 'receivable') <> 'payable'
  ORDER BY id
  LIMIT 1;

  IF inv.id IS NULL THEN
    SELECT *
    INTO inv
    FROM public.customer_invoices
    WHERE invoice_number = 'INV-20260828-Q4HD-R2'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF inv.id IS NULL THEN
    RAISE NOTICE 'INV-20260828-Q4HD-R2 not found — cannot link the Kelpack PO';
    RETURN;
  END IF;

  SELECT *
  INTO po
  FROM public.purchase_orders
  WHERE buyer_profile_id = inv.profile_id
    AND COALESCE(status, '') NOT IN ('cancelled', 'canceled')
    AND (
      COALESCE(supplier_name, '') ILIKE '%kelpack%'
      OR COALESCE(metadata->>'supplier_name', '') ILIKE '%kelpack%'
    )
    AND COALESCE(total_amount, subtotal, 0) BETWEEN 120000 AND 140000
  ORDER BY
    ABS(COALESCE(total_amount, subtotal, 0) - 130000) ASC,
    id DESC
  LIMIT 1;

  IF po.id IS NULL THEN
    SELECT *
    INTO po
    FROM public.purchase_orders
    WHERE buyer_profile_id = inv.profile_id
      AND COALESCE(status, '') NOT IN ('cancelled', 'canceled')
      AND COALESCE(supplier_name, '') ILIKE '%kelpack%'
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  IF po.id IS NULL THEN
    RAISE NOTICE
      'No Kelpack PO found for profile %. Raise it on /dashboard/suppliers/po for R130k, link INV-20260828-Q4HD-R2, then mark accepted.',
      inv.profile_id;
    RETURN;
  END IF;

  po_amt := ROUND(COALESCE(po.subtotal, po.total_amount, 0)::numeric, 2);
  po_status := LOWER(COALESCE(po.status, ''));

  UPDATE public.purchase_orders
  SET
    metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || jsonb_build_object(
      'related_invoice_number', 'INV-20260828-Q4HD-R2',
      'related_invoice_id', inv.id,
      'sales_invoice_number', 'INV-20260828-Q4HD-R2'
    ),
    updated_at = now()
  WHERE id = po.id
    AND buyer_profile_id = inv.profile_id;

  RAISE NOTICE 'Linked PO #% (%) amount % status % to INV-20260828-Q4HD-R2',
    po.id, po.supplier_name, po_amt, po.status;

  IF po_status NOT IN ('accepted', 'funded', 'invoiced', 'paid', 'completed', 'delivered') THEN
    RAISE NOTICE 'PO #% is %. Mark it accepted on the PO desk to post inventory + R130k COGS.',
      po.id, po.status;
    RETURN;
  END IF;

  IF po_amt < 0.01 THEN
    RAISE NOTICE 'PO #% has zero amount — not posting', po.id;
    RETURN;
  END IF;

  SELECT id INTO inv1140
  FROM public.chart_of_accounts
  WHERE profile_id = inv.profile_id
    AND code = '1140'
    AND COALESCE(is_header, false) = false
  LIMIT 1;

  SELECT id INTO cogs5100
  FROM public.chart_of_accounts
  WHERE profile_id = inv.profile_id
    AND code = '5100'
    AND COALESCE(is_header, false) = false
  LIMIT 1;

  BEGIN
    srm_id := NULLIF(COALESCE(po.metadata::jsonb->>'srm_supplier_id', ''), '')::bigint;
  EXCEPTION WHEN OTHERS THEN
    srm_id := NULL;
  END;

  IF srm_id IS NOT NULL THEN
    SELECT id INTO ap_id
    FROM public.chart_of_accounts
    WHERE profile_id = inv.profile_id
      AND code = '2180-' || LPAD(srm_id::text, 7, '0')
    LIMIT 1;
  END IF;

  IF ap_id IS NULL THEN
    SELECT id INTO ap_id
    FROM public.chart_of_accounts
    WHERE profile_id = inv.profile_id
      AND COALESCE(is_header, false) = false
      AND (
        name ILIKE '%kelpack%'
        OR code IN (
          SELECT '2180-' || LPAD(s.id::text, 7, '0')
          FROM public.srm_suppliers s
          WHERE s.profile_id = inv.profile_id
            AND COALESCE(s.trading_name, '') ILIKE '%kelpack%'
        )
      )
    ORDER BY id
    LIMIT 1;
  END IF;

  IF ap_id IS NULL THEN
    SELECT id INTO ap_id
    FROM public.chart_of_accounts
    WHERE profile_id = inv.profile_id
      AND code = '2110'
      AND COALESCE(is_header, false) = false
    LIMIT 1;
  END IF;

  IF inv1140 IS NULL OR cogs5100 IS NULL OR ap_id IS NULL THEN
    RAISE NOTICE 'Missing COA 1140/5100/AP for profile % — seed Chart of Accounts',
      inv.profile_id;
    RETURN;
  END IF;

  SELECT je.id
  INTO live_inv
  FROM public.journal_entries je
  WHERE je.profile_id = inv.profile_id
    AND je.source = 'po_inventory'
    AND je.source_id = po.id::text
    AND je.status = 'posted'
    AND COALESCE(je.metadata->>'reversed_by_journal_id', '') = ''
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_entries r
      WHERE r.profile_id = je.profile_id
        AND r.source = 'reversal'
        AND r.source_id = je.id::text
        AND r.status = 'posted'
    )
  ORDER BY je.id
  LIMIT 1;

  IF live_inv IS NULL THEN
    BEGIN
      je_inv_num := public.sa_next_document_number(inv.profile_id::int, 'journal');
    EXCEPTION WHEN OTHERS THEN
      je_inv_num := 'JE-PO-INV-' || po.id::text;
    END;

    INSERT INTO public.journal_entries (
      profile_id, entry_number, entry_date, memo, status, source, source_id,
      currency, posted_at, metadata
    )
    VALUES (
      inv.profile_id,
      je_inv_num,
      COALESCE(po.promised_date, CURRENT_DATE),
      LEFT('PO #' || po.id::text || ' inventory · ' || COALESCE(po.supplier_name, 'Kelpack'), 500),
      'posted',
      'po_inventory',
      po.id::text,
      COALESCE(po.currency, inv.currency, 'ZAR'),
      now(),
      jsonb_build_object(
        'ias2', true,
        'po_inventory', true,
        'purchase_order_id', po.id,
        'amount', po_amt,
        'supplier_name', po.supplier_name
      )
    )
    RETURNING id INTO je_inv_id;

    INSERT INTO public.journal_lines (
      journal_entry_id, profile_id, account_id, debit, credit, memo
    )
    VALUES
      (je_inv_id, inv.profile_id, inv1140, po_amt, 0, 'PO #' || po.id::text || ' inventory'),
      (je_inv_id, inv.profile_id, ap_id, 0, po_amt, 'PO #' || po.id::text || ' inventory');

    UPDATE public.purchase_orders
    SET metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || jsonb_build_object(
      'inventory_journal_id', je_inv_id,
      'ap_allocated_journal_id', je_inv_id,
      'inventory_amount', po_amt,
      'inventory_posted_at', now()
    )
    WHERE id = po.id;

    RAISE NOTICE 'Posted inventory/AP % for PO #%', je_inv_num, po.id;
  ELSE
    je_inv_id := live_inv;
    RAISE NOTICE 'PO inventory already posted as journal %', live_inv;
  END IF;

  SELECT je.id
  INTO live_cogs
  FROM public.journal_entries je
  WHERE je.profile_id = inv.profile_id
    AND je.source = 'invoice_cogs'
    AND je.source_id = inv.id::text
    AND je.status = 'posted'
    AND COALESCE(je.metadata->>'reversed_by_journal_id', '') = ''
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_entries r
      WHERE r.profile_id = je.profile_id
        AND r.source = 'reversal'
        AND r.source_id = je.id::text
        AND r.status = 'posted'
    )
  ORDER BY je.id
  LIMIT 1;

  IF live_cogs IS NULL THEN
    BEGIN
      je_cogs_num := public.sa_next_document_number(inv.profile_id::int, 'journal');
    EXCEPTION WHEN OTHERS THEN
      je_cogs_num := 'JE-PO-COGS-' || po.id::text;
    END;

    INSERT INTO public.journal_entries (
      profile_id, entry_number, entry_date, memo, status, source, source_id,
      currency, posted_at, metadata
    )
    VALUES (
      inv.profile_id,
      je_cogs_num,
      COALESCE(inv.issue_date, CURRENT_DATE),
      LEFT('COGS INV-20260828-Q4HD-R2 from PO #' || po.id::text, 500),
      'posted',
      'invoice_cogs',
      inv.id::text,
      COALESCE(inv.currency, po.currency, 'ZAR'),
      now(),
      jsonb_build_object(
        'ias2', true,
        'invoice_id', inv.id,
        'invoice_number', 'INV-20260828-Q4HD-R2',
        'purchase_order_id', po.id,
        'cogs_amount', po_amt,
        'from_po_accept', true
      )
    )
    RETURNING id INTO je_cogs_id;

    INSERT INTO public.journal_lines (
      journal_entry_id, profile_id, account_id, debit, credit, memo
    )
    VALUES
      (je_cogs_id, inv.profile_id, cogs5100, po_amt, 0, 'COGS INV-20260828-Q4HD-R2 from PO #' || po.id::text),
      (je_cogs_id, inv.profile_id, inv1140, 0, po_amt, 'COGS INV-20260828-Q4HD-R2 from PO #' || po.id::text);

    UPDATE public.invoices
    SET metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || jsonb_build_object(
      'cogs_voided', false,
      'cogs_skipped', NULL,
      'cogs_amount', po_amt,
      'cogs_journal_id', je_cogs_id,
      'cogs_from_po_id', po.id,
      'cogs_from_po_amount', po_amt,
      'cogs_posted_at', now()
    )
    WHERE id = inv.id
      AND profile_id = inv.profile_id;

    UPDATE public.customer_invoices
    SET metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || jsonb_build_object(
      'cogs_voided', false,
      'cogs_skipped', NULL,
      'cogs_amount', po_amt,
      'cogs_journal_id', je_cogs_id,
      'cogs_from_po_id', po.id,
      'cogs_from_po_amount', po_amt,
      'cogs_posted_at', now()
    )
    WHERE profile_id = inv.profile_id
      AND invoice_number = 'INV-20260828-Q4HD-R2';

    RAISE NOTICE 'Posted COGS % amount % for INV-20260828-Q4HD-R2', je_cogs_num, po_amt;
  ELSE
    RAISE NOTICE 'Live COGS already exists as journal % — not posting a second 5100', live_cogs;
  END IF;
END $$;
