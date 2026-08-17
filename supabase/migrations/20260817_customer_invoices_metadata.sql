-- Stamp Finance twin id on CRM invoices (accrual recognition).
SELECT public.sa_add_column(
  'customer_invoices',
  'metadata',
  'jsonb',
  '''{}''::jsonb'
);

NOTIFY pgrst, 'reload schema';
