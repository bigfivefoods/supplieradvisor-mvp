-- Brief 21 Commercial — party catalogue lines + append-only price history.
-- Twin paste: RUN_THIS_FOR_BRIEF21_COMMERCIAL.sql
-- Service-role API only. Safe to re-run.
-- Does not require Kelpack to have a linked_profile_id.

CREATE TABLE IF NOT EXISTS public.party_catalogue_lines (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  party_kind text NOT NULL,
  supplier_id bigint,
  customer_id bigint,
  product_id bigint NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  uom text,
  accepted_price numeric(18,4) NOT NULL DEFAULT 0,
  accepted_at timestamptz,
  pending_price numeric(18,4),
  pending_proposed_at timestamptz,
  pending_proposed_by text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_catalogue_kind_check CHECK (party_kind IN ('supplier', 'customer')),
  CONSTRAINT party_catalogue_status_check CHECK (status IN ('active', 'paused')),
  CONSTRAINT party_catalogue_actor_check CHECK (
    pending_proposed_by IS NULL OR pending_proposed_by IN ('host', 'party')
  ),
  CONSTRAINT party_catalogue_party_check CHECK (
    (party_kind = 'supplier' AND supplier_id IS NOT NULL AND customer_id IS NULL)
    OR (party_kind = 'customer' AND customer_id IS NOT NULL AND supplier_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_party_catalogue_supplier
  ON public.party_catalogue_lines (profile_id, product_id, supplier_id)
  WHERE party_kind = 'supplier' AND supplier_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_party_catalogue_customer
  ON public.party_catalogue_lines (profile_id, product_id, customer_id)
  WHERE party_kind = 'customer' AND customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_party_catalogue_profile_kind
  ON public.party_catalogue_lines (profile_id, party_kind, status);

CREATE INDEX IF NOT EXISTS idx_party_catalogue_product
  ON public.party_catalogue_lines (profile_id, product_id);

CREATE TABLE IF NOT EXISTS public.party_price_revisions (
  id bigserial PRIMARY KEY,
  line_id bigint NOT NULL,
  old_price numeric(18,4),
  new_price numeric(18,4) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  proposed_by text NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  accepted_by text,
  accepted_at timestamptz,
  rejected_by text,
  rejected_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_price_rev_actor_check CHECK (proposed_by IN ('host', 'party')),
  CONSTRAINT party_price_rev_status_check CHECK (
    status IN ('proposed', 'accepted', 'rejected', 'superseded')
  )
);

CREATE INDEX IF NOT EXISTS idx_party_price_revisions_line
  ON public.party_price_revisions (line_id, created_at, id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('party_catalogue_lines');
    PERFORM public.sa_lock_table('party_price_revisions');
  ELSE
    ALTER TABLE public.party_catalogue_lines ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.party_price_revisions ENABLE ROW LEVEL SECURITY;
    BEGIN
      ALTER TABLE public.party_catalogue_lines FORCE ROW LEVEL SECURITY;
      ALTER TABLE public.party_price_revisions FORCE ROW LEVEL SECURITY;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'party catalogue rls skip: %', SQLERRM;
END $$;

-- Kelpack buy lines (what we pay them). Do not overwrite a live accepted price.
INSERT INTO public.party_catalogue_lines (
  profile_id, party_kind, supplier_id, product_id, currency, uom,
  accepted_price, accepted_at, status
)
SELECT
  102,
  'supplier',
  12,
  seed.product_id,
  'ZAR',
  COALESCE(p.uom, 'unit'),
  seed.price,
  now(),
  'active'
FROM (
  VALUES
    (2, 28::numeric),
    (3, 28),
    (4, 28),
    (5, 28),
    (6, 28),
    (7, 35),
    (8, 28),
    (9, 28),
    (42, 99),
    (44, 500),
    (45, 685.75),
    (46, 100),
    (49, 1.35),
    (50, 1.35),
    (51, 1.35),
    (52, 1.35)
) AS seed(product_id, price)
LEFT JOIN public.products p
  ON p.id = seed.product_id AND p.profile_id = 102
WHERE NOT EXISTS (
  SELECT 1
  FROM public.party_catalogue_lines l
  WHERE l.profile_id = 102
    AND l.party_kind = 'supplier'
    AND l.supplier_id = 12
    AND l.product_id = seed.product_id
);

INSERT INTO public.party_price_revisions (
  line_id, old_price, new_price, currency, proposed_by, status, accepted_by, accepted_at
)
SELECT
  l.id,
  NULL,
  l.accepted_price,
  l.currency,
  'host',
  'accepted',
  'host',
  COALESCE(l.accepted_at, now())
FROM public.party_catalogue_lines l
WHERE l.profile_id = 102
  AND l.party_kind = 'supplier'
  AND l.supplier_id = 12
  AND NOT EXISTS (
    SELECT 1 FROM public.party_price_revisions r WHERE r.line_id = l.id
  );

-- Customer sell lines from live pricing agreements (Kenya 55 etc.).
INSERT INTO public.party_catalogue_lines (
  profile_id, party_kind, customer_id, product_id, currency, uom,
  accepted_price, accepted_at, status
)
SELECT
  pa.seller_profile_id,
  'customer',
  c.id,
  pal.seller_product_id,
  COALESCE(pal.currency, pa.currency, 'ZAR'),
  COALESCE(pal.uom, 'unit'),
  pal.list_price,
  now(),
  'active'
FROM public.pricing_agreement_lines pal
JOIN public.pricing_agreements pa ON pa.id = pal.agreement_id
JOIN public.customers c
  ON c.profile_id = pa.seller_profile_id
 AND c.linked_profile_id = pa.buyer_profile_id
WHERE pa.status = 'active'
  AND pal.seller_product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.party_catalogue_lines l
    WHERE l.profile_id = pa.seller_profile_id
      AND l.party_kind = 'customer'
      AND l.customer_id = c.id
      AND l.product_id = pal.seller_product_id
  );

INSERT INTO public.party_price_revisions (
  line_id, old_price, new_price, currency, proposed_by, status, accepted_by, accepted_at
)
SELECT
  l.id,
  NULL,
  l.accepted_price,
  l.currency,
  'host',
  'accepted',
  'host',
  COALESCE(l.accepted_at, now())
FROM public.party_catalogue_lines l
WHERE l.party_kind = 'customer'
  AND NOT EXISTS (
    SELECT 1 FROM public.party_price_revisions r WHERE r.line_id = l.id
  );
