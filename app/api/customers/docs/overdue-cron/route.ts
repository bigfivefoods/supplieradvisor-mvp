import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCronSecret, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { requireReferralOps } from '@/lib/billing/referral-controls';

/**
 * GET/POST — Flip past-due commercial invoices (status sent/partial/…) → overdue.
 * Auth: CRON_SECRET or referral ops.
 *
 * Safe to run daily. Soft-fails per row; returns counts.
 */
async function flipOverdue(limit = 500) {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const openStatuses = ['sent', 'partial', 'unpaid', 'issued', 'viewed'];

  const { data: rows, error } = await supabase
    .from('customer_invoices')
    .select('id, profile_id, status, due_date, invoice_number')
    .in('status', openStatuses)
    .lt('due_date', today)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })
    .limit(Math.min(1000, Math.max(1, limit)));

  if (error) {
    return {
      ok: false as const,
      error: error.message,
      flipped: 0,
      scanned: 0,
    };
  }

  const list = rows || [];
  let flipped = 0;
  const now = new Date().toISOString();
  for (const row of list) {
    const { error: uErr } = await supabase
      .from('customer_invoices')
      .update({ status: 'overdue', updated_at: now })
      .eq('id', row.id)
      .in('status', openStatuses);
    if (!uErr) flipped += 1;
  }

  return {
    ok: true as const,
    flipped,
    scanned: list.length,
    asOf: today,
  };
}

export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  const limit = Number(request.nextUrl.searchParams.get('limit') || 500);
  const result = await flipOverdue(limit);
  return NextResponse.json({ success: result.ok, ...result });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cron = assertCronSecret(request);
    if (!cron.ok) {
      const ops = await requireReferralOps(request, {
        legacyPrivyUserId: legacyPrivyFrom(request, body) || null,
      });
      if (!ops.ok) return ops.response;
    }
    const limit = Number(body.limit || 500);
    const result = await flipOverdue(limit);
    return NextResponse.json({ success: result.ok, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
