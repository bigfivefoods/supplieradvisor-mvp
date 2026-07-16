import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireReferralOps,
} from '@/lib/billing/referral-controls';
import { legacyPrivyFrom } from '@/lib/auth/api-auth';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';

/**
 * Platform ops: list / update founding waitlist.
 * Auth: same as referral ops (root owner/admin or REFERRAL_OPS_SECRET).
 *
 * GET  ?status=&limit=
 * POST { action: 'set_status', id, status }
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

    // Slot pulse (same as public endpoint)
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('trading_name', 'is', null);
    const used = count ?? 0;
    const remaining = Math.max(0, FOUNDING_FREE_COMPANY_LIMIT - used);

    let q = supabase
      .from('founding_waitlist')
      .select(
        'id, email, company_name, user_id, notes, status, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      q = q.eq('status', status);
    }

    const { data, error } = await q;
    if (error) {
      if (/relation|does not exist/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          entries: [],
          slots: {
            limit: FOUNDING_FREE_COMPANY_LIMIT,
            used,
            remaining,
            full: remaining <= 0,
          },
          warning: 'Run 20260716_platform_improvements.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      entries: data || [],
      slots: {
        limit: FOUNDING_FREE_COMPANY_LIMIT,
        used,
        remaining,
        full: remaining <= 0,
      },
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

    if (action !== 'set_status') {
      return NextResponse.json(
        { error: 'action must be set_status' },
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
