-- Public invoice feedback (rate OTIFEF + claims via QR / link)
CREATE TABLE IF NOT EXISTS public.invoice_feedback (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_id bigint,
  invoice_number text,
  feedback_type text DEFAULT 'rate',
  rating numeric(4,2),
  otifef_score numeric(6,2),
  title text,
  body text,
  contact_email text,
  contact_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_feedback_profile ON public.invoice_feedback(profile_id);
CREATE INDEX IF NOT EXISTS idx_invoice_feedback_invoice ON public.invoice_feedback(invoice_id);

ALTER TABLE public.invoice_feedback ENABLE ROW LEVEL SECURITY;
