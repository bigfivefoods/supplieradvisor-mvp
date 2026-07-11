-- Quality MVP: inspections + lot release gates
-- Idempotent: safe if table partially exists from an earlier failed run.

CREATE TABLE IF NOT EXISTS quality_inspections (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist (CREATE TABLE IF NOT EXISTS does not add new cols)
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS product_id BIGINT;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS warehouse_id BIGINT;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS purchase_order_id BIGINT;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS inspection_type TEXT DEFAULT 'incoming';
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS result_grade TEXT;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS sample_size NUMERIC;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS defects_found INTEGER DEFAULT 0;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS inspector_name TEXT;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Defaults for rows that might lack type/status
UPDATE quality_inspections SET inspection_type = 'incoming' WHERE inspection_type IS NULL;
UPDATE quality_inspections SET status = 'open' WHERE status IS NULL;
UPDATE quality_inspections SET defects_found = 0 WHERE defects_found IS NULL;
UPDATE quality_inspections SET checklist = '[]'::jsonb WHERE checklist IS NULL;
UPDATE quality_inspections SET metadata = '{}'::jsonb WHERE metadata IS NULL;

-- Optional CHECKs (ignore if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quality_inspections_inspection_type_check'
  ) THEN
    ALTER TABLE quality_inspections
      ADD CONSTRAINT quality_inspections_inspection_type_check
      CHECK (inspection_type IN ('incoming', 'in_process', 'outgoing', 'hold_review', 'other'));
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'inspection_type check skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quality_inspections_status_check'
  ) THEN
    ALTER TABLE quality_inspections
      ADD CONSTRAINT quality_inspections_status_check
      CHECK (status IN ('open', 'passed', 'failed', 'conditional', 'cancelled'));
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'status check skipped: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_quality_inspections_profile
  ON quality_inspections (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_lot
  ON quality_inspections (profile_id, lot_number)
  WHERE lot_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quality_inspections_status
  ON quality_inspections (profile_id, status);

COMMENT ON TABLE quality_inspections IS
  'QA inspections with optional lot/product/PO link — release gate for food safety MVP';
