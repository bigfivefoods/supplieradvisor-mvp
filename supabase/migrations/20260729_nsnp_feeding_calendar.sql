-- DBE / PEU annual NSNP feeding calendar (cascades to schools & SPs)
-- Defines exact feeding days per year/term/month for MPS/MRP and programme planning.

CREATE TABLE IF NOT EXISTS public.nsnp_feeding_calendars (
  id bigserial PRIMARY KEY,
  agency_profile_id bigint NOT NULL,
  year int NOT NULL,
  name text NOT NULL DEFAULT 'NSNP feeding calendar',
  status text NOT NULL DEFAULT 'draft', -- draft | published
  -- ISO weekday numbers that are potential feeding days (1=Mon … 7=Sun)
  default_weekdays int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ term:1, name:"Term 1", from:"2026-01-14", to:"2026-03-27" }, ...]
  notes text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_profile_id, year)
);

CREATE INDEX IF NOT EXISTS idx_nsnp_feeding_calendars_agency
  ON public.nsnp_feeding_calendars (agency_profile_id, year);

CREATE TABLE IF NOT EXISTS public.nsnp_feeding_calendar_days (
  id bigserial PRIMARY KEY,
  calendar_id bigint NOT NULL REFERENCES public.nsnp_feeding_calendars(id) ON DELETE CASCADE,
  feed_date date NOT NULL,
  is_feeding boolean NOT NULL DEFAULT false,
  day_type text NOT NULL DEFAULT 'school_day',
  -- school_day | weekend | public_holiday | school_holiday | admin_closed | special_feeding
  label text,
  term_number int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_id, feed_date)
);

CREATE INDEX IF NOT EXISTS idx_nsnp_feeding_calendar_days_cal
  ON public.nsnp_feeding_calendar_days (calendar_id, feed_date);

CREATE INDEX IF NOT EXISTS idx_nsnp_feeding_calendar_days_feeding
  ON public.nsnp_feeding_calendar_days (calendar_id, is_feeding)
  WHERE is_feeding = true;

COMMENT ON TABLE public.nsnp_feeding_calendars IS
  'DBE annual feeding calendar: terms + rules; published to schools and SPs.';
COMMENT ON TABLE public.nsnp_feeding_calendar_days IS
  'Per-day feeding flags for an NSNP calendar year — source of truth for day counts.';
