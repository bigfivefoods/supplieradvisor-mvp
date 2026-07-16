/**
 * Soft-delete a company (profile) — owner only.
 * Hides from membership lists and discovery; deactivates team memberships.
 * Does not hard-delete operational history (POs, inventory, etc.).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCompanyMembership } from '@/lib/business/access';
import { logActivity } from '@/lib/customers/access';

export type DeleteCompanyResult =
  | {
      ok: true;
      companyId: number;
      tradingName: string;
      deletedAt: string;
      membersDeactivated: number;
    }
  | { ok: false; error: string; status: number; code?: string };

/**
 * True when profile is soft-deleted. Missing column → treat as not deleted.
 */
export async function isCompanyDeleted(companyId: number): Promise<boolean> {
  if (!Number.isFinite(companyId) || companyId <= 0) return false;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('deleted_at')
    .eq('id', companyId)
    .maybeSingle();
  if (error) {
    if (/deleted_at|column|schema cache/i.test(error.message)) return false;
    return false;
  }
  return Boolean(data?.deleted_at);
}

/**
 * Soft-delete company. Requires active owner membership.
 * confirmName must match trading_name (case-insensitive, trimmed).
 * confirmPhrase must be exactly DELETE (case-insensitive).
 */
export async function softDeleteCompany(opts: {
  companyId: number;
  privyUserId: string | null | undefined;
  confirmName: string;
  confirmPhrase: string;
  reason?: string | null;
}): Promise<DeleteCompanyResult> {
  const companyId = Number(opts.companyId);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { ok: false, error: 'Valid companyId required', status: 400 };
  }

  const phrase = String(opts.confirmPhrase || '')
    .trim()
    .toUpperCase();
  if (phrase !== 'DELETE') {
    return {
      ok: false,
      error: 'Type DELETE to confirm company deletion',
      status: 400,
      code: 'CONFIRM_PHRASE',
    };
  }

  const mem = await getCompanyMembership(opts.privyUserId, companyId);
  if (!mem.ok) {
    return { ok: false, error: mem.error, status: mem.status };
  }
  if (mem.role !== 'owner') {
    return {
      ok: false,
      error: 'Only the company owner can delete this company',
      status: 403,
      code: 'OWNER_ONLY',
    };
  }

  const supabase = getSupabaseServer();
  const { data: profile, error: loadErr } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, deleted_at, is_discoverable, subscription_status'
    )
    .eq('id', companyId)
    .maybeSingle();

  if (loadErr) {
    if (/deleted_at|column|schema cache/i.test(loadErr.message)) {
      return {
        ok: false,
        error:
          'Database missing deleted_at column. Run supabase/migrations/20260716_company_soft_delete.sql',
        status: 503,
        code: 'MIGRATION_REQUIRED',
      };
    }
    return { ok: false, error: loadErr.message, status: 500 };
  }
  if (!profile) {
    return { ok: false, error: 'Company not found', status: 404 };
  }
  if (profile.deleted_at) {
    return {
      ok: false,
      error: 'Company is already deleted',
      status: 409,
      code: 'ALREADY_DELETED',
    };
  }

  const expected = String(profile.trading_name || '')
    .trim()
    .toLowerCase();
  const provided = String(opts.confirmName || '')
    .trim()
    .toLowerCase();
  if (!expected || provided !== expected) {
    return {
      ok: false,
      error: 'Company name does not match. Type the exact trading name to confirm.',
      status: 400,
      code: 'CONFIRM_NAME',
    };
  }

  const now = new Date().toISOString();
  const reason = opts.reason ? String(opts.reason).slice(0, 500) : null;

  const { error: upErr } = await supabase
    .from('profiles')
    .update({
      deleted_at: now,
      deleted_by: mem.userId,
      deletion_reason: reason,
      is_discoverable: false,
      subscription_status: 'deleted',
      updated_at: now,
      // Hide from network search while keeping audit trail of name
      trading_name: profile.trading_name
        ? `[Deleted] ${profile.trading_name}`.slice(0, 200)
        : `[Deleted] Company ${companyId}`,
    })
    .eq('id', companyId)
    .is('deleted_at', null);

  if (upErr) {
    // Retry without subscription_status if enum/check constraint
    if (/subscription_status|check|invalid/i.test(upErr.message)) {
      const retry = await supabase
        .from('profiles')
        .update({
          deleted_at: now,
          deleted_by: mem.userId,
          deletion_reason: reason,
          is_discoverable: false,
          updated_at: now,
          trading_name: profile.trading_name
            ? `[Deleted] ${profile.trading_name}`.slice(0, 200)
            : `[Deleted] Company ${companyId}`,
        })
        .eq('id', companyId)
        .is('deleted_at', null);
      if (retry.error) {
        return { ok: false, error: retry.error.message, status: 500 };
      }
    } else {
      return { ok: false, error: upErr.message, status: 500 };
    }
  }

  // Deactivate all team memberships so nobody can re-enter
  const { data: members } = await supabase
    .from('business_users')
    .select('id')
    .eq('profile_id', companyId)
    .eq('status', 'active');

  let membersDeactivated = 0;
  if (members?.length) {
    const { error: memErr, count } = await supabase
      .from('business_users')
      .update({
        status: 'removed',
        updated_at: now,
      })
      .eq('profile_id', companyId)
      .eq('status', 'active');
    if (!memErr) {
      membersDeactivated = count ?? members.length;
    } else {
      // Fallback without count
      await supabase
        .from('business_users')
        .update({ status: 'inactive' })
        .eq('profile_id', companyId)
        .eq('status', 'active');
      membersDeactivated = members.length;
    }
  }

  // Soft-cancel open team invites if table exists
  try {
    await supabase
      .from('team_invites')
      .update({ status: 'cancelled', updated_at: now })
      .eq('profile_id', companyId)
      .in('status', ['pending', 'sent', 'open']);
  } catch {
    /* optional */
  }

  void logActivity({
    profile_id: companyId,
    actor_user_id: mem.userId,
    action: 'company.soft_deleted',
    entity_type: 'profile',
    entity_id: String(companyId),
    summary: `Company soft-deleted by owner`,
    metadata: {
      original_trading_name: profile.trading_name,
      reason,
      membersDeactivated,
    },
  });

  return {
    ok: true,
    companyId,
    tradingName: String(profile.trading_name || ''),
    deletedAt: now,
    membersDeactivated,
  };
}
