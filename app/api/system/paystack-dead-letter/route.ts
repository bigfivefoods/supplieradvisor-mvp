import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCronSecret, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { requireReferralOps } from '@/lib/billing/referral-controls';
import { runCipcAfterPayment } from '@/lib/business/cipc-after-payment';

/**
 * GET — list paid-not-verified companies with stored Paystack refs (dead-letter).
 * POST { action: 'rerun', companyId } or { action: 'rerun_all', limit? }
 * Auth: CRON_SECRET or referral ops.
 */
async function gate(request: NextRequest, body?: Record<string, unknown>) {
  const cron = assertCronSecret(request);
  if (cron.ok) return { ok: true as const, userId: 'ops:cron' };
  const ops = await requireReferralOps(request, {
    legacyPrivyUserId: legacyPrivyFrom(request, body) || null,
  });
  if (!ops.ok) return { ok: false as const, response: ops.response };
  return { ok: true as const, userId: ops.userId || 'ops:user' };
}

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  try {
    const items = await listDeadLetter(
      Number(request.nextUrl.searchParams.get('limit') || 40)
    );
    return NextResponse.json({
      success: true,
      count: items.length,
      items,
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const g = await gate(request, body);
    if (!g.ok) return g.response;

    const action = String(body.action || 'rerun').toLowerCase();
    if (action === 'list') {
      const items = await listDeadLetter(Number(body.limit || 40));
      return NextResponse.json({ success: true, items });
    }

    if (action === 'rerun_all') {
      const items = await listDeadLetter(Number(body.limit || 10));
      const results = [];
      for (const item of items) {
        if (!item.paystack_reference) continue;
        const result = await runCipcAfterPayment({
          companyId: item.id,
          paystackReference: String(item.paystack_reference),
          actorUserId: g.userId,
          source: 'paystack_dead_letter',
        });
        results.push({
          companyId: item.id,
          status: result.status,
          message: result.message,
        });
      }
      return NextResponse.json({
        success: true,
        action: 'rerun_all',
        results,
      });
    }

    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const items = await listDeadLetter(100);
    const hit = items.find((i) => i.id === companyId);
    const ref =
      body.paystackReference ||
      hit?.paystack_reference ||
      null;
    if (!ref) {
      return NextResponse.json(
        {
          error: 'No Paystack reference for this company',
          hint: 'They must complete R69 payment first',
        },
        { status: 400 }
      );
    }
    const result = await runCipcAfterPayment({
      companyId,
      paystackReference: String(ref),
      actorUserId: g.userId,
      source: 'paystack_dead_letter',
    });
    return NextResponse.json({
      success: true,
      action: 'rerun',
      companyId,
      result,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function listDeadLetter(limit: number) {
  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, verification_status, verification_payment_ref, metadata, updated_at'
    )
    .in('verification_status', ['pending', 'failed', 'mismatch', 'unverified'])
    .order('updated_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, limit * 2)));

  const items = [];
  for (const p of rows || []) {
    const meta =
      p.metadata && typeof p.metadata === 'object'
        ? (p.metadata as Record<string, unknown>)
        : {};
    const v =
      meta.verification && typeof meta.verification === 'object'
        ? (meta.verification as Record<string, unknown>)
        : {};
    const ref =
      String(p.verification_payment_ref || '').trim() ||
      String(v.paystack_reference || v.paystackReference || '').trim() ||
      null;
    if (!ref) continue;
    items.push({
      id: Number(p.id),
      trading_name: p.trading_name,
      legal_name: p.legal_name,
      verification_status: p.verification_status,
      paystack_reference: ref,
      updated_at: p.updated_at,
    });
    if (items.length >= limit) break;
  }
  return items;
}
