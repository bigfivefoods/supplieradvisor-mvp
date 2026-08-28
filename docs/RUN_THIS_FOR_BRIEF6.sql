-- Brief 6: IAS 2 — label 1140 / 5100. No journal rewrite.
-- Safe to re-run. Paste twin: RUN_THIS_FOR_BRIEF6.sql
-- Schema: none. COGS posts from invoice-gl when a goods line has a known cost.

SET statement_timeout = 0;

UPDATE public.chart_of_accounts
SET
  description = 'IAS 2 inventories at cost. Relieved to 5100 when a sales invoice line has quantity and a known unit cost from products/stock. Selling price is never used as cost.',
  updated_at = now()
WHERE code = '1140'
  AND COALESCE(is_header, false) = false;

UPDATE public.chart_of_accounts
SET
  description = 'IAS 2 cost of sales. Posted on AR invoice issue when a goods line has a known stock cost (Dr 5100 · Cr 1140). Skipped when cost is unknown — never selling price. Services and membership invoices do not post COGS.',
  updated_at = now()
WHERE code = '5100'
  AND COALESCE(is_header, false) = false;
