import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

const LADDER = [
  { day: 1, label: 'gentle' },
  { day: 7, label: 'firm' },
  { day: 14, label: 'final' },
] as const;

function daysPastDue(due: string | null | undefined, today: string): number {
  if (!due) return 0;
  const d = String(due).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 0;
  const ms =
    new Date(today + 'T12:00:00Z').getTime() -
    new Date(d + 'T12:00:00Z').getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/**
 * GET ?companyId= — who would receive dunning on next cron run (for this seller).
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const today = new Date().toISOString().slice(0, 10);

    const { data: rows, error } = await supabase
      .from('customer_invoices')
      .select(
        'id, invoice_number, customer_name, contact_email, total_amount, amount_paid, currency, due_date, status, notes'
      )
      .eq('profile_id', companyId)
      .in('status', ['overdue', 'sent', 'partial', 'viewed'])
      .not('due_date', 'is', null)
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const preview = [];
    for (const inv of rows || []) {
      const balance = Math.max(
        0,
        Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
      );
      if (balance <= 0.009) continue;
      const dpd = daysPastDue(inv.due_date as string, today);
      let step: (typeof LADDER)[number] = LADDER[0];
      for (const s of LADDER) {
        if (dpd >= s.day) step = s;
      }
      const notes = inv.notes != null ? String(inv.notes) : '';
      const paused = /\[dunning paused/i.test(notes);
      const already = notes.includes(`[dunning day${step.day}`);
      const hasEmail = String(inv.contact_email || '').includes('@');
      preview.push({
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: inv.customer_name,
        contact_email: inv.contact_email,
        balance,
        currency: inv.currency || 'ZAR',
        due_date: inv.due_date,
        days_past_due: dpd,
        ladder_day: step.day,
        ladder_label: step.label,
        paused,
        already_sent_level: already,
        would_send: !paused && !already && hasEmail && dpd >= 1,
        skip_reason: paused
          ? 'paused'
          : already
            ? 'already_sent'
            : !hasEmail
              ? 'no_email'
              : dpd < 1
                ? 'not_due'
                : null,
      });
    }

    return NextResponse.json({
      success: true,
      asOf: today,
      wouldSend: preview.filter((p) => p.would_send).length,
      preview,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
