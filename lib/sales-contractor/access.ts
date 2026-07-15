import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import {
  getCompanyMembership,
  type MembershipFail,
  type MembershipOk,
} from '@/lib/business/access';
import { normalizeTeamRole } from '@/lib/business/permissions';
import {
  ensureAscendingCommissionTiers,
  parseStoredTiers,
  tiersSummaryText,
} from './commission';
import {
  SALES_CONTRACTOR_CONTRACT_VERSION,
} from './agreement';
import { computeSubscriptionInfo } from './subscription';
import type { SalesContractorAgreement } from './types';
import {
  programSnapshotForAgreement,
  resolveProgramSettings,
  tiersSchedulesDiffer,
} from '@/lib/sales-program';

export type SalesRepContext = MembershipOk & {
  isSalesContractor: boolean;
  /** Owner / finance / admin — no paid subscription or agreement required */
  subscriptionExempt: boolean;
  companyName: string;
};

/**
 * Membership for company + role flags. Sales portal is for sales_contractor
 * (and owners/admins may view as manager).
 */
export async function assertSalesPortalAccess(
  privyUserId: string | null | undefined,
  companyId: number
): Promise<SalesRepContext | MembershipFail> {
  const mem = await getCompanyMembership(privyUserId, companyId);
  if (!mem.ok) return mem;

  const role = normalizeTeamRole(mem.role);
  // Owner / finance / admin get free full portal access (no paid sub).
  // Sales + sales_contractor use the contractor portal features.
  const allowed =
    role === 'sales_contractor' ||
    role === 'owner' ||
    role === 'admin' ||
    role === 'finance' ||
    role === 'sales';

  if (!allowed) {
    return {
      ok: false,
      error: 'Sales contractor portal is only available to the customer sales team.',
      status: 403,
    };
  }

  const supabase = getSupabaseServer();
  const { data: company } = await supabase
    .from('profiles')
    .select('trading_name, legal_name')
    .eq('id', companyId)
    .maybeSingle();

  return {
    ...mem,
    isSalesContractor: role === 'sales_contractor',
    /** Owner, finance, admin — full free access (no agreement/sub gate). */
    subscriptionExempt:
      role === 'owner' || role === 'finance' || role === 'admin',
    companyName:
      company?.trading_name || company?.legal_name || 'Your company',
  };
}

