/**
 * Priority 4 — OTIF 48h early-warning alerts.
 * Finds school POs / deliveries with required date within 48h (or already late)
 * that are not yet received, and notifies SP + school once per day.
 *
 * Auth: Bearer CRON_SECRET or x-cron-secret
 * GET/POST /api/schools/otif-alerts/cron
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { logNsnpEvent } from '@/lib/schools/events';

export const runtime = 'nodejs';
export const maxDuration = 60;

function dayOffset(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  return run(request);
}
export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  try {
    const cron = assertCronSecret(request);
    if (!cron.ok) return cron.response;

    const supabase = getSupabaseServer();
    const today = dayOffset(0);
    const in48 = dayOffset(2);
    const notified: Array<Record<string, unknown>> = [];

    // Open POs due soon or late
    const { data: pos, error: pErr } = await supabase
      .from('school_purchase_orders')
      .select(
        'id, po_number, expected_date, status, isp_profile_id, school_profile_id, profile_id, metadata'
      )
      .in('status', [
        'submitted',
        'confirmed',
        'open',
        'dispatched',
        'partially_received',
      ])
      .not('expected_date', 'is', null)
      .lte('expected_date', in48)
      .limit(200);

    if (pErr) {
      return NextResponse.json(
        { error: pErr.message, success: false },
        { status: 400 }
      );
    }

    for (const po of pos || []) {
      const exp = String(po.expected_date).slice(0, 10);
      const late = exp < today;
      const meta =
        po.metadata && typeof po.metadata === 'object'
          ? (po.metadata as Record<string, unknown>)
          : {};
      const lastAlert = meta.otif_alert_day
        ? String(meta.otif_alert_day).slice(0, 10)
        : null;
      // Once per calendar day
      if (lastAlert === today) continue;

      const title = late
        ? `OTIF LATE · PO ${po.po_number || po.id}`
        : `OTIF due within 48h · PO ${po.po_number || po.id}`;
      const body = late
        ? `Required delivery ${exp} has passed — fulfil / receive now to protect OTIF scores.`
        : `Required delivery ${exp} is within 48 hours — create DN, dispatch with POD.`;

      const schoolCompany = Number(po.profile_id);
      const isp = Number(po.isp_profile_id);
      const schoolId = Number(po.school_profile_id);

      if (isp) {
        await logNsnpEvent(supabase, {
          companyId: isp,
          targetCompanyId: isp,
          schoolProfileId: schoolId,
          kind: late ? 'otif_late' : 'otif_due_48h',
          title,
          body,
          href: '/dashboard/schools/ops',
          metadata: { po_id: po.id, expected_date: exp, late },
        });
      }
      if (schoolCompany) {
        await logNsnpEvent(supabase, {
          companyId: schoolCompany,
          targetCompanyId: schoolCompany,
          schoolProfileId: schoolId,
          kind: late ? 'otif_late' : 'otif_due_48h',
          title,
          body,
          href: '/dashboard/schools/deliveries',
          metadata: { po_id: po.id, expected_date: exp, late },
        });
      }

      await supabase
        .from('school_purchase_orders')
        .update({
          metadata: { ...meta, otif_alert_day: today, otif_alert_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq('id', po.id);

      notified.push({
        po_id: po.id,
        po_number: po.po_number,
        expected_date: exp,
        late,
        isp_profile_id: isp,
        school_profile_id: schoolId,
      });
    }

    return NextResponse.json({
      success: true,
      scanned: (pos || []).length,
      notified: notified.length,
      items: notified.slice(0, 50),
      window: { today, in48 },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error', success: false },
      { status: 500 }
    );
  }
}
