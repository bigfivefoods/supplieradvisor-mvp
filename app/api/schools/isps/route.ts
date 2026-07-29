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

const CLAIM_COLS = [
  'accepted_at',
  'requested_at',
  'requested_by',
  'requested_by_user_id',
] as const;

function isMissingColumnError(message: string): boolean {
  return (
    /schema cache/i.test(message) ||
    /could not find.*column/i.test(message) ||
    /column .* does not exist/i.test(message)
  );
}

function missingClaimColumn(message: string): boolean {
  return (
    isMissingColumnError(message) &&
    CLAIM_COLS.some((c) => message.toLowerCase().includes(c))
  );
}

const MIGRATION_HINT =
  'Run Supabase migration 20260729_school_isp_links_claim_columns.sql (adds accepted_at / requested_at on school_isp_links), then reload the schema cache.';

/**
 * Upsert school↔SP link. If claim-flow columns are missing in DB, retry with
 * core columns only so linking still works until migration is applied.
 */
async function upsertSchoolIspLink(
  supabase: ReturnType<typeof getSupabaseServer>,
  row: {
    school_profile_id: number;
    school_company_id: number;
    isp_profile_id: number;
    status: string;
    preferred?: boolean;
    notes?: string | null;
    requested_by?: string | null;
    requested_at?: string | null;
    requested_by_user_id?: string | null;
    accepted_at?: string | null;
    updated_at: string;
  }
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const full = { ...row };
  let { data, error } = await supabase
    .from('school_isp_links')
    .upsert(full, { onConflict: 'school_profile_id,isp_profile_id' })
    .select('*')
    .single();

  if (error && missingClaimColumn(error.message)) {
    const core = {
      school_profile_id: row.school_profile_id,
      school_company_id: row.school_company_id,
      isp_profile_id: row.isp_profile_id,
      status: row.status,
      preferred: row.preferred ?? false,
      notes: row.notes ?? null,
      updated_at: row.updated_at,
    };
    const retry = await supabase
      .from('school_isp_links')
      .upsert(core, { onConflict: 'school_profile_id,isp_profile_id' })
      .select('*')
      .single();
    data = retry.data;
    error = retry.error;
    if (!error) {
      return {
        data: data as Record<string, unknown>,
        error: null,
      };
    }
    return {
      data: null,
      error: `${error.message}. ${MIGRATION_HINT}`,
    };
  }

  if (error) {
    return {
      data: null,
      error: missingClaimColumn(error.message)
        ? `${error.message}. ${MIGRATION_HINT}`
        : error.message,
    };
  }
  return { data: data as Record<string, unknown>, error: null };
}