export function mapAgreementRow(row: Record<string, unknown>): SalesContractorAgreement {
  const tiers = ensureAscendingCommissionTiers(parseStoredTiers(row.commission_tiers));
  const sub = computeSubscriptionInfo({
    subscription_status: row.subscription_status as string | null,
    subscription_starts_at: row.subscription_starts_at as string | null,
    subscription_ends_at: row.subscription_ends_at as string | null,
    subscription_paystack_ref: row.subscription_paystack_ref as string | null,
  });
  return {
    id: Number(row.id),
    profile_id: Number(row.profile_id),
    business_user_id: row.business_user_id != null ? Number(row.business_user_id) : null,
    user_id: row.user_id ? String(row.user_id) : null,
    contractor_email: row.contractor_email ? String(row.contractor_email) : null,
    contractor_name: row.contractor_name ? String(row.contractor_name) : null,
    status: (String(row.status || 'pending') as SalesContractorAgreement['status']),
    contract_version: String(row.contract_version || SALES_CONTRACTOR_CONTRACT_VERSION),
    commission_tiers: tiers,
    max_commission_pct: Number(row.max_commission_pct ?? 6),
    min_commission_pct: Number(row.min_commission_pct ?? 4),
    currency: String(row.currency || 'ZAR'),
    signed_at: row.signed_at ? String(row.signed_at) : null,
    signature_name: row.signature_name ? String(row.signature_name) : null,
    signature_email: row.signature_email ? String(row.signature_email) : null,
    terms_summary: row.terms_summary ? String(row.terms_summary) : null,
    subscription: sub,
    subscription_status: sub.status,
    subscription_starts_at: sub.startsAt,
    subscription_ends_at: sub.endsAt,
    subscription_paystack_ref: sub.paystackReference,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

/**
 * Get or create pending agreement for a sales contractor membership.
 */
export async function getOrCreateAgreement(opts: {
  companyId: number;
  memberId: number;
  userId: string;
  name?: string | null;
  email?: string | null;
}): Promise<
  | { ok: true; agreement: SalesContractorAgreement }
  | { ok: false; error: string; status: number }
> {
  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(opts.userId);

  // Prefer by membership id, then by user_id variants
  const { data: byMember, error: err1 } = await supabase
    .from('sales_contractor_agreements')
    .select('*')
    .eq('profile_id', opts.companyId)
    .eq('business_user_id', opts.memberId)
    .order('id', { ascending: false })
    .limit(5);

  if (err1) {
    if (/relation|does not exist|schema cache/i.test(err1.message)) {
      return {
        ok: false,
        error:
          'Sales contractor tables missing. Run supabase/migrations/20260710_sales_contractor_portal.sql',
        status: 503,
      };
    }
    console.error('getOrCreateAgreement load:', err1);
    return { ok: false, error: err1.message, status: 500 };
  }

  let rows = byMember || [];
  if (rows.length === 0) {
    const { data: byUser, error: err2 } = await supabase
      .from('sales_contractor_agreements')
      .select('*')
      .eq('profile_id', opts.companyId)
      .in('user_id', variants)
      .order('id', { ascending: false })
      .limit(5);
    if (err2) {
      console.error('getOrCreateAgreement by user:', err2);
    } else {
      rows = byUser || [];
    }
  }

  const signed = rows.find((r) => r.status === 'signed');
  if (signed) {
    return { ok: true, agreement: mapAgreementRow(signed as Record<string, unknown>) };
  }

  const program = await resolveProgramSettings(opts.companyId);

  // Pending row: keep in sync with live company sales program (4–6% etc.)
  if (rows[0]) {
    const pending = mapAgreementRow(rows[0] as Record<string, unknown>);
    const programTiers = program.commission_tiers;
    const needsSync =
      tiersSchedulesDiffer(pending.commission_tiers, programTiers) ||
      pending.contract_version !== program.contract_version;

    if (needsSync && pending.status !== 'signed') {
      const now = new Date().toISOString();
      const snapshot = programSnapshotForAgreement(program);
      const { data: updated, error: upErr } = await supabase
        .from('sales_contractor_agreements')
        .update({
          commission_tiers: programTiers,
          max_commission_pct: program.max_commission_pct,
          min_commission_pct: program.min_commission_pct,
          currency: program.currency || 'ZAR',
          contract_version:
            program.contract_version || SALES_CONTRACTOR_CONTRACT_VERSION,
          terms_summary: tiersSummaryText(programTiers),
          metadata: {
            ...((rows[0] as { metadata?: Record<string, unknown> }).metadata ||
              {}),
            program_snapshot: snapshot,
            synced_from_program_at: now,
          },
          updated_at: now,
        })
        .eq('id', pending.id)
        .eq('status', 'pending')
        .select('*')
        .single();

      if (!upErr && updated) {
        return {
          ok: true,
          agreement: mapAgreementRow(updated as Record<string, unknown>),
        };
      }
      // If update fails, still return live program tiers overlaid for the client
      return {
        ok: true,
        agreement: {
          ...pending,
          commission_tiers: programTiers,
          contract_version: program.contract_version || pending.contract_version,
          max_commission_pct: program.max_commission_pct,
          min_commission_pct: program.min_commission_pct,
          terms_summary: tiersSummaryText(programTiers),
        },
      };
    }

    return { ok: true, agreement: pending };
  }

  const now = new Date().toISOString();
  const tiers = program.commission_tiers;
  const snapshot = programSnapshotForAgreement(program);
  const insert = {
    profile_id: opts.companyId,
    business_user_id: opts.memberId,
    user_id: opts.userId,
    contractor_email: opts.email || null,
    contractor_name: opts.name || null,
    status: 'pending',
    contract_version: program.contract_version || SALES_CONTRACTOR_CONTRACT_VERSION,
    commission_tiers: tiers,
    max_commission_pct: program.max_commission_pct,
    min_commission_pct: program.min_commission_pct,
    currency: program.currency || 'ZAR',
    terms_summary: tiersSummaryText(tiers),
    metadata: { program_snapshot: snapshot },
    created_at: now,
    updated_at: now,
  };

  const { data: created, error: insErr } = await supabase
    .from('sales_contractor_agreements')
    .insert(insert)
    .select('*')
    .single();

  if (insErr) {
    console.error('getOrCreateAgreement insert:', insErr);
    return { ok: false, error: insErr.message, status: 500 };
  }

  return { ok: true, agreement: mapAgreementRow(created as Record<string, unknown>) };
}

export function isAgreementSigned(a: SalesContractorAgreement | null | undefined): boolean {
  return Boolean(a && a.status === 'signed' && a.signed_at);
}

/** Filter CRM rows to this rep when sales_rep_user_id is set; include unassigned for contractor view of "mine + unassigned" optional */
export function matchesSalesRep(
  row: { sales_rep_user_id?: string | null; created_by?: string | null; owner_name?: string | null },
  userId: string,
  variants: string[]
): boolean {
  const rep = String(row.sales_rep_user_id || row.created_by || '').trim();
  if (!rep) return false;
  return variants.includes(rep) || rep === userId;
}
