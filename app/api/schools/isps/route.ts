import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  ispMaySupplySchool,
  ispsApprovedUnderAgencies,
  schoolActiveAgencyIds,
} from '@/lib/schools/isp-access';

async function enrichIspNames(
  supabase: ReturnType<typeof getSupabaseServer>,
  ispIds: number[]
) {
  const names: Record<number, string> = {};
  if (!ispIds.length) return names;
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, city, province')
    .in('id', ispIds);
  for (const p of profiles || []) {
    names[Number(p.id)] = p.trading_name || p.legal_name || `SP ${p.id}`;
  }
  return names;
}

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

    const { data: myAgency } = await supabase
      .from('nsnp_agency_profiles')
      .select('profile_id, agency_name, agency_type, status')
      .eq('profile_id', companyId)
      .maybeSingle();

    const { data: myIsp } = await supabase
      .from('nsnp_isp_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    // ── Agency: SP association requests + approved ───────────────────
    if (mode === 'agency' || (mode === 'auto' && myAgency && !myIsp)) {
      const { data: agencyLinks, error } = await supabase
        .from('nsnp_isp_agency_links')
        .select('*')
        .eq('agency_profile_id', companyId)
        .in('status', ['pending', 'active', 'suspended', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error && /does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          role: 'agency',
          agency: myAgency,
          pending: [],
          compliant: [],
          ispLinks: [],
          warning:
            'Run migration 20260726_isp_agency_association.sql for SP↔agency joins',
        });
      }

      const ispIds = [
        ...new Set(
          (agencyLinks || [])
            .map((l) => Number(l.isp_profile_id))
            .filter(Boolean)
        ),
      ];
      const names = await enrichIspNames(supabase, ispIds);
      const { data: ispRows } = ispIds.length
        ? await supabase
            .from('nsnp_isp_profiles')
            .select('*')
            .in('profile_id', ispIds)
        : { data: [] as Array<Record<string, unknown>> };

      const ispById: Record<number, Record<string, unknown>> = {};
      for (const i of ispRows || []) {
        ispById[Number(i.profile_id)] = i as Record<string, unknown>;
      }

      const enriched = (agencyLinks || []).map((l) => ({
        ...l,
        display_name:
          names[Number(l.isp_profile_id)] ||
          ispById[Number(l.isp_profile_id)]?.trading_name ||
          `SP ${l.isp_profile_id}`,
        isp: ispById[Number(l.isp_profile_id)] || null,
      }));

      return NextResponse.json({
        success: true,
        role: 'agency',
        agency: myAgency,
        ispLinks: enriched,
        pending: enriched.filter((l) => l.status === 'pending'),
        compliant: enriched.filter((l) => l.status === 'active'),
        suspended: enriched.filter((l) =>
          ['suspended', 'rejected'].includes(String(l.status))
        ),
        policy:
          'SPs request to join your department. You must approve before schools under you can order from them.',
      });
    }

    // ── SP: my agency associations + directory to join ───────────────
    if (mode === 'isp' || (mode === 'auto' && myIsp)) {
      const { data: myLinks } = await supabase
        .from('nsnp_isp_agency_links')
        .select('*')
        .eq('isp_profile_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(50);

      const { data: agencies } = await supabase
        .from('nsnp_agency_profiles')
        .select(
          'profile_id, agency_name, agency_type, province, status, contact_email'
        )
        .eq('status', 'active')
        .order('agency_name')
        .limit(200);

      const linkedAgencyIds = new Set(
        (myLinks || []).map((l) => Number(l.agency_profile_id))
      );
      const agencyById: Record<number, Record<string, unknown>> = {};
      for (const a of agencies || []) {
        agencyById[Number(a.profile_id)] = a as Record<string, unknown>;
      }

      const myAgencyLinks = (myLinks || []).map((l) => ({
        ...l,
        agency_name:
          agencyById[Number(l.agency_profile_id)]?.agency_name ||
          `Agency ${l.agency_profile_id}`,
        agency_type: agencyById[Number(l.agency_profile_id)]?.agency_type,
        province: agencyById[Number(l.agency_profile_id)]?.province,
      }));

      return NextResponse.json({
        success: true,
        role: 'isp',
        myIsp,
        myAgencyLinks,
        agencies: (agencies || []).map((a) => ({
          ...a,
          already_joined: linkedAgencyIds.has(Number(a.profile_id)),
        })),
        policy:
          'Request to join DBE/PEU/DoH. They must approve your association before schools under them can buy from you.',
      });
    }

    // ── School: SPs approved under the school’s agencies only ────────
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const schoolAgencies = await schoolActiveAgencyIds(
      supabase,
      Number(school.id)
    );
    const approvedIspIds = await ispsApprovedUnderAgencies(
      supabase,
      schoolAgencies
    );

    const [linksRes, directoryRows] = await Promise.all([
      supabase
        .from('school_isp_links')
        .select('*')
        .eq('school_profile_id', school.id),
      approvedIspIds.length
        ? supabase
            .from('nsnp_isp_profiles')
            .select('*')
            .in('profile_id', approvedIspIds)
            .limit(300)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    ]);

    const ispIds = [
      ...new Set([
        ...approvedIspIds,
        ...(linksRes.data || []).map((l) => Number(l.isp_profile_id)),
      ]),
    ].filter(Boolean);
    const names = await enrichIspNames(supabase, ispIds);

    const directory = (directoryRows.data || []).map((i) => ({
      ...i,
      display_name:
        (i as { trading_name?: string }).trading_name ||
        names[Number((i as { profile_id?: number }).profile_id)] ||
        `SP ${(i as { profile_id?: number }).profile_id}`,
    }));

    const links = (linksRes.data || []).map((l) => ({
      ...l,
      display_name: names[Number(l.isp_profile_id)] || `SP ${l.isp_profile_id}`,
      agency_approved: approvedIspIds.includes(Number(l.isp_profile_id)),
    }));

    // Agencies this school is under (for messaging)
    const { data: schoolAgencyLinks } = await supabase
      .from('school_agency_links')
      .select('agency_profile_id, status')
      .eq('school_profile_id', school.id)
      .in('status', ['active', 'pending']);

    return NextResponse.json({
      success: true,
      role: 'school',
      links,
      directory,
      myIsp,
      schoolAgencies: schoolAgencyLinks || [],
      schoolAgencyActiveCount: schoolAgencies.length,
      policy:
        'SPs must join your DBE/PEU/DoH and be approved. Schools must also be approved by that department. Only then can you link and order.',
      warning: linksRes.error?.message,
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

    // Register current company as SP — always pending until DBE/agency vets
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
            ? 'SP registered as pending — DBE/agency must mark compliant before schools should order.'
            : 'SP profile updated',
      });
    }

    // Update SP contact / trading fields (no self-compliant)
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

    // SP requests association with DBE/PEU/DoH (same pattern as school join)
    if (body.action === 'join_agency' || body.action === 'request_agency') {
      const agencyProfileId = Number(body.agency_profile_id);
      if (!Number.isFinite(agencyProfileId)) {
        return NextResponse.json(
          { error: 'agency_profile_id required' },
          { status: 400 }
        );
      }
      // Ensure SP profile exists
      const { data: ispRow } = await supabase
        .from('nsnp_isp_profiles')
        .select('profile_id')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!ispRow) {
        return NextResponse.json(
          {
            error:
              'Register as SP first (action register_as_isp), then request to join a department',
          },
          { status: 400 }
        );
      }
      const { data: agency } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_name, status')
        .eq('profile_id', agencyProfileId)
        .maybeSingle();
      if (!agency || agency.status !== 'active') {
        return NextResponse.json(
          { error: 'Agency not found or inactive' },
          { status: 404 }
        );
      }

      // Do not demote an already-active association
      const { data: existingLink } = await supabase
        .from('nsnp_isp_agency_links')
        .select('*')
        .eq('isp_profile_id', companyId)
        .eq('agency_profile_id', agencyProfileId)
        .maybeSingle();

      if (existingLink && String(existingLink.status) === 'active') {
        return NextResponse.json({
          success: true,
          link: existingLink,
          message: `Already approved with ${agency.agency_name}`,
        });
      }
      if (existingLink && String(existingLink.status) === 'pending') {
        return NextResponse.json({
          success: true,
          link: existingLink,
          message: `Join request already pending with ${agency.agency_name}`,
        });
      }

      const { data, error: jErr } = await supabase
        .from('nsnp_isp_agency_links')
        .upsert(
          {
            isp_profile_id: companyId,
            agency_profile_id: agencyProfileId,
            status: 'pending',
            requested_by: gate.userId || null,
            requested_at: new Date().toISOString(),
            accepted_at: null,
            notes: body.notes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'isp_profile_id,agency_profile_id' }
        )
        .select('*')
        .single();

      if (jErr) {
        return NextResponse.json({ error: jErr.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        link: data,
        message: `Join request sent to ${agency.agency_name}. They must approve before schools under them can order from you.`,
      });
    }

    if (body.action === 'leave_agency') {
      const agencyProfileId = Number(body.agency_profile_id);
      if (!Number.isFinite(agencyProfileId)) {
        return NextResponse.json(
          { error: 'agency_profile_id required' },
          { status: 400 }
        );
      }
      const { error } = await supabase
        .from('nsnp_isp_agency_links')
        .update({
          status: 'left',
          updated_at: new Date().toISOString(),
        })
        .eq('isp_profile_id', companyId)
        .eq('agency_profile_id', agencyProfileId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // School links to SP (SP must be approved under school's agency)
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

    const may = await ispMaySupplySchool(
      supabase,
      Number(school.id),
      ispProfileId
    );
    if (!may.ok) {
      return NextResponse.json(
        { error: may.reason || 'SP not approved for your department' },
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
