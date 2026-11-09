/**
 * One in-flight GET for the sales agreement.
 * The shell and the page both ask for the same record on first paint.
 */

export type SalesAgreementPayload = {
  html?: string;
  error?: string;
  signed?: boolean;
  agreementSigned?: boolean;
  companyName?: string;
  subscriptionExempt?: boolean;
  isSalesContractor?: boolean;
  subscriptionActive?: boolean;
  contractVersion?: string;
  program?: {
    contract_version?: string;
    email_domain?: string | null;
    commission_tiers?: unknown;
    sales_criteria?: unknown;
  } | null;
  agreement?: {
    status?: string;
    signature_name?: string | null;
    contractor_company_name?: string | null;
    contractor_registration_number?: string | null;
    contractor_signer_capacity?: string | null;
    signed_at?: string | null;
    contract_version?: string | null;
    commission_tiers?: unknown;
  } | null;
  [key: string]: unknown;
};

type AgreementResult = {
  ok: boolean;
  status: number;
  data: SalesAgreementPayload;
};

const inflight = new Map<string, Promise<AgreementResult>>();

export function fetchSalesAgreement(search: string): Promise<AgreementResult> {
  const key = search;
  const existing = inflight.get(key);
  if (existing) return existing;
  const pending = fetch(`/api/sales/agreement?${key}`, { cache: 'no-store' })
    .then(async (res) => {
      const data = (await res.json().catch(() => ({}))) as SalesAgreementPayload;
      return { ok: res.ok, status: res.status, data };
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, pending);
  return pending;
}
