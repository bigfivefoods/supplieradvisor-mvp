import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireReferralOps,
} from '@/lib/billing/referral-controls';
import { legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  FOUNDING_FREE_COMPANY_LIMIT,
  getFoundingSlotPulse,
  grantFoundingLifetimeAccess,
} from '@/lib/billing/lifetime';

/**
 * Platform ops: list / update founding waitlist.
 * Auth: same as referral ops (root owner/admin or REFERRAL_OPS_SECRET).
 *
 * GET  ?status=&limit=
 * POST { action: 'set_status', id, status }
 * POST { action: 'bulk_invite', status?: 'waiting', limit?, setStatus?: true }
 * POST { action: 'bulk_slots_open', status?: 'waiting', limit? }
 */
export async function GET(request: NextRequest) {
  try {
    const ops = await requireReferralOps(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!ops.ok) return ops.response;

    const status = request.nextUrl.searchParams.get('status');
    const limit = Math.min(
      200,
      Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 100))
    );

    const supabase = getSupabaseServer();

    const pulse = await getFoundingSlotPulse();

    let q = supabase
      .from('founding_waitlist')
      .select(
        'id, email, company_name, user_id, notes, status, created_at, converted_profile_id'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      q = q.eq('status', status);
    }

    const { data, error } = await q;
    if (error) {
      // Retry without optional column
      if (/converted_profile_id|column/i.test(error.message)) {
        const retry = await supabase
          .from('founding_waitlist')
          .select('id, email, company_name, user_id, notes, status, created_at')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (retry.error && /relation|does not exist/i.test(retry.error.message)) {
          return NextResponse.json({
            success: true,
            entries: [],
            slots: pulse,
            warning: 'Run 20260716_platform_improvements.sql',
          });
        }
        if (retry.error) {
          return NextResponse.json(
            { error: retry.error.message },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          entries: retry.data || [],
          slots: pulse,
        });
      }
      if (/relation|does not exist/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          entries: [],
          slots: pulse,
          warning: 'Run 20260716_platform_improvements.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      entries: data || [],
      slots: pulse,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

const ALLOWED_STATUS = new Set([
  'waiting',
  'slots_available',
  'contacted',
  'invited',
  'converted',
  'declined',
]);

export async function POST(request: NextRequest) {
  try {
    const ops = await requireReferralOps(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!ops.ok) return ops.response;

    const body = await request.json();
    const action = String(body.action || '').toLowerCase();

    /**
     * Convert waitlist entry + grant lifetime on a registered company.
     * Body: { action: 'convert_grant', id, companyId, skipEmail? }
     */
    if (action === 'convert_grant') {
      const id = Number(body.id);
      const companyId = Number(body.companyId || body.profileId);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      if (!Number.isFinite(companyId) || companyId <= 0) {
        return NextResponse.json(
          { error: 'companyId required (registered company profile id)' },
          { status: 400 }
        );
      }

      const supabase = getSupabaseServer();
      const { data: existing } = await supabase
        .from('founding_waitlist')
        .select('id, email, company_name, status')
        .eq('id', id)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 });
      }

      const grant = await grantFoundingLifetimeAccess(companyId, {
        reason: 'ops_convert_grant',
      });
      if (!grant.ok) {
        return NextResponse.json(
          { error: grant.error || 'Grant failed' },
          { status: 500 }
        );
      }

      const updates: Record<string, unknown> = {
        status: 'converted',
        notes: [
          existing.company_name ? String(existing.company_name) : '',
          `converted→profile:${companyId}`,
          grant.plan ? `plan:${grant.plan}` : '',
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 500),
      };
      // Soft optional column
      const withCol = await supabase
        .from('founding_waitlist')
        .update({ ...updates, converted_profile_id: companyId })
        .eq('id', id)
        .select('id, email, company_name, status, created_at')
        .maybeSingle();
      let entry = withCol.data;
      if (withCol.error && /converted_profile_id|column/i.test(withCol.error.message)) {
        const retry = await supabase
          .from('founding_waitlist')
          .update(updates)
          .eq('id', id)
          .select('id, email, company_name, status, created_at')
          .maybeSingle();
        entry = retry.data;
      }

      let emailSent = false;
      if (body.skipEmail !== true) {
        const { sendFoundingStatusEmail } = await import(
          '@/lib/billing/founding-waitlist-email'
        );
        const mail = await sendFoundingStatusEmail({
          to: String(existing.email),
          companyName: existing.company_name,
          status: 'converted',
        });
        emailSent = Boolean(mail.ok && !mail.skipped);
      }

      return NextResponse.json({
        success: true,
        entry,
        grant,
        emailSent,
        companyId,
        loginUrl: '/login',
        slots: await getFoundingSlotPulse(),
      });
    }

    if (action === 'bulk_invite' || action === 'bulk_slots_open') {
      const supabase = getSupabaseServer();
      const statusFilter = String(body.status || 'waiting').toLowerCase();
      const limit = Math.min(
        80,
        Math.max(1, Number(body.limit) || 40)
      );
      const setStatus = body.setStatus !== false && action === 'bulk_invite';

      let q = supabase
        .from('founding_waitlist')
        .select('id, email, company_name, status')
        .order('created_at', { ascending: true })
        .limit(limit);
      if (statusFilter && statusFilter !== 'all') {
        q = q.eq('status', statusFilter);
      }
      const { data: rows, error } = await q;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const {
        sendFoundingStatusEmail,
        sendFoundingSlotsOpenEmail,
      } = await import('@/lib/billing/founding-waitlist-email');

      let emailed = 0;
      let failed = 0;
      let updated = 0;
      const results: Array<{ id: number; email: string; ok: boolean }> = [];

      for (const row of rows || []) {
        const to = String(row.email || '');
        let mail: { ok: boolean; skipped?: boolean };
        if (action === 'bulk_invite') {
          mail = await sendFoundingStatusEmail({
            to,
            companyName: row.company_name,
            status: 'invited',
          });
          if (mail.ok && !mail.skipped && setStatus) {
            const { error: uErr } = await supabase
              .from('founding_waitlist')
              .update({ status: 'invited' })
              .eq('id', row.id);
            if (!uErr) updated += 1;
          }
        } else {
          mail = await sendFoundingSlotsOpenEmail({
            to,
            companyName: row.company_name,
          });
        }
        if (mail.ok && !mail.skipped) emailed += 1;
        else if (!mail.ok) failed += 1;
        results.push({ id: Number(row.id), email: to, ok: Boolean(mail.ok) });
      }

      return NextResponse.json({
        success: true,
        action,
        scanned: (rows || []).length,
        emailed,
        failed,
        updated,
        results,
      });
    }

    if (action !== 'set_status') {
      return NextResponse.json(
        {
          error:
            'action must be set_status | convert_grant | bulk_invite | bulk_slots_open',
        },
        { status: 400 }
      );
    }

    const id = Number(body.id);
    const status = String(body.status || '').toLowerCase().trim();
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json(
        {
          error: `status must be one of: ${[...ALLOWED_STATUS].join(', ')}`,
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: existing } = await supabase
      .from('founding_waitlist')
      .select('id, email, company_name, status')
      .eq('id', id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const prevStatus = String(existing.status || '').toLowerCase();
    const updates: Record<string, unknown> = { status };
    if (body.notes != null) {
      updates.notes = String(body.notes).slice(0, 500);
    }
    const { data, error } = await supabase
      .from('founding_waitlist')
      .update(updates)
      .eq('id', id)
      .select('id, email, company_name, status, created_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Soft-email on invite / convert transitions
    let emailSent = false;
    if (
      (status === 'invited' || status === 'converted') &&
      prevStatus !== status &&
      body.skipEmail !== true
    ) {
      const { sendFoundingStatusEmail } = await import(
        '@/lib/billing/founding-waitlist-email'
      );
      const mail = await sendFoundingStatusEmail({
        to: String(data.email),
        companyName: data.company_name,
        status,
      });
      emailSent = Boolean(mail.ok && !mail.skipped);
    }

    return NextResponse.json({
      success: true,
      entry: data,
      emailSent,
      onboardingUrl:
        status === 'invited' || status === 'converted'
          ? status === 'converted'
            ? '/login'
            : '/onboarding'
          : null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
