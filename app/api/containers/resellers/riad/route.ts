import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  summarizeRiad,
  type ResellerRiadRecord,
} from '@/lib/containers/reseller-riad';

/**
 * GET ?companyId=&resellerId=&status=&type=
 * Company rollup of reseller field RIAD — problems from the last mile.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const resellerId = request.nextUrl.searchParams.get('resellerId');
    const type = request.nextUrl.searchParams.get('type');
    const status = request.nextUrl.searchParams.get('status');
    const limit = Math.min(
      500,
      Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 200))
    );

    const supabase = getSupabaseServer();
    let q = supabase
      .from('reseller_riad')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (resellerId) q = q.eq('reseller_id', Number(resellerId));
    if (type && type !== 'all') q = q.eq('riad_type', type);

    const { data, error } = await q;

    if (error) {
      if (isMissing(error.message)) {
        return NextResponse.json({
          success: true,
          items: [],
          summary: summarizeRiad([]),
          migration_required: true,
          warning: 'Run supabase/migrations/20260714_reseller_riad.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let items = (data || []) as ResellerRiadRecord[];

    // Reseller names
    const rids = [
      ...new Set(items.map((r) => Number(r.reseller_id)).filter(Number.isFinite)),
    ];
    const nameById = new Map<number, string>();
    if (rids.length) {
      const { data: people } = await supabase
        .from('container_resellers')
        .select('id, full_name')
        .eq('profile_id', companyId)
        .in('id', rids);
      for (const p of people || []) {
        nameById.set(Number(p.id), String(p.full_name || 'Reseller'));
      }
    }

    const fullSummary = summarizeRiad(items);

    if (status && status !== 'all') {
      if (status === 'open') {
        items = items.filter((i) =>
          ['open', 'active', 'in_progress', 'on_hold', 'mitigated'].includes(
            String(i.status || '').toLowerCase()
          )
        );
      } else if (status === 'closed') {
        items = items.filter((i) =>
          ['closed', 'resolved'].includes(String(i.status || '').toLowerCase())
        );
      } else if (status === 'critical') {
        items = items.filter(
          (i) =>
            ['open', 'active', 'in_progress', 'on_hold', 'mitigated'].includes(
              String(i.status || '').toLowerCase()
            ) &&
            (String(i.priority || '').toLowerCase() === 'critical' ||
              (i.rpn != null && Number(i.rpn) >= 75))
        );
      } else {
        items = items.filter(
          (i) => String(i.status || '').toLowerCase() === status.toLowerCase()
        );
      }
    }

    const enriched = items.map((r) => ({
      ...r,
      reseller_name: nameById.get(Number(r.reseller_id)) || null,
    }));

    return NextResponse.json({
      success: true,
      items: enriched,
      summary: fullSummary,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function isMissing(msg?: string) {
  const m = String(msg || '').toLowerCase();
  return (
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    m.includes('schema cache')
  );
}
