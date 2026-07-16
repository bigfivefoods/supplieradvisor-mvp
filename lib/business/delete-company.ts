/**
 * Soft-delete a company (profile) — owner only.
 * Hides from membership lists and discovery; deactivates team memberships.
 * Does not hard-delete operational history (POs, inventory, etc.).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCompanyMembership } from '@/lib/business/access';
import { logActivity } from '@/lib/customers/access';

export const COMPANY_RESTORE_DAYS = 14;

export type DeleteCompanyResult =
  | {
      ok: true;
      companyId: number;
      tradingName: string;
      deletedAt: string;
      membersDeactivated: number;
      restoreUntil: string;
    }
  | { ok: false; error: string; status: number; code?: string };

export type RestoreCompanyResult =
  | {
      ok: true;
      companyId: number;
      tradingName: string;
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
  const originalName = String(profile.trading_name || '').trim();
  const restoreUntil = new Date(
    Date.now() + COMPANY_RESTORE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Encode original name + restore deadline for restore window
  const deletionMeta = JSON.stringify({
    original_trading_name: originalName,
    restore_until: restoreUntil,
    reason,
  }).slice(0, 500);

  const { error: upErr } = await supabase
    .from('profiles')
    .update({
      deleted_at: now,
      deleted_by: mem.userId,
      deletion_reason: deletionMeta,
      is_discoverable: false,
      subscription_status: 'deleted',
      updated_at: now,
      // Hide from network search while keeping audit trail of name
      trading_name: originalName
        ? `[Deleted] ${originalName}`.slice(0, 200)
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
    tradingName: originalName,
    deletedAt: now,
    membersDeactivated,
    restoreUntil,
  };
}

/**
 * Restore a soft-deleted company within COMPANY_RESTORE_DAYS.
 * Only the owner who deleted (deleted_by) can restore.
 */
export async function restoreCompany(opts: {
  companyId: number;
  privyUserId: string | null | undefined;
}): Promise<RestoreCompanyResult> {
  const companyId = Number(opts.companyId);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { ok: false, error: 'Valid companyId required', status: 400 };
  }

  const { getCanonicalUserId, userIdMatchVariants } = await import(
    '@/lib/auth/identity'
  );
  const userId = getCanonicalUserId(opts.privyUserId);
  if (!userId) {
    return { ok: false, error: 'Authentication required', status: 401 };
  }

  const supabase = getSupabaseServer();
  const { data: profile, error: loadErr } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, deleted_at, deleted_by, deletion_reason, subscription_status'
    )
    .eq('id', companyId)
    .maybeSingle();

  if (loadErr) {
    if (/deleted_at|column|schema cache/i.test(loadErr.message)) {
      return {
        ok: false,
        error: 'Migration required for company restore',
        status: 503,
        code: 'MIGRATION_REQUIRED',
      };
    }
    return { ok: false, error: loadErr.message, status: 500 };
  }
  if (!profile?.deleted_at) {
    return {
      ok: false,
      error: 'Company is not deleted',
      status: 409,
      code: 'NOT_DELETED',
    };
  }

  const variants = userIdMatchVariants(userId);
  const deletedBy = String(profile.deleted_by || '');
  if (
    deletedBy &&
    !variants.includes(deletedBy) &&
    deletedBy !== userId
  ) {
    return {
      ok: false,
      error: 'Only the owner who deleted this company can restore it',
      status: 403,
      code: 'NOT_DELETER',
    };
  }

  let originalName = String(profile.trading_name || '').replace(
    /^\[Deleted\]\s*/i,
    ''
  );
  let restoreUntil: string | null = null;
  try {
    const meta = JSON.parse(String(profile.deletion_reason || '{}')) as {
      original_trading_name?: string;
      restore_until?: string;
    };
    if (meta.original_trading_name)
      originalName = meta.original_trading_name;
    if (meta.restore_until) restoreUntil = meta.restore_until;
  } catch {
    /* plain reason string */
  }

  if (restoreUntil && new Date(restoreUntil).getTime() < Date.now()) {
    return {
      ok: false,
      error: `Restore window expired (${COMPANY_RESTORE_DAYS} days)`,
      status: 410,
      code: 'RESTORE_EXPIRED',
    };
  }

  // Fallback window from deleted_at
  if (!restoreUntil) {
    const deadline =
      new Date(profile.deleted_at).getTime() +
      COMPANY_RESTORE_DAYS * 24 * 60 * 60 * 1000;
    if (deadline < Date.now()) {
      return {
        ok: false,
        error: `Restore window expired (${COMPANY_RESTORE_DAYS} days)`,
        status: 410,
        code: 'RESTORE_EXPIRED',
      };
    }
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from('profiles')
    .update({
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
      trading_name: originalName || `Company ${companyId}`,
      subscription_status: 'none',
      is_discoverable: false,
      updated_at: now,
    })
    .eq('id', companyId);

  if (upErr) {
    return { ok: false, error: upErr.message, status: 500 };
  }

  // Re-activate owner membership for the restorer
  const { data: existingMem } = await supabase
    .from('business_users')
    .select('id, status')
    .eq('profile_id', companyId)
    .in('user_id', variants)
    .limit(1)
    .maybeSingle();

  if (existingMem?.id) {
    await supabase
      .from('business_users')
      .update({ status: 'active', role: 'owner', updated_at: now })
      .eq('id', existingMem.id);
  } else {
    await supabase.from('business_users').insert({
      profile_id: companyId,
      user_id: userId,
      role: 'owner',
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  void logActivity({
    profile_id: companyId,
    actor_user_id: userId,
    action: 'company.restored',
    entity_type: 'profile',
    entity_id: String(companyId),
    summary: `Company restored within ${COMPANY_RESTORE_DAYS}-day window`,
    metadata: { original_trading_name: originalName },
  });

  return {
    ok: true,
    companyId,
    tradingName: originalName || `Company ${companyId}`,
  };
}
