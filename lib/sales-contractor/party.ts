/**
 * How a sales contractor is named on the agreement.
 * A blank company name leaves the person as the contracting party.
 */

export const CONTRACTOR_COMPANY_NAME_MAX = 160;
export const CONTRACTOR_REGISTRATION_MAX = 64;
/** Stored in agreement metadata. No new column. */
export const CONTRACTOR_SIGNER_CAPACITY_MAX = 80;

export const SALES_AGREEMENT_OPTIONAL_COLUMNS = [
  'contractor_company_name',
  'contractor_registration_number',
  'contract_resent_at',
] as const;

export function cleanAgreementText(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Who the contract is with.
 * With no company name, the person's name is returned unchanged.
 * With a company name, the company is the contracting party.
 */
export function contractorContractingParty(input: {
  personName?: string | null;
  companyName?: string | null;
  registrationNumber?: string | null;
}): string {
  const person = String(input.personName ?? '');
  const company = cleanAgreementText(input.companyName, CONTRACTOR_COMPANY_NAME_MAX);
  if (!company) return person;
  const registration = cleanAgreementText(
    input.registrationNumber,
    CONTRACTOR_REGISTRATION_MAX
  );
  return registration ? `${company} (reg no ${registration})` : company;
}

/**
 * Signature block when the contract is with a company.
 * Empty when no company name is set, so the personal signature line stays as it is.
 */
export function contractorExecutionLine(input: {
  personName?: string | null;
  companyName?: string | null;
  registrationNumber?: string | null;
  capacity?: string | null;
}): string {
  const company = cleanAgreementText(input.companyName, CONTRACTOR_COMPANY_NAME_MAX);
  if (!company) return '';
  const person = String(input.personName ?? '').trim() || 'the authorised representative';
  const registration = cleanAgreementText(
    input.registrationNumber,
    CONTRACTOR_REGISTRATION_MAX
  );
  const capacity = cleanAgreementText(input.capacity, CONTRACTOR_SIGNER_CAPACITY_MAX);
  const regPart = registration ? `, reg no ${registration}` : '';
  const capacityPart = capacity ? `, ${capacity}` : '';
  return `For and on behalf of ${company}${regPart}, signed by ${person}${capacityPart}, who warrants they are duly authorised`;
}

export function contractingPartyFromMeta(
  meta: {
    contractorName?: string | null;
    signatureName?: string | null;
    contractorCompanyName?: string | null;
    contractorRegistrationNumber?: string | null;
    signerCapacity?: string | null;
  },
  source: 'contractor' | 'signatory'
): string {
  const person =
    source === 'signatory'
      ? meta.signatureName || meta.contractorName || ''
      : meta.contractorName || '';
  if (source === 'signatory') {
    const execution = contractorExecutionLine({
      personName: person,
      companyName: meta.contractorCompanyName,
      registrationNumber: meta.contractorRegistrationNumber,
      capacity: meta.signerCapacity,
    });
    if (execution) return execution;
  }
  return contractorContractingParty({
    personName: person,
    companyName: meta.contractorCompanyName,
    registrationNumber: meta.contractorRegistrationNumber,
  });
}

/** Filename segment: the company when the contract is with one, otherwise the person. */
export function agreementFilenameParty(
  companyName?: string | null,
  personName?: string | null
): string {
  const company = cleanAgreementText(companyName, CONTRACTOR_COMPANY_NAME_MAX);
  if (company) return company;
  return String(personName ?? '');
}

/** Ledger / earnings line. Blank company keeps the existing label. */
export function commissionActivityLabel(input: {
  status?: string | null;
  customerName?: string | null;
  sourceType?: string | null;
  companyName?: string | null;
}): string {
  const base = `${input.status || ''} commission · ${input.customerName || input.sourceType || ''}`.trim();
  const company = cleanAgreementText(input.companyName, CONTRACTOR_COMPANY_NAME_MAX);
  if (!company) return base;
  return `Payable to ${company} · ${base}`;
}

export function metadataObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function readContractorEntity(row: {
  contractor_company_name?: unknown;
  contractor_registration_number?: unknown;
  contract_resent_at?: unknown;
  metadata?: unknown;
}): {
  contractor_company_name: string | null;
  contractor_registration_number: string | null;
  contractor_signer_capacity: string | null;
  contract_resent_at: string | null;
  contract_resend_count: number;
} {
  const meta = metadataObject(row.metadata);
  const company =
    cleanAgreementText(row.contractor_company_name, CONTRACTOR_COMPANY_NAME_MAX) ||
    cleanAgreementText(meta.contractor_company_name, CONTRACTOR_COMPANY_NAME_MAX);
  const registration =
    cleanAgreementText(row.contractor_registration_number, CONTRACTOR_REGISTRATION_MAX) ||
    cleanAgreementText(meta.contractor_registration_number, CONTRACTOR_REGISTRATION_MAX);
  const capacity = cleanAgreementText(
    meta.contractor_signer_capacity,
    CONTRACTOR_SIGNER_CAPACITY_MAX
  );
  const resentRaw = row.contract_resent_at ?? meta.contract_resent_at;
  const resent = resentRaw ? String(resentRaw) : '';
  const count = Number(meta.contract_resend_count);
  return {
    contractor_company_name: company || null,
    contractor_registration_number: registration || null,
    contractor_signer_capacity: company ? capacity || null : null,
    contract_resent_at: resent || null,
    contract_resend_count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
  };
}

export function withContractorEntityMetadata(
  raw: unknown,
  entity: { company: string | null; registration: string | null; capacity?: string | null }
): Record<string, unknown> {
  const capacity = entity.company
    ? cleanAgreementText(entity.capacity, CONTRACTOR_SIGNER_CAPACITY_MAX) || null
    : null;
  return {
    ...metadataObject(raw),
    contractor_company_name: entity.company,
    contractor_registration_number: entity.registration,
    contractor_signer_capacity: capacity,
  };
}

export function withResendMetadata(raw: unknown, at: string): Record<string, unknown> {
  const meta = metadataObject(raw);
  const count = Number(meta.contract_resend_count);
  const next = Number.isFinite(count) && count > 0 ? Math.floor(count) + 1 : 1;
  return {
    ...meta,
    contract_resent_at: at,
    contract_resend_count: next,
  };
}

export function isMissingSalesAgreementColumn(message: string): boolean {
  return (
    /column|schema cache|does not exist/i.test(message) &&
    SALES_AGREEMENT_OPTIONAL_COLUMNS.some((key) => message.includes(key))
  );
}

export function omitSalesAgreementOptionalColumns(
  patch: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...patch };
  for (const key of SALES_AGREEMENT_OPTIONAL_COLUMNS) delete next[key];
  return next;
}

/** Already-signed agreements are not resent. */
export function agreementResendDecision(input: {
  email?: string | null;
  status?: string | null;
}): { ok: true; email: string } | { ok: false; error: string; status: number } {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email.includes('@') || /\s/.test(email)) {
    return { ok: false, error: 'This contractor has no email address.', status: 400 };
  }
  if (String(input.status || '').toLowerCase() === 'signed') {
    return {
      ok: false,
      error: 'This agreement is already signed. It is not resent.',
      status: 409,
    };
  }
  return { ok: true, email };
}

/**
 * Active members open the agreement in the sales portal.
 * Anyone still invited uses the existing join link when we have one.
 */
export function salesAgreementResendHref(opts: {
  appUrl?: string | null;
  memberStatus?: string | null;
  joinLink?: string | null;
}): string {
  const status = String(opts.memberStatus || '').toLowerCase();
  const join = String(opts.joinLink || '').trim();
  if (status !== 'active' && join) return join;
  const base = String(opts.appUrl || 'https://www.supplieradvisor.com').replace(/\/$/, '');
  return `${base}/sales/agreement`;
}
