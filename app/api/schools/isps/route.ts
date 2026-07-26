import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

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

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const [linksRes, ispsRes] = await Promise.all([
      supabase
        .from('school_isp_links')
        .select('*')
        .eq('school_profile_id', school.id),
      supabase
        .from('nsnp_isp_profiles')
        .select('*')
        .eq('compliance_status', 'compliant')
        .limit(200),
    ]);

    // Also list pending ISPs for discovery
    const { data: allIsps } = await supabase
      .from('nsnp_isp_profiles')
      .select('*')
      .limit(300);

    const ispIds = [
      ...new Set([
        ...(linksRes.data || []).map((l) => Number(l.isp_profile_id)),
        ...(allIsps || []).map((i) => Number(i.profile_id)),
      ]),
    ].filter(Boolean);

    let names: Record<number, string> = {};
    if (ispIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, city, province, country')
        .in('id', ispIds);
      for (const p of profiles || []) {
        names[Number(p.id)] =
          p.trading_name || p.legal_name || `ISP ${p.id}`;
      }
    }

    const directory = (allIsps || []).map((i) => ({
      ...i,
      display_name:
        i.trading_name || names[Number(i.profile_id)] || `ISP ${i.profile_id}`,
    }));

    const links = (linksRes.data || []).map((l) => ({
      ...l,
      display_name: names[Number(l.isp_profile_id)] || `ISP ${l.isp_profile_id}`,
    }));

    return NextResponse.json({
      success: true,
      links,
      directory,
      warning: ispsRes.error?.message,
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
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();

    // Register current company as ISP
    if (body.action === 'register_as_isp') {
      const { data, error } = await supabase
        .from('nsnp_isp_profiles')
        .upsert(
          {
            profile_id: companyId,
            trading_name: body.trading_name || null,
            provinces: body.provinces || [],
            food_handling_cert: Boolean(body.food_handling_cert),
            compliance_status: body.compliance_status || 'pending',
            notes: body.notes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'profile_id' }
        )
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      try {
        await supabase
          .from('profiles')
          .update({ org_type: 'nsnp_isp' })
          .eq('id', companyId);
      } catch {
        /* soft */
      }
      return NextResponse.json({ success: true, isp: data });
    }

    // School links to ISP
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const ispProfileId = Number(body.isp_profile_id);
    if (!Number.isFinite(ispProfileId)) {
      return NextResponse.json(
        { error: 'isp_profile_id required' },
        { status: 400 }
      );
    }

    // Prefer compliant ISPs
    const { data: isp } = await supabase
      .from('nsnp_isp_profiles')
      .select('compliance_status')
      .eq('profile_id', ispProfileId)
      .maybeSingle();

    if (isp && String(isp.compliance_status) === 'suspended') {
      return NextResponse.json(
        { error: 'This ISP is suspended for NSNP deliveries' },
        { status: 400 }
      );
    }

    const { data, error: lErr } = await supabase
      .from('school_isp_links')
      .upsert(
        {
          school_profile_id: school.id,
          school_company_id: companyId,
          isp_profile_id: ispProfileId,
          status: body.status || 'active',
          preferred: Boolean(body.preferred),
          notes: body.notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'school_profile_id,isp_profile_id' }
      )
      .select('*')
      .single();

    if (lErr) {
      return NextResponse.json({ error: lErr.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, link: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
