import type { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { decryptField } from '@/lib/credit/crypto';
import { maskAccountNumber, maskIdNumber } from '@/lib/credit/mask';
import type { CreditApplicationDocument, CreditApplicationRow, CreditStatus } from '@/lib/credit/types';

export const OPEN_APPLICATION_STATUSES: CreditStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'more_info_needed',
];

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

export function firstIp(request: NextRequest): string | null {
  const raw = request.headers.get('x-forwarded-for') || '';
  const ip = raw.split(',')[0]?.trim();
  return ip || null;
}

export function mapCreditApplication(row: Record<string, unknown>): CreditApplicationRow {
  return {
    id: Number(row.id),
    profile_id: Number(row.profile_id),
    customer_id: Number(row.customer_id),
    viewer_id: row.viewer_id != null ? Number(row.viewer_id) : null,
    applicant_profile_id: row.applicant_profile_id != null ? Number(row.applicant_profile_id) : null,
    reference: row.reference != null ? String(row.reference) : null,
    country_code: String(row.country_code || 'ZA'),
    form_version: Number(row.form_version || 1),
    status: String(row.status || 'draft') as CreditStatus,
    business: asObject(row.business),
    addresses: asObject(row.addresses),
    contacts: asObject(row.contacts),
    trade_references: Array.isArray(row.trade_references)
      ? (row.trade_references as Array<Record<string, unknown>>)
      : [],
    bank: asObject(row.bank),
    requested_limit: row.requested_limit != null ? Number(row.requested_limit) : null,
    requested_terms: row.requested_terms != null ? String(row.requested_terms) : null,
    currency: row.currency != null ? String(row.currency) : null,
    approved_limit: row.approved_limit != null ? Number(row.approved_limit) : null,
    approved_terms: row.approved_terms != null ? String(row.approved_terms) : null,
    review_date: row.review_date != null ? String(row.review_date).slice(0, 10) : null,
    decision_reason: row.decision_reason != null ? String(row.decision_reason) : null,
    info_request: row.info_request != null ? String(row.info_request) : null,
    info_response: row.info_response != null ? String(row.info_response) : null,
    popia_consent_at: row.popia_consent_at != null ? String(row.popia_consent_at) : null,
    credit_check_consent_at: row.credit_check_consent_at != null ? String(row.credit_check_consent_at) : null,
    terms_accepted_at: row.terms_accepted_at != null ? String(row.terms_accepted_at) : null,
    terms_version: row.terms_version != null ? String(row.terms_version) : null,
    terms_sha256: row.terms_sha256 != null ? String(row.terms_sha256) : null,
    signature: row.signature && typeof row.signature === 'object' && !Array.isArray(row.signature)
      ? (row.signature as Record<string, unknown>)
      : null,
    submitted_at: row.submitted_at != null ? String(row.submitted_at) : null,
    decided_at: row.decided_at != null ? String(row.decided_at) : null,
    decided_by: row.decided_by != null ? String(row.decided_by) : null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

export function maskCreditApplication<T extends CreditApplicationRow>(app: T): T {
  const bank = asObject(app.bank);
  const maskedBank = {
    ...bank,
    account_number: '',
    account_number_enc: bank.account_number_enc ? '***' : null,
    account_number_last4: String(bank.account_number_last4 || '').slice(-4),
    account_number_masked: maskAccountNumber(bank.account_number_last4 || ''),
  };
  return {
    ...app,
    bank: maskedBank,
  };
}

export function maskPrincipalRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    id_number_enc: row.id_number_enc ? '***' : null,
    id_number_masked: maskIdNumber(row.id_number_last4 || ''),
  };
}

export function revealCreditApplicationSensitive(opts: {
  application: CreditApplicationRow;
  principals: Array<Record<string, unknown>>;
}): {
  bankAccountNumber: string | null;
  principalIdNumbers: Array<{ id: number; idNumber: string | null }>;
} {
  const bank = asObject(opts.application.bank);
  let bankAccountNumber: string | null = null;
  const enc = String(bank.account_number_enc || '').trim();
  if (enc) {
    bankAccountNumber = decryptField(enc);
  }
  const principalIdNumbers = opts.principals.map((p) => {
    const encId = String(p.id_number_enc || '').trim();
    return {
      id: Number(p.id),
      idNumber: encId ? decryptField(encId) : null,
    };
  });
  return { bankAccountNumber, principalIdNumbers };
}

export async function nextCreditReference(profileId: number): Promise<string> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('credit_applications')
    .select('id')
    .eq('profile_id', profileId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = Number(data?.id || 0) + 1;
  return `CA-${String(next).padStart(6, '0')}`;
}

export async function loadCreditDocuments(opts: { profileId: number; applicationId: number }) {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('credit_application_documents')
    .select('*')
    .eq('profile_id', opts.profileId)
    .eq('application_id', opts.applicationId)
    .order('created_at', { ascending: true });
  return (data || []) as Array<Record<string, unknown>>;
}

export async function loadCreditTimeline(opts: { profileId: number; applicationId: number }) {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('credit_application_events')
    .select('*')
    .eq('profile_id', opts.profileId)
    .eq('application_id', opts.applicationId)
    .order('created_at', { ascending: true });
  return (data || []) as Array<Record<string, unknown>>;
}

export async function insertCreditEvent(input: {
  application_id: number;
  profile_id: number;
  actor_type: 'customer' | 'supplier_user' | 'system';
  actor_id: string | null;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  note?: string | null;
  ip?: string | null;
}) {
  const supabase = getSupabaseServer();
  await supabase.from('credit_application_events').insert({
    application_id: input.application_id,
    profile_id: input.profile_id,
    actor_type: input.actor_type,
    actor_id: input.actor_id,
    action: input.action,
    from_status: input.from_status || null,
    to_status: input.to_status || null,
    note: input.note || null,
    ip: input.ip || null,
  });
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function documentMeta(row: Record<string, unknown>): CreditApplicationDocument {
  return {
    id: Number(row.id),
    principal_id: row.principal_id != null ? Number(row.principal_id) : null,
    doc_type: String(row.doc_type || 'other') as CreditApplicationDocument['doc_type'],
    file_name: row.file_name != null ? String(row.file_name) : null,
    mime_type: row.mime_type != null ? String(row.mime_type) : null,
    size_bytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    sha256: row.sha256 != null ? String(row.sha256) : null,
    created_at: row.created_at != null ? String(row.created_at) : null,
  };
}
