import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { rollupFeedback } from '@/lib/containers/reseller-feedback';

/**
 * GET ?companyId=&resellerId= — company rollup of reseller field feedback
 * for product development, pricing, and brand insight.
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
    const product = request.nextUrl.searchParams.get('product');
    const limit = Math.min(
      500,
      Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 200))
    );

    const supabase = getSupabaseServer();
    let q = supabase
      .from('reseller_customer_feedback')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (resellerId) q = q.eq('reseller_id', Number(resellerId));
    if (product) q = q.ilike('product_name', `%${product}%`);

    const { data, error } = await q;

    if (error) {
      if (isMissing(error.message)) {
        return NextResponse.json({
          success: true,
          feedback: [],
          summary: rollupFeedback([]),
          migration_required: true,
          warning:
            'Run supabase/migrations/20260714_reseller_customer_feedback.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data || [];

    // Enrich with reseller names
    const rids = [
      ...new Set(rows.map((r) => Number(r.reseller_id)).filter(Number.isFinite)),
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

    const feedback = rows.map((r) => ({
      ...r,
      reseller_name: nameById.get(Number(r.reseller_id)) || null,
    }));

    return NextResponse.json({
      success: true,
      feedback,
      summary: rollupFeedback(rows),
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
