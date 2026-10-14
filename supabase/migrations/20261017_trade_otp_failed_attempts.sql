-- TradeAdvisor® customer sign-in codes. Durable wrong-guess counter.
-- Safe to re-run. Do not apply from the app. Not applied to the live database
-- by this change. Until this is applied, sign-in still requires the email and
-- the per-IP limit, and the magic link keeps working.

ALTER TABLE public.trade_customer_invites
  ADD COLUMN IF NOT EXISTS failed_attempts int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.trade_customer_invites.failed_attempts IS
  'Wrong sign-in codes tried against this invite. At 5 the invite is burned.';

CREATE TABLE IF NOT EXISTS public.trade_otp_failures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_otp_failures_email_recent
  ON public.trade_otp_failures (company_id, email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trade_otp_failures_book_recent
  ON public.trade_otp_failures (company_id, created_at DESC);

ALTER TABLE public.trade_otp_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_otp_failures FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trade_otp_failures FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.trade_otp_failures TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trade_otp_failures_id_seq TO service_role;

DROP POLICY IF EXISTS sa_deny_anon ON public.trade_otp_failures;
DROP POLICY IF EXISTS sa_deny_authenticated ON public.trade_otp_failures;
CREATE POLICY sa_deny_anon ON public.trade_otp_failures
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sa_deny_authenticated ON public.trade_otp_failures
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- One UPDATE increments every live invite for that email and burns at 5.
-- The failure row is the 15-minute per-email and per-book throttle.
CREATE OR REPLACE FUNCTION public.trade_otp_note_failure(
  p_company_id bigint,
  p_email text
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF p_company_id IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  DELETE FROM public.trade_otp_failures
  WHERE company_id = p_company_id
    AND created_at < now() - interval '15 minutes';

  INSERT INTO public.trade_otp_failures (company_id, email)
  VALUES (p_company_id, v_email);

  UPDATE public.trade_customer_invites
  SET
    failed_attempts = failed_attempts + 1,
    used_at = CASE
      WHEN failed_attempts + 1 >= 5 THEN now()
      ELSE used_at
    END
  WHERE company_id = p_company_id
    AND lower(email) = v_email
    AND used_at IS NULL
    AND expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.trade_otp_note_failure(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trade_otp_note_failure(bigint, text) TO service_role;

COMMENT ON FUNCTION public.trade_otp_note_failure(bigint, text) IS
  'Records one wrong TradeAdvisor® sign-in code and burns that email''s live invites at 5 failures.';

NOTIFY pgrst, 'reload schema';
