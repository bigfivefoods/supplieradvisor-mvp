-- Brief 7: AFS honesty — label 1130/2110 for IAS 1 due_date split.
-- Safe to re-run. Paste twin: RUN_THIS_FOR_BRIEF7.sql
-- No journal rewrite. Notes/disclaimer live in code (not consolidated).

SET statement_timeout = 0;

UPDATE public.chart_of_accounts
SET
  description = 'Trade receivables (IAS 1 current unless invoice due_date is more than 12 months after period end). Statement face rolls named leaves into this line, net of 1135.',
  updated_at = now()
WHERE code = '1130'
  AND COALESCE(is_header, false) = false;

UPDATE public.chart_of_accounts
SET
  description = 'Trade payables (IAS 1 current unless invoice due_date is more than 12 months after period end). 2140 customer deposits are a contract liability, not this line.',
  updated_at = now()
WHERE code = '2110'
  AND COALESCE(is_header, false) = false;
