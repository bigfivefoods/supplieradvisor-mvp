import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/** GET ?companyId= — SHEQ control-tower metrics */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyPermission(
      request,
      companyId,
      'sheq',
      'view',
      { legacyPrivyUserId: legacyPrivyFrom(request) }
    );
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();

    const [incRes, ncrRes, capaRes, hazRes, inspRes] = await Promise.all([
      supabase
        .from('sheq_incidents')
        .select('id, status, severity, title, occurred_at', { count: 'exact' })
        .eq('profile_id', companyId)
        .order('occurred_at', { ascending: false })
        .limit(8),
      supabase
        .from('sheq_ncrs')
        .select('id, status, severity, title, raised_at, lot_number', { count: 'exact' })
        .eq('profile_id', companyId)
        .order('raised_at', { ascending: false })
        .limit(8),
      supabase
        .from('sheq_capas')
        .select('id, status, priority, title, due_date', { count: 'exact' })
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('sheq_hazards')
        .select('id, status, risk_score, title', { count: 'exact' })
        .eq('profile_id', companyId)
        .order('risk_score', { ascending: false })
        .limit(8),
      supabase
        .from('quality_inspections')
        .select('id, status', { count: 'exact' })
        .eq('profile_id', companyId)
        .in('status', ['open', 'failed']),
    ]);

    const migrationRequired =
      [incRes, ncrRes, capaRes, hazRes].some(
        (r) => r.error && /does not exist|schema cache/i.test(r.error.message)
      );

    if (migrationRequired) {
      return NextResponse.json({
        success: true,
        migration_required: true,
        openIncidents: 0,
        openNcrs: 0,
        openCapas: 0,
        openHazards: 0,
        highRisks: 0,
        qaHolds: inspRes.count || 0,
        recentIncidents: [],
        recentNcrs: [],
        recentCapas: [],
        topHazards: [],
        warning:
          'SHEQ tables missing — run supabase/migrations/20260712_sheq_module.sql',
      });
    }

    const incidents = incRes.data || [];
    const ncrs = ncrRes.data || [];
    const capas = capaRes.data || [];
    const hazards = hazRes.data || [];

    const highRisks = hazards.filter((r) => Number(r.risk_score || 0) >= 10).length;

    const [incidentsOpen, ncrsOpen, capasOpen, hazardsOpen] = await Promise.all([
      countOpen(supabase, 'sheq_incidents', companyId, [
        'open',
        'investigating',
        'awaiting_capa',
      ]),
      countOpen(supabase, 'sheq_ncrs', companyId, [
        'open',
        'containment',
        'capa_linked',
      ]),
      countOpen(supabase, 'sheq_capas', companyId, [
        'open',
        'in_progress',
        'pending_verify',
        'ineffective',
      ]),
      countOpen(supabase, 'sheq_hazards', companyId, ['open', 'controlled']),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        incidentsOpen,
        ncrsOpen,
        capasOpen,
        hazardsOpen,
        highRisks,
        qaHolds: inspRes.error ? 0 : inspRes.count || 0,
      },
      recentIncidents: incidents,
      recentNcrs: ncrs,
      recentCapas: capas,
      topHazards: hazards,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function countOpen(
  supabase: ReturnType<typeof getSupabaseServer>,
  table: string,
  companyId: number,
  statuses: string[]
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', companyId)
    .in('status', statuses);
  if (error) return 0;
  return count || 0;
}
