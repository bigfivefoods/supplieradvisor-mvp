import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/**
 * GET ?companyId= — container network hub metrics (parity with inventory/quality summary).
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

    const [cRes, tRes, rRes] = await Promise.all([
      supabase
        .from('containers')
        .select(
          'id, status, latitude, longitude, contractor_id, assigned_contractor'
        )
        .eq('profile_id', companyId)
        .limit(500),
      supabase
        .from('container_contractors')
        .select('id, training_status, verification_status')
        .eq('profile_id', companyId)
        .limit(500),
      supabase
        .from('container_resellers')
        .select('id, verification_status')
        .eq('profile_id', companyId)
        .limit(500),
    ]);

    if (cRes.error && /does not exist|schema cache/i.test(cRes.error.message)) {
      return NextResponse.json({
        success: true,
        total: 0,
        active: 0,
        mapped: 0,
        unmapped: 0,
        withContractor: 0,
        contractors: 0,
        contractorsVerified: 0,
        trainingCertified: 0,
        trainingPending: 0,
        resellers: 0,
        resellersVerified: 0,
        migration_required: true,
      });
    }

    if (cRes.error) {
      return NextResponse.json({ error: cRes.error.message }, { status: 500 });
    }

    const containers = cRes.data || [];
    const contractors = tRes.data || [];
    const resellers = rRes.error ? [] : rRes.data || [];

    const mapped = containers.filter(
      (c) => c.latitude != null && c.longitude != null
    ).length;
    const withContractor = containers.filter(
      (c) => c.contractor_id || c.assigned_contractor
    ).length;
    const active = containers.filter((c) => {
      const s = String(c.status || '').toLowerCase();
      return !s || ['active', 'deployed', 'operational', 'open'].includes(s);
    }).length;

    return NextResponse.json({
      success: true,
      total: containers.length,
      active,
      mapped,
      unmapped: containers.length - mapped,
      withContractor,
      contractors: contractors.length,
      contractorsVerified: contractors.filter(
        (c) =>
          String(c.verification_status || '').toLowerCase() === 'verified'
      ).length,
      trainingCertified: contractors.filter(
        (c) => c.training_status === 'certified'
      ).length,
      trainingPending: contractors.filter(
        (c) => !c.training_status || c.training_status === 'pending'
      ).length,
      resellers: resellers.length,
      resellersVerified: resellers.filter(
        (r) =>
          String(r.verification_status || '').toLowerCase() === 'verified'
      ).length,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
