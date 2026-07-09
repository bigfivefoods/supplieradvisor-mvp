-- World-class CRM: customers + leads + opportunities
-- Safe / idempotent for Supabase SQL Editor

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

-- ── Customers (account master) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id bigserial PRIMARY KEY,
  trading_name text NOT NULL DEFAULT 'Customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('customers', 'profile_id', 'bigint');
SELECT public.sa_add_column('customers', 'trading_name', 'text');
SELECT public.sa_add_column('customers', 'legal_name', 'text');
SELECT public.sa_add_column('customers', 'email', 'text');
SELECT public.sa_add_column('customers', 'phone', 'text');
SELECT public.sa_add_column('customers', 'status', 'text', '''active''');
SELECT public.sa_add_column('customers', 'customer_type', 'text', '''business'''); -- business | individual | government | ngo
SELECT public.sa_add_column('customers', 'billing_address', 'text');
SELECT public.sa_add_column('customers', 'shipping_address', 'text');
SELECT public.sa_add_column('customers', 'credit_limit', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customers', 'linked_profile_id', 'bigint');
SELECT public.sa_add_column('customers', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('customers', 'contact_name', 'text');
SELECT public.sa_add_column('customers', 'job_title', 'text');
SELECT public.sa_add_column('customers', 'website', 'text');
SELECT public.sa_add_column('customers', 'industry', 'text');
SELECT public.sa_add_column('customers', 'vat_number', 'text');
SELECT public.sa_add_column('customers', 'registration_number', 'text');
SELECT public.sa_add_column('customers', 'city', 'text');
SELECT public.sa_add_column('customers', 'country', 'text');
SELECT public.sa_add_column('customers', 'region', 'text');
SELECT public.sa_add_column('customers', 'postal_code', 'text');
SELECT public.sa_add_column('customers', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('customers', 'payment_terms', 'text');
SELECT public.sa_add_column('customers', 'source', 'text');
SELECT public.sa_add_column('customers', 'owner_name', 'text');
SELECT public.sa_add_column('customers', 'tags', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('customers', 'notes', 'text');
SELECT public.sa_add_column('customers', 'rating', 'int', '0');

-- ── Leads (top-of-funnel prospects) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id bigserial PRIMARY KEY,
  name text NOT NULL DEFAULT 'Lead',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('leads', 'profile_id', 'bigint');
SELECT public.sa_add_column('leads', 'name', 'text');
SELECT public.sa_add_column('leads', 'company_name', 'text');
SELECT public.sa_add_column('leads', 'email', 'text');
SELECT public.sa_add_column('leads', 'phone', 'text');
SELECT public.sa_add_column('leads', 'job_title', 'text');
SELECT public.sa_add_column('leads', 'website', 'text');
SELECT public.sa_add_column('leads', 'status', 'text', '''new''');
-- new | contacted | working | qualified | unqualified | converted | recycled
SELECT public.sa_add_column('leads', 'source', 'text');
SELECT public.sa_add_column('leads', 'source_detail', 'text');
SELECT public.sa_add_column('leads', 'industry', 'text');
SELECT public.sa_add_column('leads', 'city', 'text');
SELECT public.sa_add_column('leads', 'region', 'text');
SELECT public.sa_add_column('leads', 'country', 'text');
SELECT public.sa_add_column('leads', 'address', 'text');
SELECT public.sa_add_column('leads', 'value_estimate', 'numeric(18,2)', '0');
SELECT public.sa_add_column('leads', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('leads', 'score', 'int', '0');
SELECT public.sa_add_column('leads', 'priority', 'text', '''medium''');
SELECT public.sa_add_column('leads', 'owner_name', 'text');
SELECT public.sa_add_column('leads', 'owner_user_id', 'text');
SELECT public.sa_add_column('leads', 'next_action', 'text');
SELECT public.sa_add_column('leads', 'next_action_date', 'date');
SELECT public.sa_add_column('leads', 'notes', 'text');
SELECT public.sa_add_column('leads', 'tags', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('leads', 'product_interest', 'text');
SELECT public.sa_add_column('leads', 'converted_customer_id', 'bigint');
SELECT public.sa_add_column('leads', 'converted_opportunity_id', 'bigint');
SELECT public.sa_add_column('leads', 'converted_at', 'timestamptz');
SELECT public.sa_add_column('leads', 'last_contacted_at', 'timestamptz');
SELECT public.sa_add_column('leads', 'metadata', 'jsonb', '''{}''::jsonb');

-- ── Opportunities (pipeline deals) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.opportunities (
  id bigserial PRIMARY KEY,
  name text NOT NULL DEFAULT 'Opportunity',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('opportunities', 'profile_id', 'bigint');
SELECT public.sa_add_column('opportunities', 'lead_id', 'bigint');
SELECT public.sa_add_column('opportunities', 'customer_id', 'bigint');
SELECT public.sa_add_column('opportunities', 'name', 'text');
SELECT public.sa_add_column('opportunities', 'contact_name', 'text');
SELECT public.sa_add_column('opportunities', 'contact_email', 'text');
SELECT public.sa_add_column('opportunities', 'contact_phone', 'text');
SELECT public.sa_add_column('opportunities', 'contact_number', 'text'); -- legacy alias
SELECT public.sa_add_column('opportunities', 'company_name', 'text');
SELECT public.sa_add_column('opportunities', 'stage', 'text', '''prospecting''');
-- prospecting | qualification | needs_analysis | proposal | negotiation | closed_won | closed_lost
SELECT public.sa_add_column('opportunities', 'status', 'text', '''open'''); -- open | won | lost
SELECT public.sa_add_column('opportunities', 'probability', 'int', '10');
SELECT public.sa_add_column('opportunities', 'amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('opportunities', 'opportunity_size', 'numeric(18,2)', '0'); -- legacy
SELECT public.sa_add_column('opportunities', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('opportunities', 'expected_close_date', 'date');
SELECT public.sa_add_column('opportunities', 'estimated_date', 'date'); -- legacy
SELECT public.sa_add_column('opportunities', 'actual_close_date', 'date');
SELECT public.sa_add_column('opportunities', 'opportunity_type', 'text', '''new_business''');
-- new_business | renewal | upsell | cross_sell
SELECT public.sa_add_column('opportunities', 'product_interest', 'text');
SELECT public.sa_add_column('opportunities', 'location', 'text');
SELECT public.sa_add_column('opportunities', 'opportunity_location', 'text');
SELECT public.sa_add_column('opportunities', 'description', 'text');
SELECT public.sa_add_column('opportunities', 'notes', 'text');
SELECT public.sa_add_column('opportunities', 'next_step', 'text');
SELECT public.sa_add_column('opportunities', 'next_step_date', 'date');
SELECT public.sa_add_column('opportunities', 'owner_name', 'text');
SELECT public.sa_add_column('opportunities', 'competitor', 'text');
SELECT public.sa_add_column('opportunities', 'lost_reason', 'text');
SELECT public.sa_add_column('opportunities', 'source', 'text');
SELECT public.sa_add_column('opportunities', 'priority', 'text', '''medium''');
SELECT public.sa_add_column('opportunities', 'tags', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('opportunities', 'metadata', 'jsonb', '''{}''::jsonb');

-- Activity log (calls, meetings, emails, notes)
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  entity_type text NOT NULL, -- lead | opportunity | customer
  entity_id bigint NOT NULL,
  activity_type text NOT NULL DEFAULT 'note', -- note | call | email | meeting | task | stage_change
  subject text,
  body text,
  activity_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('crm_activities', 'profile_id', 'bigint');
SELECT public.sa_add_column('crm_activities', 'entity_type', 'text');
SELECT public.sa_add_column('crm_activities', 'entity_id', 'bigint');
SELECT public.sa_add_column('crm_activities', 'activity_type', 'text', '''note''');
SELECT public.sa_add_column('crm_activities', 'subject', 'text');
SELECT public.sa_add_column('crm_activities', 'body', 'text');
SELECT public.sa_add_column('crm_activities', 'activity_at', 'timestamptz');
SELECT public.sa_add_column('crm_activities', 'created_by', 'text');

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_customers_profile ON public.customers(profile_id);
  CREATE INDEX IF NOT EXISTS idx_leads_profile ON public.leads(profile_id);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
  CREATE INDEX IF NOT EXISTS idx_opportunities_profile ON public.opportunities(profile_id);
  CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON public.opportunities(stage);
  CREATE INDEX IF NOT EXISTS idx_crm_activities_entity ON public.crm_activities(entity_type, entity_id);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'crm index skip: %', SQLERRM;
END $$;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_all ON public.customers;
CREATE POLICY customers_all ON public.customers FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS leads_all ON public.leads;
CREATE POLICY leads_all ON public.leads FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS opportunities_all ON public.opportunities;
CREATE POLICY opportunities_all ON public.opportunities FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS crm_activities_all ON public.crm_activities;
CREATE POLICY crm_activities_all ON public.crm_activities FOR ALL USING (true) WITH CHECK (true);

SELECT 'customers' AS t, count(*) AS cols FROM information_schema.columns WHERE table_schema='public' AND table_name='customers'
UNION ALL SELECT 'leads', count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='leads'
UNION ALL SELECT 'opportunities', count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='opportunities'
UNION ALL SELECT 'crm_activities', count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_activities';
