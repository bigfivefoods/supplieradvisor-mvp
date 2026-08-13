/**
 * Paystack / Apple Pay domain association file body.
 * Served at:
 *   https://www.supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association
 *   https://supplieradvisor.com/.well-known/apple-developer-merchantid-domain-association
 *
 * Content-Type MUST be application/text (Paystack docs). No redirects. No trailing slash.
 * @see https://paystack.com/docs/payments/apple-pay/
 *
 * Installed 2026-08-13 from Paystack hex payload (createdOn 2026-08-12).
 * Exact bytes — do not pretty-print or add a trailing newline.
 */
export const APPLE_PAY_DOMAIN_ASSOCIATION_BODY =
  '{"version":1,"pspId":"4BE8DFE7C705DD585139674DF649F2B7DF89B44591CC26245B848EB2586E087B","createdOn":1786546082458}' as const;

export const APPLE_PAY_DOMAIN_ASSOCIATION_PATH =
  '/.well-known/apple-developer-merchantid-domain-association' as const;
