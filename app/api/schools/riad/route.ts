import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';
import { isClosedLike } from '@/lib/schools/riad';
import {
  fetchAgencySchoolLinks,
  fetchAllPaged,
  fetchByIds,
} from '@/lib/schools/supabase-page';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * School / SP / DBE RIAD register — risks, issues, actions, decisions.
 *
 * GET  companyId&scope=self|agency&type=&status=&target=school|isp|all
 * POST companyId + title  (self school log)
 *      companyId + target_type school|isp + target ids (agency raises against subject)
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const scope = String(sp.get('scope') || 'self').toLowerCase();
    const type = sp.get('type');
    const status = sp.get('status');
    const targetFilter = String(sp.get('target') || 'all').toLowerCase();
    const q = String(sp.get('q') || '').trim().toLowerCase();

    // ── Agency network RIAD log ──────────────────────────────────────
    if (scope === 'agency' || scope === 'dbe' || scope === 'programme') {
      const agency = await getAgencyRegistration(supabase, companyId);
      if (!agency) {
        return NextResponse.json(
          { error: 'Department only', success: false },
          { status: 403 }
        );
      }

      const items = await loadAgencyRiadLog(supabase, companyId, {
        type,
        status,
        targetFilter,
        q,
      });

      return NextResponse.json({
        success: true,
        scope: 'agency',
        items,
        summary: summarise(items),
        policy:
          'Programme RIAD log: entries raised by DBE against schools/SPs, plus RIADs logged by schools and SPs under your department.',
      });
    }

    // ── Self company log (school or SP) ──────────────────────────────
    let qy = supabase
      .from('riad_logs')
      .select('*')
      .eq('profile_id', companyId)
      .or('module.eq.schools,module.eq.school,module.eq.nsnp,module.eq.isp')
      .order('created_at', { ascending: false })
      .limit(500);

    if (type && type !== 'all') qy = qy.eq('riad_type', type);
    if (status && status !== 'all' && status !== 'open') {
      qy = qy.eq('status', status);
    }

    const { data, error } = await qy;
    if (error) {
      const retry = await supabase
        .from('riad_logs')
        .select('*')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (retry.error) {
        return NextResponse.json({
          success: true,
          items: [],
          summary: emptySummary(),
          warning: error.message,
        });
      }
      let retryItems = retry.data || [];
      if (status === 'open') {
        retryItems = retryItems.filter(
          (it) => !isClosedLike(String(it.status || ''))
        );
      }
      return NextResponse.json({
        success: true,
        items: retryItems,
        summary: summarise(retryItems),
      });
    }

    let items = data || [];
    if (status === 'open') {
      items = items.filter((it) => !isClosedLike(String(it.status || '')));
    }
    return NextResponse.json({
      success: true,
      items,
      summary: summarise(items),
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

    if (!body.title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const riadType = body.entry_type || body.riad_type || 'risk';
    const targetType = String(
      body.target_type || body.targetType || 'self'
    ).toLowerCase();

    // ── DBE raises against school or SP ──────────────────────────────
    if (targetType === 'school' || targetType === 'isp' || targetType === 'sp') {
      const agency = await getAgencyRegistration(supabase, companyId);
      if (!agency) {
        return NextResponse.json(
          {
            error: 'Only DBE / PEU can raise RIADs against schools or SPs',
            success: false,
          },
          { status: 403 }
        );
      }

      const isSchool = targetType === 'school';
      let subjectCompanyId: number | null = null;
      let schoolProfileId: number | null = null;
      let ispProfileId: number | null = null;
      let subjectName = '';
      let subjectMeta: Record<string, unknown> = {};

      if (isSchool) {
        schoolProfileId = Number(
          body.school_profile_id || body.schoolProfileId || body.target_id
        );
        if (!Number.isFinite(schoolProfileId)) {
          return NextResponse.json(
            { error: 'school_profile_id required' },
            { status: 400 }
          );
        }

        // Must be linked to this agency
        const { data: link } = await supabase
          .from('school_agency_links')
          .select('id, status, school_company_id')
          .eq('agency_profile_id', companyId)
          .eq('school_profile_id', schoolProfileId)
          .in('status', ['active', 'pending'])
          .maybeSingle();

        if (!link) {
          return NextResponse.json(
            {
              error:
                'School is not linked to your department — cannot raise RIAD',
            },
            { status: 403 }
          );
        }

        const { data: school } = await supabase
          .from('school_profiles')
          .select(
            'id, profile_id, school_name, emis_number, natemis, district, province'
          )
          .eq('id', schoolProfileId)
          .maybeSingle();

        if (!school) {
          return NextResponse.json(
            { error: 'School not found' },
            { status: 404 }
          );
        }

        subjectCompanyId =
          Number(school.profile_id) ||
          Number(link.school_company_id) ||
          null;
        if (!subjectCompanyId) {
          return NextResponse.json(
            { error: 'School has no company profile to attach RIAD to' },
            { status: 400 }
          );
        }
        subjectName = String(school.school_name || `School ${schoolProfileId}`);
        subjectMeta = {
          emis_number: school.emis_number,
          natemis: school.natemis,
          district: school.district,
          province: school.province,
        };
      } else {
        ispProfileId = Number(
          body.isp_profile_id ||
            body.ispProfileId ||
            body.target_profile_id ||
            body.target_id
        );
        if (!Number.isFinite(ispProfileId)) {
          return NextResponse.json(
            { error: 'isp_profile_id required' },
            { status: 400 }
          );
        }

        const { data: link } = await supabase
          .from('nsnp_isp_agency_links')
          .select('id, status')
          .eq('agency_profile_id', companyId)
          .eq('isp_profile_id', ispProfileId)
          .in('status', ['active', 'pending'])
          .maybeSingle();

        if (!link) {
          return NextResponse.json(
            {
              error:
                'Service provider is not associated with your department — cannot raise RIAD',
            },
            { status: 403 }
          );
        }

        const { data: isp } = await supabase
          .from('nsnp_isp_profiles')
          .select(
            'profile_id, trading_name, csd_number, district, cluster_allocation'
          )
          .eq('profile_id', ispProfileId)
          .maybeSingle();

        const { data: prof } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name')
          .eq('id', ispProfileId)
          .maybeSingle();

        subjectCompanyId = ispProfileId;
        subjectName =
          String(isp?.trading_name || '') ||
          String(prof?.trading_name || '') ||
          String(prof?.legal_name || '') ||
          `SP ${ispProfileId}`;
        subjectMeta = {
          csd_number: isp?.csd_number || null,
          district: isp?.district || null,
          cluster_allocation: isp?.cluster_allocation || null,
        };
      }

      const now = new Date().toISOString();
      // riad_logs.stakeholder_type is NOT NULL (legacy schema; use school|isp|internal)
      const entityType = isSchool ? 'school' : 'isp';
      const stakeholderType = isSchool ? 'school' : 'isp';
      const payload: Record<string, unknown> = {
        profile_id: subjectCompanyId,
        module: isSchool ? 'schools' : 'isp',
        riad_type: riadType,
        title: String(body.title),
        description: body.description || null,
        status: body.status || 'open',
        severity: body.severity || body.priority || 'medium',
        priority: body.priority || body.severity || 'medium',
        category: body.category || null,
        owner_name: body.owner_name || agency.agency_name || 'DBE',
        due_date: body.due_date || null,
        mitigation_plan: body.mitigation_plan || null,
        notes: body.notes || null,
        stakeholder_name: subjectName || 'Programme subject',
        stakeholder_type: stakeholderType,
        related_entity_type: entityType,
        related_entity_id: isSchool ? schoolProfileId : ispProfileId,
        source: 'dbe_agency',
        metadata: {
          domain: isSchool ? 'nsnp_school' : 'nsnp_isp',
          target_type: entityType,
          school_profile_id: schoolProfileId,
          isp_profile_id: ispProfileId,
          subject_name: subjectName,
          subject_company_id: subjectCompanyId,
          raised_by_agency_profile_id: companyId,
          raised_by_agency_name: agency.agency_name || 'Department',
          raised_by_user_id: gate.userId || null,
          raised_at: now,
          ...subjectMeta,
          ...(body.metadata || {}),
        },
        created_by: gate.userId || null,
      };

      const { data, error } = await insertRiadLog(supabase, payload);
      if (error || !data) {
        return NextResponse.json(
          { error: error || 'Insert failed' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        item: data,
        message: `RIAD raised against ${subjectName}`,
      });
    }

    // ── Self log (school / SP company) ───────────────────────────────
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    const { data: myIsp } = await supabase
      .from('nsnp_isp_profiles')
      .select('profile_id, trading_name')
      .eq('profile_id', companyId)
      .maybeSingle();

    const isIspSelf = Boolean(myIsp) && !school;
    const stakeholderType = isIspSelf ? 'isp' : school ? 'school' : 'internal';
    const payload: Record<string, unknown> = {
      profile_id: companyId,
      module: isIspSelf ? 'isp' : 'schools',
      riad_type: riadType,
      title: String(body.title),
      description: body.description || null,
      status: body.status || 'open',
      severity: body.severity || body.priority || 'medium',
      priority: body.priority || body.severity || 'medium',
      category: body.category || null,
      owner_name: body.owner_name || null,
      due_date: body.due_date || null,
      mitigation_plan: body.mitigation_plan || null,
      notes: body.notes || null,
      // NOT NULL on legacy schema
      stakeholder_name:
        body.category ||
        (isIspSelf ? 'SP operations' : 'School operations'),
      stakeholder_type: stakeholderType,
      related_entity_type: isIspSelf
        ? 'isp'
        : school
          ? 'school'
          : 'internal',
      related_entity_id: isIspSelf
        ? companyId
        : school
          ? Number(school.id)
          : companyId,
      metadata: {
        school_profile_id: school?.id ?? null,
        isp_profile_id: myIsp ? companyId : null,
        domain: isIspSelf ? 'nsnp_isp' : 'nsnp_school',
        raised_by: 'self',
        ...(body.metadata || {}),
      },
      created_by: gate.userId || null,
    };

    const { data, error } = await insertRiadLog(supabase, payload);
    if (error || !data) {
      return NextResponse.json(
        { error: error || 'Insert failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, item: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * Insert riad_logs with required NOT NULL columns always present.
 * Falls back to a minimal row if optional columns reject.
 */
async function insertRiadLog(
  supabase: ReturnType<typeof getSupabaseServer>,
  payload: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const stakeholderType = String(
    payload.stakeholder_type || 'internal'
  ).trim() || 'internal';
  const stakeholderName = String(
    payload.stakeholder_name || 'Programme'
  ).trim() || 'Programme';

  const full = {
    ...payload,
    stakeholder_type: stakeholderType,
    stakeholder_name: stakeholderName,
    status: payload.status || 'open',
    riad_type: payload.riad_type || 'risk',
    module: payload.module || 'schools',
  };

  const { data, error } = await supabase
    .from('riad_logs')
    .insert(full)
    .select('*')
    .single();

  if (!error && data) {
    return { data: data as Record<string, unknown>, error: null };
  }

  // Minimal set of columns known to exist on all environments
  const minimal = {
    profile_id: full.profile_id,
    title: full.title,
    description: full.description ?? null,
    status: full.status,
    riad_type: full.riad_type,
    module: full.module,
    stakeholder_type: stakeholderType,
    stakeholder_name: stakeholderName,
    severity: full.severity ?? 'medium',
    priority: full.priority ?? 'medium',
    category: full.category ?? null,
    metadata: full.metadata ?? {},
    source: full.source ?? null,
    created_by: full.created_by ?? null,
  };

  const retry = await supabase
    .from('riad_logs')
    .insert(minimal)
    .select('*')
    .single();

  if (retry.error) {
    // Last resort — barest insert that satisfies NOT NULL
    const bare = {
      profile_id: full.profile_id,
      title: full.title,
      stakeholder_type: stakeholderType,
      status: 'open',
    };
    const last = await supabase
      .from('riad_logs')
      .insert(bare)
      .select('*')
      .single();
    if (last.error) {
      return {
        data: null,
        error: retry.error.message || last.error.message,
      };
    }
    return { data: last.data as Record<string, unknown>, error: null };
  }

  return { data: retry.data as Record<string, unknown>, error: null };
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'title',
      'description',
      'status',
      'severity',
      'priority',
      'category',
      'owner_name',
      'due_date',
      'mitigation_plan',
      'notes',
      'resolution',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    if (body.entry_type || body.riad_type) {
      updates.riad_type = body.entry_type || body.riad_type;
    }
    if (isClosedLike(String(body.status || '')) && !updates.resolution) {
      updates.resolution = body.resolution || 'Closed';
    }

    const supabase = getSupabaseServer();

    // Load row — subject owner OR raising agency may update
    const { data: existing } = await supabase
      .from('riad_logs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const meta = (existing.metadata || {}) as Record<string, unknown>;
    const raisedByAgency = Number(meta.raised_by_agency_profile_id || 0);
    const isOwner = Number(existing.profile_id) === companyId;
    const isRaiser = raisedByAgency === companyId;

    if (!isOwner && !isRaiser) {
      // Agency may also update if subject is under them
      const agency = await getAgencyRegistration(supabase, companyId);
      if (!agency) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const allowed = await agencyOwnsSubject(
        supabase,
        companyId,
        existing as Record<string, unknown>
      );
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('riad_logs')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, item: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const id = Number(sp.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: existing } = await supabase
      .from('riad_logs')
      .select('id, profile_id, metadata')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const meta = (existing.metadata || {}) as Record<string, unknown>;
    const raisedByAgency = Number(meta.raised_by_agency_profile_id || 0);
    if (
      Number(existing.profile_id) !== companyId &&
      raisedByAgency !== companyId
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase.from('riad_logs').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function loadAgencyRiadLog(
  supabase: ReturnType<typeof getSupabaseServer>,
  agencyCompanyId: number,
  opts: {
    type?: string | null;
    status?: string | null;
    targetFilter: string;
    q: string;
  }
): Promise<Array<Record<string, unknown>>> {
  // Subject company ids: schools + SPs under agency
  const schoolLinks = await fetchAgencySchoolLinks(supabase, agencyCompanyId, [
    'active',
    'pending',
  ]).catch(() => [] as Array<Record<string, unknown>>);

  const schoolProfileIds = [
    ...new Set(
      schoolLinks
        .map((l) => Number(l.school_profile_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];

  let schoolCompanyIds = schoolLinks
    .map((l) => Number(l.school_company_id))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (schoolProfileIds.length) {
    const schools = await fetchByIds(
      supabase,
      'school_profiles',
      'id, profile_id',
      schoolProfileIds
    ).catch(() => [] as Array<Record<string, unknown>>);
    for (const s of schools) {
      const pid = Number(s.profile_id);
      if (Number.isFinite(pid) && pid > 0) schoolCompanyIds.push(pid);
    }
  }
  schoolCompanyIds = [...new Set(schoolCompanyIds)];

  const ispLinks = await fetchAllPaged(
    supabase,
    'nsnp_isp_agency_links',
    'isp_profile_id, status',
    (q) =>
      q
        .eq('agency_profile_id', agencyCompanyId)
        .in('status', ['active', 'pending'])
  ).catch(() => [] as Array<Record<string, unknown>>);

  const ispIds = [
    ...new Set(
      ispLinks
        .map((l) => Number(l.isp_profile_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];

  const subjectIds = [...new Set([...schoolCompanyIds, ...ispIds])];
  const byId = new Map<number, Record<string, unknown>>();

  // 1) RIADs on subject profiles
  for (let i = 0; i < subjectIds.length; i += 150) {
    const chunk = subjectIds.slice(i, i + 150);
    if (!chunk.length) continue;
    let qy = supabase
      .from('riad_logs')
      .select('*')
      .in('profile_id', chunk)
      .order('created_at', { ascending: false })
      .limit(400);
    if (opts.type && opts.type !== 'all') {
      qy = qy.eq('riad_type', opts.type);
    }
    const { data } = await qy;
    for (const row of data || []) {
      byId.set(Number(row.id), row as Record<string, unknown>);
    }
  }

  // 2) Agency-raised (in case subject query missed / different profile)
  // PostgREST: filter metadata contains raised_by_agency_profile_id
  try {
    const { data: raised } = await supabase
      .from('riad_logs')
      .select('*')
      .contains('metadata', {
        raised_by_agency_profile_id: agencyCompanyId,
      })
      .order('created_at', { ascending: false })
      .limit(500);
    for (const row of raised || []) {
      byId.set(Number(row.id), row as Record<string, unknown>);
    }
  } catch {
    /* soft — contains may fail on some schemas */
  }

  // Also try text-cast path if contains failed silently empty and we have few results
  if (byId.size < 5) {
    const { data: recent } = await supabase
      .from('riad_logs')
      .select('*')
      .or('module.eq.schools,module.eq.school,module.eq.nsnp,module.eq.isp')
      .order('created_at', { ascending: false })
      .limit(800);
    for (const row of recent || []) {
      const meta = (row.metadata || {}) as Record<string, unknown>;
      if (Number(meta.raised_by_agency_profile_id) === agencyCompanyId) {
        byId.set(Number(row.id), row as Record<string, unknown>);
      }
    }
  }

  let items = [...byId.values()];

  // Enrich display fields
  const schoolByCompany = new Map<number, Record<string, unknown>>();
  if (schoolProfileIds.length) {
    const schools = await fetchByIds(
      supabase,
      'school_profiles',
      'id, profile_id, school_name, emis_number, natemis, district',
      schoolProfileIds
    ).catch(() => [] as Array<Record<string, unknown>>);
    for (const s of schools) {
      if (s.profile_id != null) {
        schoolByCompany.set(Number(s.profile_id), s);
      }
    }
  }
  const ispNameById = new Map<number, string>();
  if (ispIds.length) {
    const isps = await fetchByIds(
      supabase,
      'nsnp_isp_profiles',
      'profile_id, trading_name, csd_number, district',
      ispIds,
      'profile_id'
    ).catch(() => [] as Array<Record<string, unknown>>);
    for (const i of isps) {
      ispNameById.set(
        Number(i.profile_id),
        String(i.trading_name || `SP ${i.profile_id}`)
      );
    }
  }

  items = items.map((it) => {
    const meta = (it.metadata || {}) as Record<string, unknown>;
    const pid = Number(it.profile_id);
    const school = schoolByCompany.get(pid);
    const targetType =
      String(meta.target_type || it.related_entity_type || '') ||
      (school ? 'school' : ispNameById.has(pid) ? 'isp' : 'unknown');
    const subjectName =
      String(meta.subject_name || '') ||
      (school ? String(school.school_name) : '') ||
      ispNameById.get(pid) ||
      String(it.stakeholder_name || '') ||
      `Profile ${pid}`;

    return {
      ...it,
      target_type: targetType === 'sp' ? 'isp' : targetType,
      subject_name: subjectName,
      raised_by_agency:
        Number(meta.raised_by_agency_profile_id) === agencyCompanyId ||
        String(it.source || '') === 'dbe_agency',
      agency_name: meta.raised_by_agency_name || null,
      emis: meta.natemis || meta.emis_number || school?.natemis || school?.emis_number || null,
      csd_number: meta.csd_number || null,
      district: meta.district || school?.district || null,
    };
  });

  if (opts.targetFilter === 'school') {
    items = items.filter((i) => String(i.target_type) === 'school');
  } else if (opts.targetFilter === 'isp' || opts.targetFilter === 'sp') {
    items = items.filter((i) => String(i.target_type) === 'isp');
  }

  if (opts.status === 'open') {
    items = items.filter((it) => !isClosedLike(String(it.status || '')));
  } else if (opts.status && opts.status !== 'all') {
    items = items.filter(
      (it) =>
        String(it.status || '').toLowerCase() ===
        String(opts.status).toLowerCase()
    );
  }

  if (opts.type && opts.type !== 'all') {
    items = items.filter(
      (it) =>
        String(it.riad_type || '').toLowerCase() ===
        String(opts.type).toLowerCase()
    );
  }

  if (opts.q) {
    items = items.filter((it) => {
      const hay = [
        it.title,
        it.description,
        it.subject_name,
        it.category,
        it.owner_name,
        it.emis,
        it.csd_number,
        it.district,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(opts.q);
    });
  }

  items.sort((a, b) => {
    const ta = String(a.created_at || '');
    const tb = String(b.created_at || '');
    return tb.localeCompare(ta);
  });

  return items.slice(0, 1000);
}

async function agencyOwnsSubject(
  supabase: ReturnType<typeof getSupabaseServer>,
  agencyCompanyId: number,
  row: Record<string, unknown>
): Promise<boolean> {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  if (Number(meta.raised_by_agency_profile_id) === agencyCompanyId) return true;

  const schoolProfileId = Number(
    meta.school_profile_id || row.related_entity_id || 0
  );
  if (schoolProfileId && String(row.related_entity_type) === 'school') {
    const { data } = await supabase
      .from('school_agency_links')
      .select('id')
      .eq('agency_profile_id', agencyCompanyId)
      .eq('school_profile_id', schoolProfileId)
      .in('status', ['active', 'pending'])
      .maybeSingle();
    if (data) return true;
  }

  const ispId = Number(meta.isp_profile_id || row.profile_id || 0);
  if (ispId) {
    const { data } = await supabase
      .from('nsnp_isp_agency_links')
      .select('id')
      .eq('agency_profile_id', agencyCompanyId)
      .eq('isp_profile_id', ispId)
      .in('status', ['active', 'pending'])
      .maybeSingle();
    if (data) return true;
  }
  return false;
}

function emptySummary() {
  return {
    total: 0,
    open: 0,
    closed: 0,
    inProgress: 0,
    onHold: 0,
    critical: 0,
    schools: 0,
    isps: 0,
    agency_raised: 0,
    byStatus: {} as Record<string, number>,
  };
}

function summarise(items: Array<Record<string, unknown>>) {
  const s = emptySummary();
  s.total = items.length;
  for (const it of items) {
    const st = String(it.status || 'open').toLowerCase();
    s.byStatus[st] = (s.byStatus[st] || 0) + 1;
    if (isClosedLike(st)) s.closed += 1;
    else if (st === 'in_progress') s.inProgress += 1;
    else if (st === 'on_hold') s.onHold += 1;
    else s.open += 1;
    const sev = String(it.severity || it.priority || '').toLowerCase();
    if (sev === 'critical') s.critical += 1;
    if (String(it.target_type) === 'school') s.schools += 1;
    if (String(it.target_type) === 'isp') s.isps += 1;
    if (it.raised_by_agency) s.agency_raised += 1;
  }
  return s;
}
