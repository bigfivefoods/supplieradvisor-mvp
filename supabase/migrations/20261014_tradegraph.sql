-- TradeAdvisor® (tradegraph) — jobs, quotes, invoices, materials, schedule,
-- compliance, and the customer PWA. Safe to re-run. Do not apply from the app.
--
-- Customer reads and job requests run as role trade_portal (NOBYPASSRLS) inside
-- public.trade_portal_call, so row security — not the service role — decides
-- which customer a session can see.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trade_portal') THEN
    CREATE ROLE trade_portal NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

GRANT trade_portal TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO trade_portal;

CREATE TABLE IF NOT EXISTS public.trade_workspaces (
  company_id bigint PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_name text NOT NULL DEFAULT '',
  trade text NOT NULL DEFAULT 'handyman',
  public_token text NOT NULL,
  vat_rate numeric NOT NULL DEFAULT 0.15,
  phone text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  notify_email text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_workspaces_trade_check CHECK (
    trade IN ('electrician', 'plumber', 'builder', 'painter', 'hvac', 'handyman', 'other')
  ),
  CONSTRAINT trade_workspaces_token_check CHECK (public_token ~ '^[A-Za-z0-9_-]{2,80}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_workspaces_token
  ON public.trade_workspaces (public_token);

CREATE TABLE IF NOT EXISTS public.trade_customers (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  suburb text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_customers_company
  ON public.trade_customers (company_id, lower(email));

CREATE TABLE IF NOT EXISTS public.trade_quotes (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES public.trade_customers(id) ON DELETE CASCADE,
  number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL DEFAULT '',
  source_request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_quotes_status_check CHECK (
    status IN ('draft', 'sent', 'accepted', 'declined', 'expired')
  )
);

CREATE INDEX IF NOT EXISTS idx_trade_quotes_customer
  ON public.trade_quotes (company_id, customer_id, status);

CREATE TABLE IF NOT EXISTS public.trade_quote_lines (
  id text PRIMARY KEY,
  quote_id text NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
  company_id bigint NOT NULL,
  customer_id text NOT NULL,
  description text NOT NULL DEFAULT '',
  qty numeric NOT NULL DEFAULT 1,
  unit_cents integer NOT NULL DEFAULT 0,
  CONSTRAINT trade_quote_lines_money CHECK (unit_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_trade_quote_lines_quote
  ON public.trade_quote_lines (quote_id);

CREATE TABLE IF NOT EXISTS public.trade_jobs (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES public.trade_customers(id) ON DELETE CASCADE,
  quote_id text,
  number text NOT NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'scheduled',
  address text NOT NULL DEFAULT '',
  progress_pct integer NOT NULL DEFAULT 0,
  CONSTRAINT trade_jobs_status_check CHECK (
    status IN ('scheduled', 'in_progress', 'done', 'invoiced', 'cancelled')
  ),
  CONSTRAINT trade_jobs_progress_check CHECK (progress_pct BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_trade_jobs_customer
  ON public.trade_jobs (company_id, customer_id, status);

CREATE TABLE IF NOT EXISTS public.trade_job_lines (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES public.trade_jobs(id) ON DELETE CASCADE,
  company_id bigint NOT NULL,
  customer_id text NOT NULL,
  description text NOT NULL DEFAULT '',
  qty numeric NOT NULL DEFAULT 1,
  unit_cents integer NOT NULL DEFAULT 0,
  CONSTRAINT trade_job_lines_money CHECK (unit_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_trade_job_lines_job
  ON public.trade_job_lines (job_id);

CREATE TABLE IF NOT EXISTS public.trade_job_updates (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES public.trade_jobs(id) ON DELETE CASCADE,
  company_id bigint NOT NULL,
  customer_id text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT '',
  progress_pct integer NOT NULL DEFAULT 0,
  photo_url text,
  shared boolean NOT NULL DEFAULT false,
  CONSTRAINT trade_job_updates_progress CHECK (progress_pct BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_trade_job_updates_job
  ON public.trade_job_updates (job_id, shared, at);

CREATE TABLE IF NOT EXISTS public.trade_invoices (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES public.trade_customers(id) ON DELETE CASCADE,
  job_id text,
  number text NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  subtotal_cents integer NOT NULL DEFAULT 0,
  vat_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  issued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_invoices_status_check CHECK (
    status IN ('issued', 'part_paid', 'paid', 'void')
  ),
  CONSTRAINT trade_invoices_money CHECK (
    subtotal_cents >= 0 AND vat_cents >= 0 AND total_cents >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_trade_invoices_customer
  ON public.trade_invoices (company_id, customer_id, status);

CREATE TABLE IF NOT EXISTS public.trade_payments (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  invoice_id text NOT NULL REFERENCES public.trade_invoices(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'EFT',
  CONSTRAINT trade_payments_amount CHECK (amount_cents > 0)
);

CREATE INDEX IF NOT EXISTS idx_trade_payments_invoice
  ON public.trade_payments (invoice_id);

CREATE TABLE IF NOT EXISTS public.trade_material_orders (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  supplier_id bigint,
  supplier_name text NOT NULL DEFAULT '',
  job_id text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_material_orders_status CHECK (status IN ('draft', 'ordered', 'received'))
);

CREATE INDEX IF NOT EXISTS idx_trade_material_orders_company
  ON public.trade_material_orders (company_id, status);

CREATE TABLE IF NOT EXISTS public.trade_material_lines (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.trade_material_orders(id) ON DELETE CASCADE,
  company_id bigint NOT NULL,
  description text NOT NULL DEFAULT '',
  qty numeric NOT NULL DEFAULT 1,
  unit_cents integer NOT NULL DEFAULT 0,
  CONSTRAINT trade_material_lines_money CHECK (unit_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.trade_schedule (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  job_id text,
  title text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  address text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_trade_schedule_company
  ON public.trade_schedule (company_id, starts_at);

CREATE TABLE IF NOT EXISTS public.trade_compliance (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  kind text NOT NULL,
  number text NOT NULL DEFAULT '',
  holder text NOT NULL DEFAULT '',
  expires_on date NOT NULL,
  job_id text,
  CONSTRAINT trade_compliance_kind CHECK (kind IN ('coc', 'pirb', 'gas', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_trade_compliance_expiry
  ON public.trade_compliance (company_id, expires_on);

CREATE TABLE IF NOT EXISTS public.trade_job_requests (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES public.trade_customers(id) ON DELETE CASCADE,
  description text NOT NULL,
  address text NOT NULL DEFAULT '',
  preferred_dates text NOT NULL DEFAULT '',
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_job_requests_status CHECK (status IN ('new', 'quoted', 'declined')),
  CONSTRAINT trade_job_requests_photos CHECK (jsonb_typeof(photo_urls) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_trade_job_requests_customer
  ON public.trade_job_requests (company_id, customer_id, status);

CREATE TABLE IF NOT EXISTS public.trade_customer_invites (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES public.trade_customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  otp_hash text,
  magic_hash text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_customer_invites_email
  ON public.trade_customer_invites (company_id, lower(email), created_at DESC);

CREATE TABLE IF NOT EXISTS public.trade_customer_sessions (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.trade_workspaces(company_id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES public.trade_customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_customer_sessions_hash
  ON public.trade_customer_sessions (token_hash);

CREATE TABLE IF NOT EXISTS public.trade_customer_push (
  id text PRIMARY KEY,
  company_id bigint NOT NULL,
  customer_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_customer_push_endpoint
  ON public.trade_customer_push (customer_id, endpoint);

-- Row security. service_role bypasses it for the tradesperson API after
-- membership checks. Customers reach rows only as trade_portal.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'trade_workspaces',
    'trade_customers',
    'trade_quotes',
    'trade_quote_lines',
    'trade_jobs',
    'trade_job_lines',
    'trade_job_updates',
    'trade_invoices',
    'trade_payments',
    'trade_material_orders',
    'trade_material_lines',
    'trade_schedule',
    'trade_compliance',
    'trade_job_requests',
    'trade_customer_invites',
    'trade_customer_sessions',
    'trade_customer_push'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_anon ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_authenticated ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY sa_deny_anon ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      t
    );
    EXECUTE format(
      'CREATE POLICY sa_deny_authenticated ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

GRANT SELECT ON TABLE
  public.trade_customers,
  public.trade_quotes,
  public.trade_quote_lines,
  public.trade_jobs,
  public.trade_job_lines,
  public.trade_job_updates,
  public.trade_invoices,
  public.trade_payments,
  public.trade_job_requests
TO trade_portal;

GRANT INSERT ON TABLE public.trade_job_requests, public.trade_customer_push TO trade_portal;
GRANT SELECT, UPDATE, DELETE ON TABLE public.trade_customer_push TO trade_portal;

DROP POLICY IF EXISTS trade_portal_customer ON public.trade_customers;
CREATE POLICY trade_portal_customer ON public.trade_customers
  FOR SELECT TO trade_portal
  USING (id = current_setting('trade.customer_id', true));

DROP POLICY IF EXISTS trade_portal_quotes ON public.trade_quotes;
CREATE POLICY trade_portal_quotes ON public.trade_quotes
  FOR SELECT TO trade_portal
  USING (
    customer_id = current_setting('trade.customer_id', true)
    AND status <> 'draft'
  );

DROP POLICY IF EXISTS trade_portal_quote_lines ON public.trade_quote_lines;
CREATE POLICY trade_portal_quote_lines ON public.trade_quote_lines
  FOR SELECT TO trade_portal
  USING (
    customer_id = current_setting('trade.customer_id', true)
    AND EXISTS (
      SELECT 1 FROM public.trade_quotes q
      WHERE q.id = quote_id AND q.status <> 'draft'
    )
  );

DROP POLICY IF EXISTS trade_portal_jobs ON public.trade_jobs;
CREATE POLICY trade_portal_jobs ON public.trade_jobs
  FOR SELECT TO trade_portal
  USING (
    customer_id = current_setting('trade.customer_id', true)
    AND status <> 'cancelled'
  );

DROP POLICY IF EXISTS trade_portal_job_lines ON public.trade_job_lines;
CREATE POLICY trade_portal_job_lines ON public.trade_job_lines
  FOR SELECT TO trade_portal
  USING (customer_id = current_setting('trade.customer_id', true));

DROP POLICY IF EXISTS trade_portal_updates ON public.trade_job_updates;
CREATE POLICY trade_portal_updates ON public.trade_job_updates
  FOR SELECT TO trade_portal
  USING (
    customer_id = current_setting('trade.customer_id', true)
    AND shared = true
  );

DROP POLICY IF EXISTS trade_portal_invoices ON public.trade_invoices;
CREATE POLICY trade_portal_invoices ON public.trade_invoices
  FOR SELECT TO trade_portal
  USING (
    customer_id = current_setting('trade.customer_id', true)
    AND status <> 'void'
  );

DROP POLICY IF EXISTS trade_portal_payments ON public.trade_payments;
CREATE POLICY trade_portal_payments ON public.trade_payments
  FOR SELECT TO trade_portal
  USING (customer_id = current_setting('trade.customer_id', true));

DROP POLICY IF EXISTS trade_portal_requests_select ON public.trade_job_requests;
CREATE POLICY trade_portal_requests_select ON public.trade_job_requests
  FOR SELECT TO trade_portal
  USING (customer_id = current_setting('trade.customer_id', true));

DROP POLICY IF EXISTS trade_portal_requests_insert ON public.trade_job_requests;
CREATE POLICY trade_portal_requests_insert ON public.trade_job_requests
  FOR INSERT TO trade_portal
  WITH CHECK (
    customer_id = current_setting('trade.customer_id', true)
    AND company_id = current_setting('trade.company_id', true)::bigint
    AND status = 'new'
  );

DROP POLICY IF EXISTS trade_portal_push_all ON public.trade_customer_push;
CREATE POLICY trade_portal_push_all ON public.trade_customer_push
  FOR ALL TO trade_portal
  USING (customer_id = current_setting('trade.customer_id', true))
  WITH CHECK (
    customer_id = current_setting('trade.customer_id', true)
    AND company_id = current_setting('trade.company_id', true)::bigint
  );

CREATE OR REPLACE FUNCTION public.trade_portal_call(
  p_token text,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_customer text;
  v_company bigint;
  v_brand jsonb;
  v_result jsonb;
  v_photos jsonb;
  v_photo text;
  v_id text;
  v_description text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN
    RAISE EXCEPTION 'invalid_session' USING ERRCODE = '28000';
  END IF;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  SELECT customer_id, company_id INTO v_customer, v_company
  FROM public.trade_customer_sessions
  WHERE token_hash = v_hash
    AND expires_at > now()
    AND revoked_at IS NULL;
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'invalid_session' USING ERRCODE = '28000';
  END IF;

  SELECT jsonb_build_object(
    'brand_name', w.brand_name,
    'trade', w.trade,
    'public_token', w.public_token,
    'vat_rate', w.vat_rate,
    'phone', w.phone,
    'city', w.city,
    'notify_email', ''
  ) INTO v_brand
  FROM public.trade_workspaces w
  WHERE w.company_id = v_company;

  PERFORM set_config('trade.customer_id', v_customer, true);
  PERFORM set_config('trade.company_id', v_company::text, true);
  SET LOCAL ROLE trade_portal;

  IF p_action = 'home' THEN
    SELECT jsonb_build_object(
      'brand', v_brand,
      'customer', (
        SELECT to_jsonb(c) FROM public.trade_customers c WHERE c.id = v_customer
      ),
      'jobs', COALESCE((
        SELECT jsonb_agg(row_to_json(j) ORDER BY j.number)
        FROM (
          SELECT
            job.*,
            COALESCE((
              SELECT jsonb_agg(u ORDER BY u.at)
              FROM public.trade_job_updates u
              WHERE u.job_id = job.id
            ), '[]'::jsonb) AS updates,
            COALESCE((
              SELECT jsonb_agg(l)
              FROM public.trade_job_lines l
              WHERE l.job_id = job.id
            ), '[]'::jsonb) AS lines
          FROM public.trade_jobs job
        ) j
      ), '[]'::jsonb),
      'quotes', COALESCE((
        SELECT jsonb_agg(row_to_json(q) ORDER BY q.number)
        FROM (
          SELECT
            quote.*,
            COALESCE((
              SELECT jsonb_agg(l)
              FROM public.trade_quote_lines l
              WHERE l.quote_id = quote.id
            ), '[]'::jsonb) AS lines
          FROM public.trade_quotes quote
        ) q
      ), '[]'::jsonb),
      'invoices', COALESCE((
        SELECT jsonb_agg(i ORDER BY i.issued_at) FROM public.trade_invoices i
      ), '[]'::jsonb),
      'payments', COALESCE((
        SELECT jsonb_agg(p ORDER BY p.paid_at) FROM public.trade_payments p
      ), '[]'::jsonb),
      'requests', COALESCE((
        SELECT jsonb_agg(r ORDER BY r.created_at DESC) FROM public.trade_job_requests r
      ), '[]'::jsonb)
    ) INTO v_result;
  ELSIF p_action = 'request' THEN
    v_description := left(btrim(COALESCE(p_payload->>'description', '')), 4000);
    IF length(v_description) < 8 THEN
      RAISE EXCEPTION 'description_too_short';
    END IF;
    v_photos := COALESCE(p_payload->'photo_urls', '[]'::jsonb);
    IF jsonb_typeof(v_photos) IS DISTINCT FROM 'array' OR jsonb_array_length(v_photos) > 3 THEN
      RAISE EXCEPTION 'too_many_photos';
    END IF;
    FOR v_photo IN SELECT value FROM jsonb_array_elements_text(v_photos) LOOP
      IF length(v_photo) > 400000 THEN
        RAISE EXCEPTION 'photo_too_large';
      END IF;
    END LOOP;
    v_id := 'tr_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    INSERT INTO public.trade_job_requests (
      id, company_id, customer_id, description, address, preferred_dates, photo_urls, status
    ) VALUES (
      v_id,
      current_setting('trade.company_id', true)::bigint,
      current_setting('trade.customer_id', true),
      v_description,
      left(COALESCE(p_payload->>'address', ''), 500),
      left(COALESCE(p_payload->>'preferred_dates', ''), 200),
      v_photos,
      'new'
    );
    v_result := jsonb_build_object('id', v_id);
  ELSIF p_action = 'push' THEN
    IF length(COALESCE(p_payload->>'endpoint', '')) < 12 THEN
      RAISE EXCEPTION 'push_endpoint_required';
    END IF;
    v_id := 'tn_' || substr(md5(COALESCE(p_payload->>'endpoint', '')), 1, 16);
    INSERT INTO public.trade_customer_push (
      id, company_id, customer_id, endpoint, p256dh, auth
    ) VALUES (
      v_id,
      current_setting('trade.company_id', true)::bigint,
      current_setting('trade.customer_id', true),
      left(p_payload->>'endpoint', 2000),
      left(COALESCE(p_payload->>'p256dh', ''), 400),
      left(COALESCE(p_payload->>'auth', ''), 400)
    )
    ON CONFLICT (customer_id, endpoint) DO UPDATE
      SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth;
    v_result := jsonb_build_object('ok', true);
  ELSE
    RAISE EXCEPTION 'unknown_action';
  END IF;

  RESET ROLE;
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    BEGIN
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.trade_portal_call(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trade_portal_call(text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.trade_portal_call(text, text, jsonb) IS
  'Customer PWA read/write. Drops to trade_portal before touching customer rows so RLS applies.';

DO $$
BEGIN
  PERFORM public.sa_lock_table('trade_workspaces');
EXCEPTION WHEN undefined_function OR undefined_table THEN
  NULL;
END $$;

NOTIFY pgrst, 'reload schema';
