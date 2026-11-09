/**
 * VAT vendor settings and return status.
 * Reads profiles.vat_number. Does not create a second VAT number column.
 * Missing tables are reported; this module does not apply the migration.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  categoryAllowsEnd,
  defaultVatSettings,
  normaliseVatNumber,
  vatNumberError,
  type VatBasis,
  type VatFilingChannel,
  type VatPeriodCategory,
  type VatReturnStatus,
  type VatVendorSettings,
} from '@/lib/accounting/vat201-model';

const MIGRATION_FILE = 'supabase/migrations/20261109_vat201_returns.sql';

export const VAT201_MIGRATION_MESSAGE = `VAT201 tables are not in this database yet. ${MIGRATION_FILE} is waiting for approval and must not be applied to the production Supabase project.`;

function missingTable(message: string): boolean {
  return /does not exist|schema cache|could not find the table/i.test(message);
}

export type StoredVatSettings = VatVendorSettings & {
  persisted: boolean;
  warning?: string;
};

export async function readCompanyProfile(profileId: number): Promise<{
  vatNumber: string;
  tradingName: string;
  address: string;
}> {
  const supabase = getSupabaseServer();
  const full = await supabase
    .from('profiles')
    .select('vat_number, trading_name, legal_name, physical_address, billing_address')
    .eq('id', profileId)
    .maybeSingle();
  if (!full.error && full.data) {
    const row = full.data as Record<string, unknown>;
    return {
      vatNumber: normaliseVatNumber(row.vat_number != null ? String(row.vat_number) : ''),
      tradingName: String(row.trading_name || row.legal_name || 'Company'),
      address: String(row.physical_address || row.billing_address || ''),
    };
  }
  const slim = await supabase
    .from('profiles')
    .select('vat_number, trading_name, legal_name')
    .eq('id', profileId)
    .maybeSingle();
  const row = (slim.data || {}) as Record<string, unknown>;
  return {
    vatNumber: normaliseVatNumber(row.vat_number != null ? String(row.vat_number) : ''),
    tradingName: String(row.trading_name || row.legal_name || 'Company'),
    address: '',
  };
}

export async function readVatSettings(profileId: number): Promise<StoredVatSettings> {
  const profile = await readCompanyProfile(profileId);
  const defaults = defaultVatSettings(profileId, { vat_number: profile.vatNumber });
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('vat_vendor_settings')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) {
    return {
      ...defaults,
      vatNumber: profile.vatNumber || defaults.vatNumber,
      persisted: false,
      warning: missingTable(error.message) ? VAT201_MIGRATION_MESSAGE : error.message,
    };
  }
  if (!data) {
    return {
      ...defaults,
      vatNumber: profile.vatNumber || defaults.vatNumber,
      persisted: false,
    };
  }
  const row = data as Record<string, unknown>;
  return {
    vatNumber: profile.vatNumber || defaults.vatNumber,
    basis: (String(row.vat_basis || defaults.basis) as VatBasis) || defaults.basis,
    category: (String(row.period_category || defaults.category) as VatPeriodCategory) || defaults.category,
    effectiveFrom: String(row.effective_from || defaults.effectiveFrom || '').slice(0, 10),
    firstPeriodEnd: String(row.first_period_end || defaults.firstPeriodEnd || '').slice(0, 10),
    filingChannel: (String(row.filing_channel || defaults.filingChannel) as VatFilingChannel) || 'efiling',
    persisted: true,
  };
}

export function validateVatSettings(input: VatVendorSettings): string | null {
  const vatError = vatNumberError(input.vatNumber);
  if (vatError) return vatError;
  if (!['payment', 'invoice', 'hybrid'].includes(input.basis)) return 'VAT basis must be payment, invoice, or hybrid.';
  if (!['A', 'B', 'C', 'D', 'E'].includes(input.category)) return 'Period category must be A, B, C, D, or E.';
  if (!input.effectiveFrom) return 'Enter the VAT effective date.';
  if (!categoryAllowsEnd(input.category, input.firstPeriodEnd)) {
    return 'The first period must end on a month-end that matches the category. Category B ends on the last day of Feb, Apr, Jun, Aug, Oct, or Dec.';
  }
  if (input.firstPeriodEnd < input.effectiveFrom) return 'The first period end is before the effective date.';
  if (!['manual', 'efiling'].includes(input.filingChannel)) return 'Filing channel must be manual or eFiling.';
  return null;
}

export async function saveVatSettings(
  profileId: number,
  input: VatVendorSettings
): Promise<{ ok: true; settings: StoredVatSettings } | { ok: false; error: string; migration?: boolean }> {
  const invalid = validateVatSettings(input);
  if (invalid) return { ok: false, error: invalid };
  const supabase = getSupabaseServer();
  const vatNumber = normaliseVatNumber(input.vatNumber);
  const profileUpdate = await supabase
    .from('profiles')
    .update({ vat_number: vatNumber })
    .eq('id', profileId);
  if (profileUpdate.error) return { ok: false, error: profileUpdate.error.message };

  const row = {
    profile_id: profileId,
    vat_basis: input.basis,
    period_category: input.category,
    effective_from: input.effectiveFrom,
    first_period_end: input.firstPeriodEnd,
    filing_channel: input.filingChannel,
    isv_submit_enabled: false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('vat_vendor_settings').upsert(row, { onConflict: 'profile_id' });
  if (error) {
    return {
      ok: false,
      error: missingTable(error.message) ? VAT201_MIGRATION_MESSAGE : error.message,
      migration: missingTable(error.message),
    };
  }
  return {
    ok: true,
    settings: { ...input, vatNumber, persisted: true },
  };
}

export type StoredVatReturn = {
  id?: number;
  status: VatReturnStatus;
  locked: boolean;
  snapshot: unknown;
  submissionReference: string;
  submittedOn: string;
  paymentReference: string;
  paidOn: string;
  paymentAmount: number | null;
  settlementJournalId: number | null;
  lockedMonths: string[];
  persisted: boolean;
  warning?: string;
};

const EMPTY_RETURN: StoredVatReturn = {
  status: 'draft',
  locked: false,
  snapshot: null,
  submissionReference: '',
  submittedOn: '',
  paymentReference: '',
  paidOn: '',
  paymentAmount: null,
  settlementJournalId: null,
  lockedMonths: [],
  persisted: false,
};

function mapReturn(row: Record<string, unknown>): StoredVatReturn {
  return {
    id: Number(row.id),
    status: (String(row.status || 'draft') as VatReturnStatus) || 'draft',
    locked: row.locked === true,
    snapshot: row.snapshot ?? null,
    submissionReference: String(row.submission_reference || ''),
    submittedOn: String(row.submitted_on || '').slice(0, 10),
    paymentReference: String(row.payment_reference || ''),
    paidOn: String(row.paid_on || '').slice(0, 10),
    paymentAmount: row.payment_amount != null ? Number(row.payment_amount) : null,
    settlementJournalId: row.settlement_journal_id != null ? Number(row.settlement_journal_id) : null,
    lockedMonths: Array.isArray(row.locked_months) ? row.locked_months.map(String) : [],
    persisted: true,
  };
}

export async function readVatReturn(
  profileId: number,
  periodStart: string,
  periodEnd: string
): Promise<StoredVatReturn> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('vat_returns')
    .select('*')
    .eq('profile_id', profileId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle();
  if (error) {
    return {
      ...EMPTY_RETURN,
      warning: missingTable(error.message) ? VAT201_MIGRATION_MESSAGE : error.message,
    };
  }
  if (!data) return { ...EMPTY_RETURN };
  return mapReturn(data as Record<string, unknown>);
}

export async function writeVatReturn(
  profileId: number,
  patch: {
    periodStart: string;
    periodEnd: string;
    status: VatReturnStatus;
    locked: boolean;
    snapshot?: unknown;
    submissionReference?: string;
    submittedOn?: string;
    paymentReference?: string;
    paidOn?: string;
    paymentAmount?: number | null;
    settlementJournalId?: number | null;
    lockedMonths?: string[];
    actor?: string | null;
  }
): Promise<{ ok: true; row: StoredVatReturn } | { ok: false; error: string; migration?: boolean }> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    profile_id: profileId,
    period_start: patch.periodStart,
    period_end: patch.periodEnd,
    status: patch.status,
    locked: patch.locked,
    locked_at: patch.locked ? now : null,
    updated_at: now,
  };
  if (patch.snapshot !== undefined) row.snapshot = patch.snapshot;
  if (patch.submissionReference !== undefined) row.submission_reference = patch.submissionReference;
  if (patch.submittedOn !== undefined) row.submitted_on = patch.submittedOn || null;
  if (patch.paymentReference !== undefined) row.payment_reference = patch.paymentReference;
  if (patch.paidOn !== undefined) row.paid_on = patch.paidOn || null;
  if (patch.paymentAmount !== undefined) row.payment_amount = patch.paymentAmount;
  if (patch.settlementJournalId !== undefined) row.settlement_journal_id = patch.settlementJournalId;
  if (patch.lockedMonths !== undefined) row.locked_months = patch.lockedMonths;
  if (patch.status === 'reviewed') row.reviewed_by = patch.actor || null;
  if (patch.status === 'submitted') row.submitted_by = patch.actor || null;
  if (patch.status === 'paid') row.paid_by = patch.actor || null;

  const { data, error } = await supabase
    .from('vat_returns')
    .upsert(row, { onConflict: 'profile_id,period_start,period_end' })
    .select('*')
    .single();
  if (error) {
    return {
      ok: false,
      error: missingTable(error.message) ? VAT201_MIGRATION_MESSAGE : error.message,
      migration: missingTable(error.message),
    };
  }
  return { ok: true, row: mapReturn(data as Record<string, unknown>) };
}
