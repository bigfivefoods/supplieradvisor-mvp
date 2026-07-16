-- Ensure geo reference tables exist and are readable for cascading dropdowns.
-- App uses continents → countries → provinces (see components/geo/GeoSelectFields.tsx).

CREATE TABLE IF NOT EXISTS public.continents (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.countries (
  id serial PRIMARY KEY,
  name text NOT NULL,
  flag text,
  continent_id integer REFERENCES public.continents(id) ON DELETE SET NULL,
  iso2 text
);

CREATE UNIQUE INDEX IF NOT EXISTS countries_name_unique
  ON public.countries (lower(name));

CREATE INDEX IF NOT EXISTS countries_continent_id_idx
  ON public.countries (continent_id);

CREATE TABLE IF NOT EXISTS public.provinces (
  id serial PRIMARY KEY,
  name text NOT NULL,
  country_id integer REFERENCES public.countries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS provinces_country_id_idx
  ON public.provinces (country_id);

CREATE UNIQUE INDEX IF NOT EXISTS provinces_country_name_unique
  ON public.provinces (country_id, lower(name));

-- Public read for authenticated + anon (reference data only)
ALTER TABLE public.continents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'continents' AND policyname = 'continents_public_select'
  ) THEN
    CREATE POLICY continents_public_select ON public.continents
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'countries' AND policyname = 'countries_public_select'
  ) THEN
    CREATE POLICY countries_public_select ON public.countries
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'provinces' AND policyname = 'provinces_public_select'
  ) THEN
    CREATE POLICY provinces_public_select ON public.provinces
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- Seed continents if empty
INSERT INTO public.continents (name)
SELECT x FROM (VALUES
  ('Africa'),
  ('Antarctica'),
  ('Asia'),
  ('Europe'),
  ('North America'),
  ('Oceania'),
  ('South America')
) AS v(x)
WHERE NOT EXISTS (SELECT 1 FROM public.continents LIMIT 1);

-- Seed South Africa + provinces when countries empty (common SA default)
DO $$
DECLARE
  africa_id integer;
  za_id integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.countries LIMIT 1) THEN
    RETURN;
  END IF;

  SELECT id INTO africa_id FROM public.continents WHERE name = 'Africa' LIMIT 1;
  IF africa_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.countries (name, flag, continent_id, iso2)
  VALUES ('South Africa', '🇿🇦', africa_id, 'ZA')
  RETURNING id INTO za_id;

  INSERT INTO public.provinces (name, country_id) VALUES
    ('Eastern Cape', za_id),
    ('Free State', za_id),
    ('Gauteng', za_id),
    ('KwaZulu-Natal', za_id),
    ('Limpopo', za_id),
    ('Mpumalanga', za_id),
    ('North West', za_id),
    ('Northern Cape', za_id),
    ('Western Cape', za_id);
END $$;
