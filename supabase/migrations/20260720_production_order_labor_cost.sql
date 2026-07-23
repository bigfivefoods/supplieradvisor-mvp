-- Production order labor cost capture → manufacturing_cost_entries.
-- Safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_production_orders'
  ) THEN
    ALTER TABLE public.manufacturing_production_orders
      ADD COLUMN IF NOT EXISTS work_station_id bigint
        REFERENCES public.manufacturing_work_stations(id) ON DELETE SET NULL;
    ALTER TABLE public.manufacturing_production_orders
      ADD COLUMN IF NOT EXISTS labor_hours numeric(12,4) DEFAULT 0;
    ALTER TABLE public.manufacturing_production_orders
      ADD COLUMN IF NOT EXISTS labor_cost numeric(18,2) DEFAULT 0;
    ALTER TABLE public.manufacturing_production_orders
      ADD COLUMN IF NOT EXISTS labor_rate numeric(14,4) DEFAULT 0;
    ALTER TABLE public.manufacturing_production_orders
      ADD COLUMN IF NOT EXISTS labor_cost_entry_id bigint;
    ALTER TABLE public.manufacturing_production_orders
      ADD COLUMN IF NOT EXISTS labor_captured_at timestamptz;

    CREATE INDEX IF NOT EXISTS idx_mfg_po_station
      ON public.manufacturing_production_orders (work_station_id);
  END IF;
END $$;

COMMENT ON COLUMN public.manufacturing_production_orders.labor_hours IS
  'Shop-floor hours charged to this work order (cell/station rate × hours).';
COMMENT ON COLUMN public.manufacturing_production_orders.labor_cost IS
  'Labor amount posted to manufacturing_cost_entries.';
COMMENT ON COLUMN public.manufacturing_production_orders.labor_cost_entry_id IS
  'Linked cost entry id when labor was captured.';
