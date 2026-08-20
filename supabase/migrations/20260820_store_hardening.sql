-- Safe to re-run. Unique public tokens when the column has no duplicates.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.company_module_stores
    WHERE public_token IS NOT NULL
    GROUP BY public_token
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_company_module_stores_public_token_uid
      ON public.company_module_stores (public_token)
      WHERE public_token IS NOT NULL;
  END IF;
END $$;
