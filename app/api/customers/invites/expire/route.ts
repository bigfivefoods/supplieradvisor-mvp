import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCustomersAccess,
  isCustomerInvitesEnabled,
  logActivity,
} from '@/lib/customers/access';

/** Stuck claiming lease window — matches claim route reaper (5 minutes). */
const CLAIMING_STALE_MS = 5 * 60 * 1000;

/** Rows processed per select/update pass. */
const BATCH_LIMIT = 500;

/**
 * Max full (reap + expire) passes per invocation so large backlogs drain without
 * unbounded request time. 10 × 500 = up to 5k reaps + 5k expires per call.
 * If response has moreWork=true, invoke again until reaped/expired counts are 0.
 */
const MAX_PASSES = 10;

/**
 * POST|GET /api/customers/invites/expire
 *
 * Maintenance job:
 * 1. Reap stuck `claiming` rows older than 5 minutes → `pending` (clear user_id)
 * 2. Flip `pending` invitations with `expires_at` < now → `expired`
 * 3. When no other **open** invite remains (`pending` or `claiming`) and CRM phase
 *    is `invited`, set `customers.invite_status = expired` and clear `invite_token`
 *
 * Auth (either):
 * - Membership: body/query `{ companyId, privyUserId }` — company-scoped
 * - Cron: `Authorization: Bearer $CRON_SECRET` (or header `x-cron-secret`) —
 *   also accepts env `CUSTOMER_INVITE_EXPIRE_SECRET`. Global, or optional companyId.
 *   Vercel Cron sends Bearer $CRON_SECRET when that env is set (GET path).
 *
 * Drain: each invocation processes up to MAX_PASSES × BATCH_LIMIT rows.
 * If `moreWork` is true, schedule/run again until counts are zero.
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
  return runExpire(request);
}

/** GET for Vercel Cron (hits path with GET + Authorization: Bearer $CRON_SECRET). */
export async function GET(request: NextRequest) {
  return runExpire(request);
}

async function runExpire(request: NextRequest) {
  try {
    if (!isCustomerInvitesEnabled()) {
      return NextResponse.json(
        { error: 'Customer invites are disabled', code: 'CUSTOMER_INVITES_DISABLED' },
        { status: 503 }
      );
    }

    let body: Record<string, unknown> = {};
    if (request.method === 'POST') {
      try {
        const raw = await request.text();
        if (raw?.trim()) body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    } else {
      // GET: optional query params for scoped member/cron runs
      const sp = request.nextUrl.searchParams;
      if (sp.get('companyId')) body.companyId = sp.get('companyId');
      if (sp.get('privyUserId')) body.privyUserId = sp.get('privyUserId');
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
      const member = await assertCustomersAccess(
        body.privyUserId as string | undefined,
        cid,
        'write'
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

    const reapedIds: number[] = [];
    const expiredIds: number[] = [];
    const affectedCustomers = new Map<
      number,
      { profile_id: number; email: string | null }
    >();

    let passes = 0;
    let moreWork = false;

    // Drain in passes: reap stuck claiming, then expire pending (reaped past-due
    // rows expire in the same pass after being restored to pending).
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      passes = pass + 1;
      let reapedThisPass = 0;
      let expiredThisPass = 0;

      // ── 1. Reap stuck claiming → pending ────────────────────────────────
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
        if (updated) {
          reapedIds.push(Number(updated.id));
          reapedThisPass += 1;
        }
      }

      // ── 2. Expire pending past expires_at ───────────────────────────────
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
          expiredThisPass += 1;
          const cid = Number(updated.customer_id);
          if (Number.isFinite(cid)) {
            affectedCustomers.set(cid, {
              profile_id: Number(updated.profile_id),
              email: updated.email ?? null,
            });
          }
        }
      }

      // Full batch of either type → likely more work remains
      const hitReapCap = (stuckClaiming || []).length >= BATCH_LIMIT;
      const hitExpireCap = (toExpire || []).length >= BATCH_LIMIT;
      if (reapedThisPass === 0 && expiredThisPass === 0 && !hitReapCap && !hitExpireCap) {
        moreWork = false;
        break;
      }
      if (hitReapCap || hitExpireCap) {
        moreWork = true;
      } else {
        moreWork = false;
        // Finished this backlog in fewer than a full batch
        break;
      }
    }

    // If we exited after max passes with full batches, flag more work
    if (passes >= MAX_PASSES) {
      // Re-check lightly: if last pass hit caps we already set moreWork
    }

    // ── 3. Sync customers.invite_status when no open invite remains ───────
    // Open = pending OR claiming (in-flight claim must not flip CRM to expired).
    let customersExpired = 0;
    for (const [customerId, meta] of affectedCustomers) {
      const { count: remainingOpen, error: countErr } = await supabase
        .from('customer_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .in('status', ['pending', 'claiming']);

      if (countErr) {
        console.error('expire open-invite count error:', countErr, customerId);
        continue;
      }
      if ((remainingOpen ?? 0) > 0) continue;

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

      // Conditional update + verify a row was written (claim race → skip activity)
      const { data: crmUpdated, error: custErr } = await supabase
        .from('customers')
        .update({
          invite_status: 'expired',
          invite_token: null,
          updated_at: now,
        })
        .eq('id', customerId)
        .eq('profile_id', meta.profile_id)
        .eq('invite_status', 'invited')
        .select('id')
        .maybeSingle();

      if (custErr) {
        console.error('expire customer invite_status error:', custErr, customerId);
        continue;
      }
      if (!crmUpdated) {
        // Race: claim or other writer moved invite_status off invited
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
      maxPasses: MAX_PASSES,
      passes,
      /** true if another invocation may still have work (hit batch caps). */
      moreWork,
    });
  } catch (e: unknown) {
    console.error('POST /api/customers/invites/expire error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Expire job failed' },
      { status: 500 }
    );
  }
}
