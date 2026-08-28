-- Brief 8 — one-time CoA header names (do NOT run from app requests).
-- Scoped per row. Safe to re-run.

UPDATE chart_of_accounts
SET
  name = 'Customers',
  is_header = true,
  account_type = 'asset',
  subtype = 'receivable',
  normal_balance = 'debit',
  updated_at = now()
WHERE code = '1180'
  AND (name IS DISTINCT FROM 'Customers' OR is_header IS DISTINCT FROM true);

UPDATE chart_of_accounts
SET
  name = 'Suppliers',
  is_header = true,
  account_type = 'liability',
  subtype = 'payable',
  normal_balance = 'credit',
  updated_at = now()
WHERE code = '2180'
  AND (name IS DISTINCT FROM 'Suppliers' OR is_header IS DISTINCT FROM true);
