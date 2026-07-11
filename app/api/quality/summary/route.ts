import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';

/** GET ?companyId=&privyUserId= — quality control-tower metrics */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) {
        return NextResponse.json({ error: mem.error }, { status: mem.status });
      }
    }

    const supabase = getSupabaseServer();
    const { data: inspections, error } = await supabase
      .from('quality_inspections')
      .select('id, status, inspection_type, defects_found, lot_number, created_at')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          open: 0,
          passed: 0,
          failed: 0,
          total: 0,
          lots_on_hold: 0,
          migration_required: true,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = inspections || [];
    const open = rows.filter((r) => r.status === 'open').length;
    const passed = rows.filter((r) => r.status === 'passed').length;
    const failed = rows.filter((r) => r.status === 'failed').length;
    const lotsOnHold = new Set(
      rows
        .filter((r) => r.status === 'open' || r.status === 'failed')
        .map((r) => r.lot_number)
        .filter(Boolean)
    ).size;

    // Live lots count for traceability teaser
    const { count: lotCount } = await supabase
      .from('inventory_lots')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId);

    return NextResponse.json({
      success: true,
      open,
      passed,
      failed,
      total: rows.length,
      lots_on_hold: lotsOnHold,
      inventory_lots: lotCount ?? 0,
      recent: rows.slice(0, 8),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