async function updateSchoolIspLink(
  supabase: ReturnType<typeof getSupabaseServer>,
  id: number,
  patch: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  let { data, error } = await supabase
    .from('school_isp_links')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error && missingClaimColumn(error.message)) {
    const core = { ...patch };
    for (const c of CLAIM_COLS) delete core[c];
    const retry = await supabase
      .from('school_isp_links')
      .update(core)
      .eq('id', id)
      .select('*')
      .single();
    data = retry.data;
    error = retry.error;
    if (error) {
      return {
        data: null,
        error: `${error.message}. ${MIGRATION_HINT}`,
      };
    }
  }

  if (error) {
    return {
      data: null,
      error: missingClaimColumn(error.message)
        ? `${error.message}. ${MIGRATION_HINT}`
        : error.message,
    };
  }
  return { data: data as Record<string, unknown>, error: null };
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

    // ── SP: my agency associations + school claims + directory to join ─
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

      const activeAgencyIds = (myLinks || [])
        .filter((l) => String(l.status) === 'active')
        .map((l) => Number(l.agency_profile_id))
        .filter((n) => Number.isFinite(n) && n > 0);

      // Existing school claims / links for this SP
      const { data: schoolLinkRows } = await supabase
        .from('school_isp_links')
        .select('*')
        .eq('isp_profile_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(300);

      const schoolProfileIds = [
        ...new Set(
          (schoolLinkRows || [])
            .map((l) => Number(l.school_profile_id))
            .filter(Boolean)
        ),
      ];
      const schoolNameById: Record<
        number,
        { school_name: string; emis_number?: string | null; district?: string | null }
      > = {};
      if (schoolProfileIds.length) {
        const chunk = 200;
        for (let i = 0; i < schoolProfileIds.length; i += chunk) {
          const slice = schoolProfileIds.slice(i, i + chunk);
          const { data: schs } = await supabase
            .from('school_profiles')
            .select('id, school_name, emis_number, district, province')
            .in('id', slice);
          for (const s of schs || []) {
            schoolNameById[Number(s.id)] = {
              school_name: String(s.school_name || `School ${s.id}`),
              emis_number: s.emis_number ? String(s.emis_number) : null,
              district: s.district ? String(s.district) : null,
            };
          }
        }
      }

      const mySchoolLinks = (schoolLinkRows || []).map((l) => {
        const meta = schoolNameById[Number(l.school_profile_id)];
        return {
          ...l,
          school_name: meta?.school_name || `School ${l.school_profile_id}`,
          emis_number: meta?.emis_number || null,
          district: meta?.district || null,
        };
      });

      // Optional school search for claim directory (q= name or EMIS)
      const q = String(
        request.nextUrl.searchParams.get('q') ||
          request.nextUrl.searchParams.get('search') ||
          ''
      )
        .trim()
        .slice(0, 80);
      let claimableSchools: Array<Record<string, unknown>> = [];
      if (q.length >= 2 && activeAgencyIds.length) {
        claimableSchools = await searchClaimableSchools(
          supabase,
          q,
          activeAgencyIds,
          companyId
        );
      }

      return NextResponse.json({
        success: true,
        role: 'isp',
        myIsp,
        myAgencyLinks,
        mySchoolLinks,
        pendingSchoolClaims: mySchoolLinks.filter(
          (l) => String(l.status) === 'pending'
        ),
        activeSchoolLinks: mySchoolLinks.filter(
          (l) => String(l.status) === 'active'
        ),
        claimableSchools,
        searchQuery: q || null,
        activeAgencyCount: activeAgencyIds.length,
        agencies: (agencies || []).map((a) => ({
          ...a,
          already_joined: linkedAgencyIds.has(Number(a.profile_id)),
        })),
        policy:
          '1) Join a DBE/PEU and get approved. 2) Claim schools under that department — each school must accept before you can supply them.',
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

    // SP preferred / compliance badges (kitchen GRNs for this school)
    const { computeIspIncentive } = await import('@/lib/schools/incentives');
    const incentiveByIsp = new Map<
      number,
      ReturnType<typeof computeIspIncentive>
    >();
    const { data: schoolReceipts } = await supabase
      .from('school_kitchen_receipts')
      .select('isp_profile_id, compliance_ok')
      .eq('school_profile_id', school.id)
      .not('isp_profile_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(400);
    const tally = new Map<number, { n: number; ok: number }>();
    for (const r of schoolReceipts || []) {
      const id = Number(r.isp_profile_id);
      if (!Number.isFinite(id)) continue;
      const t = tally.get(id) || { n: 0, ok: 0 };
      t.n += 1;
      if (r.compliance_ok !== false) t.ok += 1;
      tally.set(id, t);
    }
    for (const ispId of approvedIspIds) {
      const t = tally.get(ispId) || { n: 0, ok: 0 };
      incentiveByIsp.set(
        ispId,
        computeIspIncentive({
          deliveries: t.n,
          approved_ok: t.ok,
          wrong_brand: Math.max(0, t.n - t.ok),
        })
      );
    }

    const directory = (directoryRows.data || []).map((i) => {
      const id = Number((i as { profile_id?: number }).profile_id);
      const inc = incentiveByIsp.get(id);
      return {
        ...i,
        display_name:
          (i as { trading_name?: string }).trading_name ||
          names[id] ||
          `SP ${id}`,
        incentive: inc || null,
        preferred: inc?.status === 'preferred' || inc?.status === 'excellent',
        incentive_badge: inc?.badge || null,
        incentive_score: inc?.score ?? null,
      };
    });
    directory.sort((a, b) => {
      const pa = a.preferred ? 1 : 0;
      const pb = b.preferred ? 1 : 0;
      if (pb !== pa) return pb - pa;
      return Number(b.incentive_score || 0) - Number(a.incentive_score || 0);
    });

    const links = (linksRes.data || []).map((l) => {
      const id = Number(l.isp_profile_id);
      const inc = incentiveByIsp.get(id);
      return {
        ...l,
        display_name: names[id] || `SP ${id}`,
        agency_approved: approvedIspIds.includes(id),
        incentive: inc || null,
        preferred: inc?.status === 'preferred' || inc?.status === 'excellent',
        incentive_badge: inc?.badge || null,
        incentive_score: inc?.score ?? null,
      };
    });
    // Active preferred first for order pickers
    links.sort((a, b) => {
      const sa = String(a.status) === 'active' ? 1 : 0;
      const sb = String(b.status) === 'active' ? 1 : 0;
      if (sb !== sa) return sb - sa;
      const pa = a.preferred ? 1 : 0;
      const pb = b.preferred ? 1 : 0;
      if (pb !== pa) return pb - pa;
      return Number(b.incentive_score || 0) - Number(a.incentive_score || 0);
    });

    const pendingClaims = links.filter((l) => String(l.status) === 'pending');
    const activeLinks = links.filter((l) => String(l.status) === 'active');

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
      pendingClaims,
      activeLinks,
      directory,
      myIsp,
      schoolAgencies: schoolAgencyLinks || [],
      schoolAgencyActiveCount: schoolAgencies.length,
      policy:
        'SPs approved under your department can claim your school. Accept claims below, or link a department-approved SP yourself. Only active links can trade.',
      warning: linksRes.error?.message,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** Schools under SP's approved agencies matching name/EMIS, not already linked. */
async function searchClaimableSchools(
  supabase: ReturnType<typeof getSupabaseServer>,
  q: string,
  activeAgencyIds: number[],
  ispProfileId: number
): Promise<Array<Record<string, unknown>>> {
  const safe = q.replace(/[%_,]/g, ' ').trim();
  if (safe.length < 2 || !activeAgencyIds.length) return [];

  const pattern = `%${safe}%`;
  const { data: candidates } = await supabase
    .from('school_profiles')
    .select('id, school_name, emis_number, district, province, profile_id')
    .or(`school_name.ilike.${pattern},emis_number.ilike.${pattern}`)
    .limit(40);

  if (!candidates?.length) return [];

  const schoolIds = candidates.map((s) => Number(s.id)).filter(Boolean);
  const { data: agencyLinks } = await supabase
    .from('school_agency_links')
    .select('school_profile_id, agency_profile_id')
    .in('school_profile_id', schoolIds)
    .in('agency_profile_id', activeAgencyIds)
    .eq('status', 'active');

  const eligible = new Set(
    (agencyLinks || []).map((l) => Number(l.school_profile_id))
  );

  const { data: existing } = await supabase
    .from('school_isp_links')
    .select('school_profile_id, status')
    .eq('isp_profile_id', ispProfileId)
    .in('school_profile_id', schoolIds);

  const existingBySchool = new Map<number, string>();
  for (const e of existing || []) {
    existingBySchool.set(Number(e.school_profile_id), String(e.status));
  }

  return candidates
    .filter((s) => eligible.has(Number(s.id)))
    .map((s) => {
      const st = existingBySchool.get(Number(s.id));
      return {
        ...s,
        link_status: st || null,
        already_linked: st === 'active' || st === 'pending',
      };
    })
    .slice(0, 25);
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

    // ── SP claims a school (pending until school accepts) ────────────
    if (
      body.action === 'claim_school' ||
      body.action === 'request_school' ||
      body.action === 'connect_school'
    ) {
      const schoolProfileId = Number(
        body.school_profile_id || body.schoolProfileId
      );
      if (!Number.isFinite(schoolProfileId)) {
        return NextResponse.json(
          { error: 'school_profile_id required' },
          { status: 400 }
        );
      }

      const { data: ispRow } = await supabase
        .from('nsnp_isp_profiles')
        .select('profile_id')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!ispRow) {
        return NextResponse.json(
          { error: 'Register as SP before claiming schools' },
          { status: 400 }
        );
      }

      const { data: schoolRow } = await supabase
        .from('school_profiles')
        .select('id, school_name, profile_id, emis_number')
        .eq('id', schoolProfileId)
        .maybeSingle();
      if (!schoolRow) {
        return NextResponse.json(
          { error: 'School not found' },
          { status: 404 }
        );
      }

      const may = await ispMaySupplySchool(
        supabase,
        schoolProfileId,
        companyId
      );
      if (!may.ok) {
        return NextResponse.json(
          {
            error:
              may.reason ||
              'You must be approved under the same department as this school',
          },
          { status: 400 }
        );
      }

      const schoolCompanyId = Number(schoolRow.profile_id || 0);
      if (!Number.isFinite(schoolCompanyId) || schoolCompanyId <= 0) {
        return NextResponse.json(
          {
            error:
              'School has no company profile yet — it must join the programme before claims',
          },
          { status: 400 }
        );
      }

      const { data: existing } = await supabase
        .from('school_isp_links')
        .select('*')
        .eq('school_profile_id', schoolProfileId)
        .eq('isp_profile_id', companyId)
        .maybeSingle();

      if (existing && String(existing.status) === 'active') {
        return NextResponse.json({
          success: true,
          link: existing,
          message: `Already connected to ${schoolRow.school_name}`,
        });
      }
      if (existing && String(existing.status) === 'pending') {
        return NextResponse.json({
          success: true,
          link: existing,
          message: `Claim already pending with ${schoolRow.school_name} — wait for the school to accept`,
        });
      }

      const now = new Date().toISOString();
      const { data, error: cErr } = await upsertSchoolIspLink(supabase, {
        school_profile_id: schoolProfileId,
        school_company_id: schoolCompanyId,
        isp_profile_id: companyId,
        status: 'pending',
        preferred: false,
        notes: body.notes || 'SP claim / connect request',
        requested_by: 'isp',
        requested_at: now,
        requested_by_user_id: gate.userId || null,
        accepted_at: null,
        updated_at: now,
      });

      if (cErr) {
        return NextResponse.json({ error: cErr }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        link: data,
        message: `Claim sent to ${schoolRow.school_name}. The school must accept before you can supply them.`,
      });
    }

    // ── School accepts / rejects an SP claim ─────────────────────────
    if (
      body.action === 'accept_school_claim' ||
      body.action === 'accept_isp_claim' ||
      body.action === 'reject_school_claim' ||
      body.action === 'reject_isp_claim'
    ) {
      const accept =
        body.action === 'accept_school_claim' ||
        body.action === 'accept_isp_claim';
      const ispProfileId = Number(body.isp_profile_id);
      if (!Number.isFinite(ispProfileId)) {
        return NextResponse.json(
          { error: 'isp_profile_id required' },
          { status: 400 }
        );
      }

      const { school, error: schErr } = await getOrCreateSchoolProfile(
        supabase,
        companyId
      );
      if (schErr || !school) {
        return NextResponse.json(
          { error: schErr || 'No school profile for this company' },
          { status: 503 }
        );
      }

      const { data: existing } = await supabase
        .from('school_isp_links')
        .select('*')
        .eq('school_profile_id', school.id)
        .eq('isp_profile_id', ispProfileId)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json(
          { error: 'No claim from this SP for your school' },
          { status: 404 }
        );
      }

      if (accept) {
        const may = await ispMaySupplySchool(
          supabase,
          Number(school.id),
          ispProfileId
        );
        if (!may.ok) {
          return NextResponse.json(
            {
              error:
                may.reason ||
                'SP is no longer approved under your department — cannot accept',
            },
            { status: 400 }
          );
        }
      }

      const now = new Date().toISOString();
      const { data, error: uErr } = await updateSchoolIspLink(
        supabase,
        Number(existing.id),
        {
          status: accept ? 'active' : 'rejected',
          accepted_at: accept ? now : null,
          notes: body.notes || existing.notes || null,
          updated_at: now,
        }
      );

      if (uErr) {
        return NextResponse.json({ error: uErr }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        link: data,
        message: accept
          ? 'SP claim accepted — they can supply your school'
          : 'SP claim rejected',
      });
    }

    // SP withdraws a pending claim
    if (
      body.action === 'withdraw_school_claim' ||
      body.action === 'leave_school'
    ) {
      const schoolProfileId = Number(
        body.school_profile_id || body.schoolProfileId
      );
      if (!Number.isFinite(schoolProfileId)) {
        return NextResponse.json(
          { error: 'school_profile_id required' },
          { status: 400 }
        );
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('school_isp_links')
        .update({
          status: 'left',
          updated_at: now,
        })
        .eq('isp_profile_id', companyId)
        .eq('school_profile_id', schoolProfileId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: 'School connection withdrawn',
      });
    }

    // School unlinks an SP
    if (body.action === 'unlink_isp' || body.action === 'block_isp') {
      const ispProfileId = Number(body.isp_profile_id);
      if (!Number.isFinite(ispProfileId)) {
        return NextResponse.json(
          { error: 'isp_profile_id required' },
          { status: 400 }
        );
      }
      const { school, error: schErr } = await getOrCreateSchoolProfile(
        supabase,
        companyId
      );
      if (schErr || !school) {
        return NextResponse.json(
          { error: schErr || 'No school' },
          { status: 503 }
        );
      }
      const status =
        body.action === 'block_isp' ? 'blocked' : 'left';
      const { error } = await supabase
        .from('school_isp_links')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('school_profile_id', school.id)
        .eq('isp_profile_id', ispProfileId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, status });
    }

    // School links to SP (immediate active — school is the acceptor)
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const ispProfileId = Number(body.isp_profile_id);
    if (!Number.isFinite(ispProfileId)) {
      return NextResponse.json(
        { error: 'isp_profile_id required (or use action claim_school / accept_school_claim)' },
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

    const now = new Date().toISOString();
    const { data, error: lErr } = await upsertSchoolIspLink(supabase, {
      school_profile_id: Number(school.id),
      school_company_id: companyId,
      isp_profile_id: ispProfileId,
      status: body.status === 'pending' ? 'pending' : 'active',
      preferred: Boolean(body.preferred),
      notes: body.notes || null,
      requested_by: 'school',
      requested_at: now,
      requested_by_user_id: gate.userId || null,
      accepted_at: body.status === 'pending' ? null : now,
      updated_at: now,
    });

    if (lErr) {
      return NextResponse.json({ error: lErr }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      link: data,
      message:
        String(data?.status) === 'active'
          ? 'SP linked to school'
          : 'Invite sent to SP',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
