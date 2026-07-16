-- Platform improvements: SAM chat log, rating prompts, onboarding checklist
-- Idempotent.

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=p_table AND column_name=p_column
  ) THEN
    IF p_default IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    ELSE
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s', p_table, p_column, p_type, p_default);
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

-- SAM conversation log (company-scoped advice audit)
CREATE TABLE IF NOT EXISTS public.sam_conversations (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  user_id text NOT NULL,
  pathname text,
  model text,
  api text,
  user_message text NOT NULL,
  assistant_message text,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sam_conv_profile
  ON public.sam_conversations (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sam_conv_user
  ON public.sam_conversations (user_id, created_at DESC);

-- Rating prompts queue (nudge after trade)
CREATE TABLE IF NOT EXISTS public.rating_prompts (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  user_id text,
  counterparty_profile_id bigint,
  counterparty_name text,
  ratee_role text NOT NULL DEFAULT 'supplier',
  -- supplier | customer | partner
  context_type text NOT NULL DEFAULT 'general',
  -- po | invoice | general
  context_id text,
  status text NOT NULL DEFAULT 'pending',
  -- pending | completed | dismissed | expired
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rating_prompts_profile_status
  ON public.rating_prompts (profile_id, status, created_at DESC);

-- Company onboarding checklist progress
CREATE TABLE IF NOT EXISTS public.company_onboarding_progress (
  profile_id bigint PRIMARY KEY,
  steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Founding waitlist when founding slots full
CREATE TABLE IF NOT EXISTS public.founding_waitlist (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  company_name text,
  user_id text,
  notes text,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_founding_waitlist_email
  ON public.founding_waitlist (lower(email));

DO $$
BEGIN
  ALTER TABLE public.sam_conversations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.rating_prompts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.company_onboarding_progress ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.founding_waitlist ENABLE ROW LEVEL SECURITY;

  CREATE POLICY deny_anon_sam ON public.sam_conversations
    FOR ALL TO anon USING (false) WITH CHECK (false);
  CREATE POLICY deny_anon_rating_prompts ON public.rating_prompts
    FOR ALL TO anon USING (false) WITH CHECK (false);
  CREATE POLICY deny_anon_onboarding ON public.company_onboarding_progress
    FOR ALL TO anon USING (false) WITH CHECK (false);
  CREATE POLICY deny_anon_waitlist ON public.founding_waitlist
    FOR ALL TO anon USING (false) WITH CHECK (false);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'platform improvements RLS skip: %', SQLERRM;
END $$;
