-- Brief 9 — tenant list indexes. Safe to re-run.

CREATE INDEX IF NOT EXISTS customers_profile_id_id_desc
  ON customers (profile_id, id DESC);

CREATE INDEX IF NOT EXISTS customers_profile_created_desc
  ON customers (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS srm_suppliers_profile_id_id_desc
  ON srm_suppliers (profile_id, id DESC);

CREATE INDEX IF NOT EXISTS customer_invoices_profile_id_id_desc
  ON customer_invoices (profile_id, id DESC);

CREATE INDEX IF NOT EXISTS invoices_profile_id_id_desc
  ON invoices (profile_id, id DESC);

CREATE INDEX IF NOT EXISTS journal_entries_profile_id_id_desc
  ON journal_entries (profile_id, id DESC);

CREATE INDEX IF NOT EXISTS chart_of_accounts_profile_code
  ON chart_of_accounts (profile_id, code);
