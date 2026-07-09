-- Container retail operations: inventory + replenishment orders
-- Run in Supabase SQL Editor if not already applied

CREATE TABLE IF NOT EXISTS public.container_inventory (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  container_id bigint NOT NULL REFERENCES public.containers(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  sku text,
  qty_on_hand numeric(18,4) NOT NULL DEFAULT 0,
  unit text DEFAULT 'unit',
  reorder_level numeric(18,4) DEFAULT 0,
  unit_cost numeric(18,2) DEFAULT 0,
  last_received_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_container_inventory_container ON public.container_inventory(container_id);
CREATE INDEX IF NOT EXISTS idx_container_inventory_profile ON public.container_inventory(profile_id);

CREATE TABLE IF NOT EXISTS public.container_orders (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  container_id bigint NOT NULL REFERENCES public.containers(id) ON DELETE CASCADE,
  order_number text,
  status text NOT NULL DEFAULT 'draft', -- draft | ordered | received | cancelled
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  ordered_at timestamptz,
  received_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_container_orders_container ON public.container_orders(container_id);
CREATE INDEX IF NOT EXISTS idx_container_orders_status ON public.container_orders(status);

ALTER TABLE public.container_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS container_inventory_all ON public.container_inventory;
CREATE POLICY container_inventory_all ON public.container_inventory FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS container_orders_all ON public.container_orders;
CREATE POLICY container_orders_all ON public.container_orders FOR ALL USING (true) WITH CHECK (true);
