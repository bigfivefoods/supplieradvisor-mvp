/**
 * Cross-brand personal directory.
 *
 * A person is found by email/phone, not by the company they operate.
 * GymAdvisor at one company and DentalAdvisor at another are separate
 * rows. The operator workspace (business_users / selectedCompanyId)
 * is never written here.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { digitsPhone } from '@/lib/b2c/member-app';
import type { B2cCapability, B2cMembership, B2cMembershipKind } from '@/lib/b2c/types';

export type DirectoryPerson = {
  kind: B2cMembershipKind;
  company_id: number;
  company_name: string;
  brand?: string | null;
  portal_token?: string | null;
  portal_path: string;
  checkin_path?: string | null;
  ref_id: string;
  ref_label?: string | null;
  email?: string | null;
  phone?: string | null;
  capabilities: B2cCapability[];
};

function tableMissing(error: { message?: string; code?: string } | null) {
  return (
    Boolean(error?.message?.includes('platform_b2c_directory')) ||
    error?.code === '42P01'
  );
}

export function normalizeEmailKey(email?: string | null): string | null {
  const v = String(email || '')
    .trim()
    .toLowerCase();
  return v.includes('@') ? v : null;
}

export function normalizePhoneKey(phone?: string | null): string | null {
  const digits = digitsPhone(phone);
  if (digits.length < 7) return null;
  return digits.slice(-9);
}

export function defaultCapabilitiesForKind(
  kind: B2cMembershipKind
): B2cCapability[] {
  if (kind === 'hire') return ['order', 'book', 'track', 'kyc', 'review'];
  if (kind === 'gym') return ['book', 'checkin', 'messages', 'review', 'track'];
  return ['book', 'track', 'messages', 'review', 'kyc'];
}

export function membershipFromDirectory(
  row: DirectoryPerson
): Omit<B2cMembership, 'id' | 'linked_at'> {
  return {
    kind: row.kind,
    company_id: row.company_id,
    company_name: row.company_name,
    brand: row.brand,
    portal_token: row.portal_token,
    portal_path: row.portal_path,
    checkin_path: row.checkin_path,
    ref_id: row.ref_id,
    ref_label: row.ref_label,
    email: row.email,
    capabilities: row.capabilities?.length
      ? row.capabilities
      : defaultCapabilitiesForKind(row.kind),
    active: true,
  };
}

async function upsertContactRow(
  contactKey: string,
  contactType: 'email' | 'phone',
  person: DirectoryPerson
) {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const { error } = await supabase.from('platform_b2c_directory').upsert(
    {
      contact_key: contactKey,
      contact_type: contactType,
      kind: person.kind,
      company_id: person.company_id,
      ref_id: person.ref_id,
      portal_token: person.portal_token || null,
      portal_path: person.portal_path,
      checkin_path: person.checkin_path || null,
      brand: person.brand || null,
      company_name: person.company_name,
      ref_label: person.ref_label || null,
      capabilities: person.capabilities || [],
      updated_at: now,
    },
    { onConflict: 'contact_key,kind,company_id,ref_id' }
  );
  if (error && !tableMissing(error)) {
    console.warn('platform_b2c_directory upsert:', error.message);
  }
}

/** Index a brand person so SA Member can find them by email or phone. */
export async function indexBrandPerson(input: {
  kind: B2cMembershipKind;
  companyId: number;
  companyName?: string | null;
  brand?: string | null;
  refId: string;
  refLabel?: string | null;
  email?: string | null;
  phone?: string | null;
  portalToken?: string | null;
  portalPath: string;
  checkinPath?: string | null;
  capabilities?: B2cCapability[];
}): Promise<void> {
  try {
    const email = normalizeEmailKey(input.email);
    const phone = normalizePhoneKey(input.phone);
    if (!email && !phone) return;
    if (!input.portalPath || !input.refId) return;

    const person: DirectoryPerson = {
      kind: input.kind,
      company_id: input.companyId,
      company_name: input.companyName || input.brand || `Company #${input.companyId}`,
      brand: input.brand || input.companyName || null,
      portal_token: input.portalToken || null,
      portal_path: input.portalPath,
      checkin_path: input.checkinPath || null,
      ref_id: String(input.refId),
      ref_label: input.refLabel || null,
      email,
      phone,
      capabilities:
        input.capabilities && input.capabilities.length
          ? input.capabilities
          : defaultCapabilitiesForKind(input.kind),
    };

    if (email) await upsertContactRow(email, 'email', person);
    if (phone) await upsertContactRow(phone, 'phone', person);
  } catch {
    /* directory is best-effort — missing table must not break invite/issue */
  }
}

export async function indexMembershipInDirectory(
  membership: Omit<B2cMembership, 'id' | 'linked_at'> & {
    id?: string;
    linked_at?: string;
  },
  contact?: { email?: string | null; phone?: string | null }
): Promise<void> {
  await indexBrandPerson({
    kind: membership.kind,
    companyId: membership.company_id,
    companyName: membership.company_name,
    brand: membership.brand,
    refId: membership.ref_id,
    refLabel: membership.ref_label,
    email: contact?.email || membership.email,
    phone: contact?.phone,
    portalToken: membership.portal_token,
    portalPath: membership.portal_path,
    checkinPath: membership.checkin_path,
    capabilities: membership.capabilities,
  });
}

function rowToPerson(row: Record<string, unknown>): DirectoryPerson {
  const capabilities = Array.isArray(row.capabilities)
    ? (row.capabilities as B2cCapability[])
    : [];
  return {
    kind: String(row.kind) as B2cMembershipKind,
    company_id: Number(row.company_id),
    company_name: String(row.company_name || `Company #${row.company_id}`),
    brand: row.brand ? String(row.brand) : null,
    portal_token: row.portal_token ? String(row.portal_token) : null,
    portal_path: String(row.portal_path || ''),
    checkin_path: row.checkin_path ? String(row.checkin_path) : null,
    ref_id: String(row.ref_id),
    ref_label: row.ref_label ? String(row.ref_label) : null,
    email: row.contact_type === 'email' ? String(row.contact_key) : null,
    phone: row.contact_type === 'phone' ? String(row.contact_key) : null,
    capabilities,
  };
}

/** Look up every independent brand membership for this person. */
export async function findDirectoryEntries(
  email?: string | null,
  phone?: string | null
): Promise<DirectoryPerson[]> {
  try {
    const emailKey = normalizeEmailKey(email);
    const phoneKey = normalizePhoneKey(phone);
    if (!emailKey && !phoneKey) return [];

    const supabase = getSupabaseServer();
    const keys = [emailKey, phoneKey].filter(Boolean) as string[];
    const { data, error } = await supabase
      .from('platform_b2c_directory')
      .select('*')
      .in('contact_key', keys)
      .limit(80);

    if (error) {
      if (!tableMissing(error)) {
        console.warn('platform_b2c_directory lookup:', error.message);
      }
      return [];
    }

    const seen = new Set<string>();
    const out: DirectoryPerson[] = [];
    for (const raw of data || []) {
      const row = rowToPerson(raw as Record<string, unknown>);
      if (!row.company_id || !row.portal_path) continue;
      const key = `${row.kind}:${row.company_id}:${row.ref_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out;
  } catch {
    return [];
  }
}
