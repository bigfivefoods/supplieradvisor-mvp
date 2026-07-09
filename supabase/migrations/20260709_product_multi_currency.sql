-- Multi-currency product pricing (up to 3 currencies stored in jsonb)
-- Safe / idempotent

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'base_currency'
    ) THEN
      ALTER TABLE public.products ADD COLUMN base_currency text DEFAULT 'ZAR';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'prices'
    ) THEN
      ALTER TABLE public.products ADD COLUMN prices jsonb DEFAULT '[]'::jsonb;
    END IF;
  END IF;
END $$;

-- Backfill prices from sell_price / cost_price where empty
UPDATE public.products
SET
  base_currency = COALESCE(NULLIF(base_currency, ''), 'ZAR'),
  prices = CASE
    WHEN prices IS NULL OR prices = '[]'::jsonb THEN
      jsonb_build_array(
        jsonb_build_object(
          'currency', COALESCE(NULLIF(base_currency, ''), 'ZAR'),
          'cost_price', COALESCE(cost_price, 0),
          'sell_price', COALESCE(sell_price, 0)
        )
      )
    ELSE prices
  END
WHERE prices IS NULL OR prices = '[]'::jsonb;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
  AND column_name IN ('base_currency', 'prices', 'sell_price', 'cost_price')
ORDER BY column_name;
