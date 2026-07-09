-- Optional: store continent name on containers (matches profiles pattern)
ALTER TABLE public.containers ADD COLUMN IF NOT EXISTS continent text;
