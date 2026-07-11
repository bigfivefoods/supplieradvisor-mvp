-- VAT category on tax_rates + tax_inclusive helper on bank lines.
-- Safe to re-run.

SELECT public.sa_add_column('tax_rates', 'category', 'text', '''standard''');
-- standard | zero_rated | exempt | out_of_scope

SELECT public.sa_add_column('bank_transactions', 'tax_inclusive', 'boolean', 'true');
-- When true, amount is gross (VAT included); tax_amount extracted via rate/(100+rate)

SELECT public.sa_add_column('invoices', 'tax_code', 'text');
SELECT public.sa_add_column('invoices', 'tax_category', 'text');

-- Best-effort backfill ZA seeds if empty category
UPDATE public.tax_rates
SET category = CASE
  WHEN upper(code) LIKE '%EXEMPT%' OR lower(name) LIKE '%exempt%' THEN 'exempt'
  WHEN upper(code) LIKE '%OUT%' OR lower(name) LIKE '%out of scope%' THEN 'out_of_scope'
  WHEN upper(code) LIKE '%VAT0%' OR upper(code) LIKE '%ZERO%' OR lower(name) LIKE '%zero%rated%' THEN 'zero_rated'
  WHEN coalesce(rate, 0) > 0 THEN 'standard'
  ELSE coalesce(category, 'standard')
END
WHERE category IS NULL OR category = '';
