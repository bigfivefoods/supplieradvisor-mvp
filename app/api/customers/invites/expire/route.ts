import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCompanyMember,
  isCustomerInvitesEnabled,
  logActivity,
} from '@/lib/customers/access';

/** Stuck claiming lease window — matches claim route reaper (5 minutes). */
const CLAIMING_STALE_MS = 5 * 60 * 1000;

/** Batch size for maintenance updates. */
const BATCH_LIMIT = 500;

/**
 * POST /api/customers/invites/expire
 *
 * Maintenance job:
 * 1. Reap stuck `claiming` rows older than 5 minutes → `pending` (clear user_id)
 * 2. Flip `pending` invitations with `expires_at` < now → `expired`
 * 3. When no other pending invite remains for a customer and CRM phase is `invited`,
 *    set `customers.invite_status = expired` and clear `invite_token`
 *
 * Auth (either):
 * - Membership: body `{ companyId, privyUserId }` — company-scoped
 * - Cron: `Authorization: Bearer $CRON_SECRET` (or header `x-cron-secret`) —
 *   also accepts env `CUSTOMER_INVITE_EXPIRE_SECRET`. Global, or optional body `companyId`.
 *
 * Cron example:
 * ```
 * curl -X POST https://app.example/api/customers/invites/expire \
 *   -H "Authorization: Bearer $CRON_SECRET" \
 *   -H "Content-Type: application/json" \
 *   -d '{}'
 * ```
 *
 * Member example:
 * ```
 * curl -X POST https://app.example/api/customers/invites/expire \
 *   -H "Content-Type: application/json" \
 *   -d '{"companyId":123,"privyUserId":"did:privy:..."}'
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    if (!isCustomerInvitesEnabled()) {
      return NextResponse.json(
        { error: 'Customer invites are disabled', code: 'CUSTOMER_INVITES_DISABLED' },
        { status: 503 }
      );
    }

    let body: Record<string, unknown> = {};
    try {
      const raw = await request.text();
      if (raw?.trim()) body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const cronSecret =
      process.env.CRON_SECRET || process.env.CUSTOMER_INVITE_EXPIRE_SECRET || '';
    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const headerSecret = (request.headers.get('x-cron-secret') || '').trim();
    const isCron =
      Boolean(cronSecret) &&
      (bearer === cronSecret || headerSecret === cronSecret);

    let companyId: number | null = null;
    let actorUserId: string | null = null;
    let mode: 'cron' | 'member';

    if (isCron) {
      mode = 'cron';
      const scoped = body.companyId != null ? Number(body.companyId) : null;
      if (scoped != null && Number.isFinite(scoped) && scoped > 0) {
        companyId = scoped;
      }
    } else {
      const cid = Number(body.companyId);
      if (!Number.isFinite(cid) || cid <= 0) {
        return NextResponse.json(
          {
            error:
              'Authentication required: pass companyId + privyUserId, or set CRON_SECRET and send Authorization: Bearer <secret>',
            code: 'AUTH_REQUIRED',
          },
          { status: 401 }
        );
      }
      const member = await assertCompanyMember(
        body.privyUserId as string | undefined,
        cid
      );
      if (!member.ok) {
        return NextResponse.json({ error: member.error }, { status: member.status });
      }
      mode = 'member';
      companyId = cid;
      actorUserId = member.userId;
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const claimingCutoff = new Date(Date.now() - CLAIMING_STALE_MS).toISOString();

    // ── 1. Reap stuck claiming → pending ──────────────────────────────────
    let reapQuery = supabase
      .from('customer_invitations')
      .select('id, customer_id, profile_id, email, status, updated_at')
      .eq('status', 'claiming')
      .lt('updated_at', claimingCutoff)
      .order('updated_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (companyId != null) {
      reapQuery = reapQuery.eq('profile_id', companyId);
    }

    const { data: stuckClaiming, error: reapSelectErr } = await reapQuery;
    if (reapSelectErr) {
      console.error('expire reap select error:', reapSelectErr);
      return NextResponse.json({ error: reapSelectErr.message }, { status: 500 });
    }

    const reapedIds: number[] = [];
    for (const row of stuckClaiming || []) {
      const { data: updated, error: updErr } = await supabase
        .from('customer_invitations')
        .update({
          status: 'pending',
          user_id: null,
          updated_at: now,
        })
        .eq('id', row.id)
        .eq('status', 'claiming')
        .select('id')
        .maybeSingle();
      if (updErr) {
        console.error('expire reap update error:', updErr, row.id);
        continue;
      }
      if (updated) reapedIds.push(Number(updated.id));
    }

    // ── 2. Expire pending past expires_at ─────────────────────────────────
    let expireQuery = supabase
      .from('customer_invitations')
      .select('id, customer_id, profile_id, email, status, expires_at')
      .eq('status', 'pending')
      .lt('expires_at', now)
      .order('expires_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (companyId != null) {
      expireQuery = expireQuery.eq('profile_id', companyId);
    }

    const { data: toExpire, error: expireSelectErr } = await expireQuery;
    if (expireSelectErr) {
      console.error('expire select error:', expireSelectErr);
      return NextResponse.json({ error: expireSelectErr.message }, { status: 500 });
    }

    const expiredIds: number[] = [];
    const affectedCustomers = new Map<
      number,
      { profile_id: number; email: string | null }
    >();

    for (const row of toExpire || []) {
      const { data: updated, error: updErr } = await supabase
        .from('customer_invitations')
        .update({ status: 'expired', updated_at: now })
        .eq('id', row.id)
        .eq('status', 'pending')
        .select('id, customer_id, profile_id, email')
        .maybeSingle();
      if (updErr) {
        console.error('expire update error:', updErr, row.id);
        continue;
      }
      if (updated) {
        expiredIds.push(Number(updated.id));
        const cid = Number(updated.customer_id);
        if (Number.isFinite(cid)) {
          affectedCustomers.set(cid, {
            profile_id: Number(updated.profile_id),
            email: updated.email ?? null,
          });
        }
      }
    }

    // ── 3. Sync customers.invite_status when last pending invite expired ──
    let customersExpired = 0;
    for (const [customerId, meta] of affectedCustomers) {
      const { count: remainingPending, error: countErr } = await supabase
        .from('customer_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('status', 'pending');

      if (countErr) {
        console.error('expire pending count error:', countErr, customerId);
        continue;
      }
      if ((remainingPending ?? 0) > 0) continue;

      const { data: customer } = await supabase
        .from('customers')
        .select('id, invite_status, invite_token, linked_profile_id, profile_id')
        .eq('id', customerId)
        .eq('profile_id', meta.profile_id)
        .maybeSingle();

      if (
        !customer ||
        customer.linked_profile_id ||
        customer.invite_status !== 'invited'
      ) {
        continue;
      }

      const { error: custErr } = await supabase
        .from('customers')
        .update({
          invite_status: 'expired',
          invite_token: null,
          updated_at: now,
        })
        .eq('id', customerId)
        .eq('profile_id', meta.profile_id)
        .eq('invite_status', 'invited');

      if (custErr) {
        console.error('expire customer invite_status error:', custErr, customerId);
        continue;
      }
      customersExpired += 1;

      await logActivity({
        profile_id: meta.profile_id,
        actor_user_id: actorUserId,
        action: 'customer.invite.expired',
        entity_type: 'customer',
        entity_id: String(customerId),
        summary: `Platform invitation expired for customer #${customerId}`,
        metadata: { email: meta.email, mode },
      });
    }

    return NextResponse.json({
      success: true,
      mode,
      companyId,
      reapedClaiming: reapedIds.length,
      reapedIds,
      expiredInvitations: expiredIds.length,
      expiredIds,
      customersMarkedExpired: customersExpired,
      claimingStaleMinutes: CLAIMING_STALE_MS / 60_000,
      batchLimit: BATCH_LIMIT,
    });
  } catch (e: unknown) {
    console.error('POST /api/customers/invites/expire error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Expire job failed' },
      { status: 500 }
    );
  }
}
