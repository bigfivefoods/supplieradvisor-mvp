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
    const mode = String(request.nextUrl.searchParams.get('mode') || 'auto');

    // Agency queue: all ISPs pending approval by DBE/DoH
    const { data: myAgency } = await supabase
      .from('nsnp_agency_profiles')
      .select('profile_id, agency_name, agency_type, status')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (mode === 'agency' || (mode === 'auto' && myAgency)) {
      const { data: allIsps, error } = await supabase
        .from('nsnp_isp_profiles')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) {
        return NextResponse.json({
          success: true,
          role: 'agency',
          agency: myAgency,
          pending: [],
          compliant: [],
          suspended: [],
          directory: [],
          warning: error.message,
        });
      }
      const ispIds = (allIsps || [])
        .map((i) => Number(i.profile_id))
        .filter(Boolean);
      let names: Record<number, string> = {};
      if (ispIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name, city, province')
          .in('id', ispIds);
        for (const p of profiles || []) {
          names[Number(p.id)] =
            p.trading_name || p.legal_name || `ISP ${p.id}`;
        }
      }
      const directory = (allIsps || []).map((i) => ({
        ...i,
        display_name:
          i.trading_name ||
          names[Number(i.profile_id)] ||
          `ISP ${i.profile_id}`,
      }));
      return NextResponse.json({
        success: true,
        role: 'agency',
        agency: myAgency,
        pending: directory.filter(
          (i) => String(i.compliance_status) === 'pending'
        ),
        compliant: directory.filter(
          (i) => String(i.compliance_status) === 'compliant'
        ),
        suspended: directory.filter((i) =>
          ['suspended', 'revoked'].includes(String(i.compliance_status))
        ),
        directory,
      });
    }

    // School view: only DBE-approved (compliant) ISPs in directory
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const [linksRes, compliantRes] = await Promise.all([
      supabase
        .from('school_isp_links')
        .select('*')
        .eq('school_profile_id', school.id),
      supabase
        .from('nsnp_isp_profiles')
        .select('*')
        .eq('compliance_status', 'compliant')
        .limit(300),
    ]);

    // Own ISP status (if this company also registered as ISP)
    const { data: myIsp } = await supabase
      .from('nsnp_isp_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    const ispIds = [
      ...new Set([
        ...(linksRes.data || []).map((l) => Number(l.isp_profile_id)),
        ...(compliantRes.data || []).map((i) => Number(i.profile_id)),
        myIsp ? Number(myIsp.profile_id) : 0,
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

    // Schools only see agency-approved ISPs
    const directory = (compliantRes.data || []).map((i) => ({
      ...i,
      display_name:
        i.trading_name || names[Number(i.profile_id)] || `ISP ${i.profile_id}`,
    }));

    // Enrich links with compliance (block UI if linked ISP later suspended)
    const { data: linkedIsps } = await supabase
      .from('nsnp_isp_profiles')
      .select('profile_id, compliance_status, trading_name')
      .in(
        'profile_id',
        (linksRes.data || []).map((l) => Number(l.isp_profile_id)).filter(Boolean)
          .length
          ? (linksRes.data || []).map((l) => Number(l.isp_profile_id))
          : [-1]
      );

    const complianceByIsp: Record<number, string> = {};
    for (const i of linkedIsps || []) {
      complianceByIsp[Number(i.profile_id)] = String(
        i.compliance_status || 'pending'
      );
    }

    const links = (linksRes.data || []).map((l) => ({
      ...l,
      display_name: names[Number(l.isp_profile_id)] || `ISP ${l.isp_profile_id}`,
      compliance_status:
        complianceByIsp[Number(l.isp_profile_id)] || 'unknown',
    }));

    return NextResponse.json({
      success: true,
      role: 'school',
      links,
      directory,
      myIsp,
      policy:
        'Schools may only link and order from ISPs approved by DBE/PEU/DoH (compliance_status = compliant).',
      warning: linksRes.error?.message || compliantRes.error?.message,
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

    // Register current company as ISP — always pending until DBE/agency vets
    if (body.action === 'register_as_isp') {
      const { data: existing } = await supabase
        .from('nsnp_isp_profiles')
        .select('compliance_status')
        .eq('profile_id', companyId)
        .maybeSingle();
      // Never allow self-promotion to compliant; preserve if already agency-set
      const keepCompliant =
        existing && String(existing.compliance_status) === 'compliant'
          ? 'compliant'
          : 'pending';
      const { data, error } = await supabase
        .from('nsnp_isp_profiles')
        .upsert(
          {
            profile_id: companyId,
            trading_name: body.trading_name || null,
            provinces: body.provinces || [],
            food_handling_cert: Boolean(body.food_handling_cert),
            compliance_status: keepCompliant,
            notes: body.notes || null,
            contact_name: body.contact_name || null,
            contact_phone: body.contact_phone || null,
            contact_email: body.contact_email || null,
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
      return NextResponse.json({
        success: true,
        isp: data,
        message:
          keepCompliant === 'pending'
            ? 'ISP registered as pending — DBE/agency must mark compliant before schools should order.'
            : 'ISP profile updated',
      });
    }

    // Update ISP contact / trading fields (no self-compliant)
    if (body.action === 'update_isp') {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      for (const k of [
        'trading_name',
        'provinces',
        'food_handling_cert',
        'notes',
        'contact_name',
        'contact_phone',
        'contact_email',
      ]) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      const { data, error } = await supabase
        .from('nsnp_isp_profiles')
        .update(patch)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
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

    // Schools may ONLY link ISPs approved by DBE/PEU/DoH
    const { data: isp } = await supabase
      .from('nsnp_isp_profiles')
      .select('compliance_status, trading_name')
      .eq('profile_id', ispProfileId)
      .maybeSingle();

    if (!isp) {
      return NextResponse.json(
        { error: 'ISP not registered on the programme' },
        { status: 404 }
      );
    }
    const status = String(isp.compliance_status || 'pending');
    if (status !== 'compliant') {
      return NextResponse.json(
        {
          error:
            status === 'suspended' || status === 'revoked'
              ? 'This ISP is suspended or revoked by the department and cannot supply schools.'
              : 'This ISP is not yet approved by DBE/PEU/DoH. Schools can only link department-approved ISPs.',
          compliance_status: status,
        },
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
