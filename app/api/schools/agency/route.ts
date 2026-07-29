import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  fetchAgencySchoolLinks,
  fetchAllPaged,
  fetchByIds,
} from '@/lib/schools/supabase-page';
import { familyForAgencyType } from '@/lib/entities/programme-hierarchy';

function familyForAgencyTypeSafe(t: string) {
  try {
    return familyForAgencyType(t);
  } catch {
    return 'education' as const;
  }
}

/**
 * DBE / governmental agency:
 * - Register current company as agency (DBE)
 * - School joins agency
 * - Agency lists linked schools + summary scores
 *
 * GET ?mode=agency&lite=1 → counts + pending only (join hub)
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
    const mode = String(sp.get('mode') || 'school'); // school | agency | directory

    // Directory of agencies schools can join
    if (mode === 'directory' || sp.get('directory') === '1') {
      const { data, error } = await supabase
        .from('nsnp_agency_profiles')
        .select('*')
        .eq('status', 'active')
        .order('agency_name')
        .limit(200);
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          return NextResponse.json({
            success: true,
            agencies: [],
            warning:
              'Run migration 20260726_schools_dbe_agency_menu.sql for agency links',
          });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, agencies: data || [] });
    }

    // Agency console: schools linked to me
    const { data: myAgency } = await supabase
      .from('nsnp_agency_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (mode === 'agency' || myAgency) {
      // Health agencies belong in the Health module
      if (
        myAgency &&
        familyForAgencyTypeSafe(String(myAgency.agency_type || '')) === 'health'
      ) {
        return NextResponse.json(
          {
            error:
              'This company is not a Schools (DBE / PEU) department.',
            redirect: '/dashboard',
          },
          { status: 403 }
        );
      }

      const lite =
        sp.get('lite') === '1' ||
        sp.get('lite') === 'true' ||
        sp.get('summaryOnly') === '1';
      const statusFilter = String(sp.get('linkStatus') || 'all').toLowerCase();

      let links: Array<Record<string, unknown>> = [];
      try {
        const statuses =
          statusFilter === 'pending'
            ? ['pending']
            : statusFilter === 'active'
              ? ['active']
              : ['active', 'pending', 'suspended'];
        links = await fetchAgencySchoolLinks(supabase, companyId, statuses);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'link load failed';
        if (/does not exist|schema cache/i.test(msg)) {
          return NextResponse.json({
            success: true,
            agency: myAgency,
            schools: [],
            summary: {
              schoolCount: 0,
              activeLinks: 0,
              pendingLinks: 0,
              totalLearners: 0,
              totalVerified: 0,
              avgPrizeScore: null,
            },
            warning: msg,
          });
        }
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const activeLinks = links.filter((l) => l.status === 'active').length;
      const pendingLinks = links.filter((l) => l.status === 'pending').length;
      const suspendedLinks = links.filter(
        (l) => l.status === 'suspended'
      ).length;

      // Lite mode for join hub: counts + pending schools only (not 5k rows)
      if (lite) {
        const pendingIds = links
          .filter((l) => l.status === 'pending')
          .map((l) => Number(l.school_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0);
        let pendingSchools: Array<Record<string, unknown>> = [];
        if (pendingIds.length) {
          const rows = await fetchByIds(
            supabase,
            'school_profiles',
            'id, profile_id, school_name, emis_number, natemis, province, district, learner_count_enrolled, member_type, status',
            pendingIds.slice(0, 200)
          );
          const linkBy = new Map(
            links.map((l) => [Number(l.school_profile_id), l] as const)
          );
          pendingSchools = rows.map((s) => ({
            ...s,
            link_status: 'pending',
            linked_at: linkBy.get(Number(s.id))?.created_at || null,
          }));
        }
        return NextResponse.json({
          success: true,
          role: 'agency',
          programme: 'education',
          agency: myAgency,
          lite: true,
          schools: pendingSchools,
          pendingSchools,
          schools_total: links.length,
          summary: {
            schoolCount: links.length,
            activeLinks,
            pendingLinks,
            suspendedLinks,
            totalLearners: 0,
            totalVerified: 0,
            avgPrizeScore: null,
          },
          links_total: links.length,
        });
      }

      const schoolIds = [
        ...new Set(
          links
            .map((l) => Number(l.school_profile_id))
            .filter((n) => Number.isFinite(n) && n > 0)
        ),
      ];

      let schools: Array<Record<string, unknown>> = [];
      if (schoolIds.length) {
        try {
          schools = await fetchByIds(
            supabase,
            'school_profiles',
            'id, profile_id, school_name, emis_number, province, district, circuit, cmc, quintile, local_municipality, learner_count_enrolled, learner_count_verified, learner_count_nsnp_eligible, final_nsnp_approved_enrol, final_emis_enrol, natemis, staff_count, lat, lng, status, member_type, registry_source',
            schoolIds
          );
        } catch {
          // Lean select if registry columns not migrated yet
          schools = await fetchByIds(
            supabase,
            'school_profiles',
            'id, profile_id, school_name, emis_number, province, district, circuit, quintile, learner_count_enrolled, learner_count_verified, learner_count_nsnp_eligible, staff_count, lat, lng, status, member_type',
            schoolIds
          );
        }
      }

      // Education desk: exclude health facilities
      schools = schools.filter((s) => {
        const mt = String(s.member_type || 'school');
        return !['hospital', 'clinic', 'shelter'].includes(mt);
      });

      // Prize scores only for a sample (full board is on prizes report)
      const scoreBySchool = new Map<number, Record<string, unknown>>();
      const prizeSample = schoolIds.slice(0, 200);
      if (prizeSample.length) {
        for (let i = 0; i < prizeSample.length; i += 100) {
          const chunk = prizeSample.slice(i, i + 100);
          const { data: sc } = await supabase
            .from('nsnp_prize_scores')
            .select(
              'school_profile_id, total_score, approved_brand_pct, feeding_completeness_pct, data_quality_pct, computed_at, period_id'
            )
            .in('school_profile_id', chunk)
            .order('computed_at', { ascending: false })
            .limit(500);
          for (const row of sc || []) {
            const sid = Number(row.school_profile_id);
            if (scoreBySchool.has(sid)) continue;
            scoreBySchool.set(sid, row as Record<string, unknown>);
          }
        }
      }

      const linkBySchool = new Map(
        links.map((l) => [Number(l.school_profile_id), l] as const)
      );

      const enriched: Array<Record<string, unknown>> = schools.map((s) => {
        const link = linkBySchool.get(Number(s.id));
        const sc = scoreBySchool.get(Number(s.id));
        return {
          ...s,
          link_status: link?.status || null,
          linked_at: link?.created_at || null,
          prize_score: sc?.total_score ?? null,
          approved_brand_pct: sc?.approved_brand_pct ?? null,
          feeding_completeness_pct: sc?.feeding_completeness_pct ?? null,
        };
      });

      // Pending first, then by name
      enriched.sort((a, b) => {
        const sa = String(a.link_status || '');
        const sb = String(b.link_status || '');
        if (sa === 'pending' && sb !== 'pending') return -1;
        if (sb === 'pending' && sa !== 'pending') return 1;
        return String(a.school_name || '').localeCompare(
          String(b.school_name || '')
        );
      });

      const byDistrict = new Map<string, number>();
      for (const s of enriched) {
        const key =
          [s.district, s.province].filter(Boolean).join(', ') || 'Unknown';
        byDistrict.set(key, (byDistrict.get(key) || 0) + 1);
      }

      const summary = {
        schoolCount: enriched.length,
        activeLinks,
        pendingLinks,
        suspendedLinks,
        totalLearners: enriched.reduce(
          (n, s) =>
            n +
            Number(
              s.learner_count_enrolled ||
                s.final_emis_enrol ||
                s.final_nsnp_approved_enrol ||
                0
            ),
          0
        ),
        totalVerified: enriched.reduce(
          (n, s) => n + Number(s.learner_count_verified ?? 0),
          0
        ),
        totalNsnpApproved: enriched.reduce(
          (n, s) => n + Number(s.final_nsnp_approved_enrol ?? 0),
          0
        ),
        districts: byDistrict.size,
        byDistrict: [...byDistrict.entries()]
          .map(([key, schools]) => ({ key, schools }))
          .sort((a, b) => b.schools - a.schools),
        avgPrizeScore: (() => {
          const vals = enriched
            .map((s) => Number(s.prize_score))
            .filter((n) => Number.isFinite(n) && n > 0);
          if (!vals.length) return null;
          return (
            Math.round(
              (vals.reduce((a, b) => a + b, 0) / vals.length) * 10
            ) / 10
          );
        })(),
      };

      return NextResponse.json({
        success: true,
        role: 'agency',
        agency: myAgency,
        schools: enriched,
        schools_total: enriched.length,
        summary,
        // Links alone can be large; omit full list — summary + schools enough
        links_total: links.length,
      });
    }

    // School view: my links + directory
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const [linksRes, dirRes] = await Promise.all([
      supabase
        .from('school_agency_links')
        .select('*')
        .eq('school_profile_id', school.id),
      supabase
        .from('nsnp_agency_profiles')
        .select('*')
        .eq('status', 'active')
        .order('agency_name')
        .limit(200),
    ]);

    if (linksRes.error && /does not exist|schema cache/i.test(linksRes.error.message)) {
      return NextResponse.json({
        success: true,
        role: 'school',
        school,
        links: [],
        agencies: [],
        warning:
          'Run migration 20260726_schools_dbe_agency_menu.sql for DBE agency links',
      });
    }

    // Education join: only DBE/PEU
    const educationAgencies = (dirRes.data || []).filter(
      (a) =>
        familyForAgencyType(String(a.agency_type || 'dbe')) === 'education'
    );

    const agencyIds = [
      ...new Set(
        (linksRes.data || [])
          .map((l) => Number(l.agency_profile_id))
          .filter(Boolean)
      ),
    ];
    let agencyNames: Record<number, string> = {};
    if (agencyIds.length) {
      const { data: ag } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_name, agency_type')
        .in('profile_id', agencyIds);
      for (const a of ag || []) {
        agencyNames[Number(a.profile_id)] = String(a.agency_name);
      }
    }

    const links = (linksRes.data || []).map((l) => ({
      ...l,
      agency_name:
        agencyNames[Number(l.agency_profile_id)] ||
        `Agency ${l.agency_profile_id}`,
    }));

    return NextResponse.json({
      success: true,
      role: 'school',
      school,
      links,
      agencies: educationAgencies,
      isAgency: Boolean(myAgency),
      myAgency: myAgency || null,
      programme: 'education',
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
    const action = String(body.action || '');

    // Register this company as DBE / PEU only
    if (action === 'register_agency') {
      const name =
        String(body.agency_name || body.name || '').trim() ||
        'Department of Basic Education';
      let agencyType = String(body.agency_type || 'dbe');
      const { familyForAgencyType } = await import(
        '@/lib/entities/programme-hierarchy'
      );
      const {
        PUBLIC_EDUCATION_AGENCY_TYPES,
        isPlatformOperatorUserId,
        GOV_PENDING_MESSAGE,
        clampGovernmentModules,
      } = await import('@/lib/system/platform-control');
      if (familyForAgencyType(agencyType) === 'health') {
        return NextResponse.json(
          {
            error:
              'Only DBE / PEU education departments register on the Schools desk.',
            redirect: '/dashboard/schools/agency',
          },
          { status: 400 }
        );
      }
      // Education programme offices only (no generic "other government")
      if (
        !(PUBLIC_EDUCATION_AGENCY_TYPES as readonly string[]).includes(
          agencyType
        )
      ) {
        agencyType = 'dbe';
      }
      const autoActive = await isPlatformOperatorUserId(gate.userId);
      const status = autoActive ? 'active' : 'pending';
      const { data, error } = await supabase
        .from('nsnp_agency_profiles')
        .upsert(
          {
            profile_id: companyId,
            agency_name: name,
            agency_type: agencyType,
            province: body.province || null,
            district: body.district || null,
            contact_name: body.contact_name || null,
            contact_email: body.contact_email || null,
            contact_phone: body.contact_phone || null,
            description: body.description || null,
            status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'profile_id' }
        )
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      // Seed catalogue only when activated
      if (status === 'active') {
        try {
          const { cloneNationalIntoAgency } = await import(
            '@/lib/schools/approved-catalogue'
          );
          await cloneNationalIntoAgency(supabase, companyId);
        } catch {
          /* soft */
        }
      }
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', companyId)
          .maybeSingle();
        const meta =
          prof?.metadata && typeof prof.metadata === 'object'
            ? { ...(prof.metadata as Record<string, unknown>) }
            : {};
        meta.enabled_modules = clampGovernmentModules(
          (meta.enabled_modules as Record<string, boolean>) || {},
          'education'
        );
        meta.entity_kind = 'government_education';
        await supabase
          .from('profiles')
          .update({
            org_type: 'government_education',
            business_type: 'government_education',
            trading_name: name,
            metadata: meta,
          })
          .eq('id', companyId);
      } catch {
        /* soft */
      }
      return NextResponse.json({
        success: true,
        agency: data,
        programme: 'education',
        pending_activation: status === 'pending',
        message:
          status === 'pending'
            ? GOV_PENDING_MESSAGE
            : 'Department registered and active',
      });
    }

    // Platform activation of a government education department
    if (action === 'approve_agency' || action === 'activate_agency') {
      const {
        isPlatformOperatorUserId,
        clampGovernmentModules,
      } = await import('@/lib/system/platform-control');
      if (!(await isPlatformOperatorUserId(gate.userId))) {
        return NextResponse.json(
          {
            error:
              'Department activation requires platform authorisation.',
            code: 'PLATFORM_CONTROL',
          },
          { status: 403 }
        );
      }
      const targetId = Number(body.target_company_id || body.agency_profile_id || companyId);
      if (!Number.isFinite(targetId)) {
        return NextResponse.json(
          { error: 'target_company_id required' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('nsnp_agency_profiles')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', targetId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      try {
        const { cloneNationalIntoAgency } = await import(
          '@/lib/schools/approved-catalogue'
        );
        await cloneNationalIntoAgency(supabase, targetId);
      } catch {
        /* soft */
      }
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', targetId)
          .maybeSingle();
        const meta =
          prof?.metadata && typeof prof.metadata === 'object'
            ? { ...(prof.metadata as Record<string, unknown>) }
            : {};
        meta.enabled_modules = clampGovernmentModules(
          (meta.enabled_modules as Record<string, boolean>) || {},
          'education'
        );
        await supabase
          .from('profiles')
          .update({ metadata: meta })
          .eq('id', targetId);
      } catch {
        /* soft */
      }
      return NextResponse.json({
        success: true,
        agency: data,
        message: 'Department activated',
      });
    }

    // Update DBE / PEU profile fields
    if (action === 'update_agency') {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      for (const k of [
        'agency_name',
        'agency_type',
        'province',
        'district',
        'contact_name',
        'contact_email',
        'contact_phone',
        'description',
        'about',
        'meal_tariff_zar',
        'meal_tariff_lunch_zar',
        'meal_tariff_breakfast_zar',
        'claims_locked',
      ]) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      const { data, error } = await supabase
        .from('nsnp_agency_profiles')
        .update(patch)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, agency: data });
    }

    // School joins agency
    if (action === 'join' || action === 'link') {
      const agencyProfileId = Number(body.agency_profile_id);
      if (!Number.isFinite(agencyProfileId)) {
        return NextResponse.json(
          { error: 'agency_profile_id required' },
          { status: 400 }
        );
      }
      const { school, error } = await getOrCreateSchoolProfile(
        supabase,
        companyId
      );
      if (error || !school) {
        return NextResponse.json(
          { error: error || 'No school profile' },
          { status: 503 }
        );
      }

      const { data: agency } = await supabase
        .from('nsnp_agency_profiles')
        .select('id, status, agency_name, agency_type')
        .eq('profile_id', agencyProfileId)
        .maybeSingle();
      if (!agency || agency.status !== 'active') {
        return NextResponse.json(
          { error: 'Agency not found or inactive' },
          { status: 404 }
        );
      }

      const memberType = String(
        school.member_type || body.member_type || 'school'
      );
      const {
        facilityMayJoinAgency,
        programmeHierarchyBlurb,
      } = await import('@/lib/entities/programme-hierarchy');
      const may = facilityMayJoinAgency(memberType, agency.agency_type);
      if (!may.ok) {
        return NextResponse.json(
          { error: may.reason || 'Wrong programme family for this facility' },
          { status: 400 }
        );
      }
      const hierarchy = programmeHierarchyBlurb(agency.agency_type);

      // Facilities may only REQUEST association — agency must approve.
      // Never honour client-supplied status=active (governance lock).
      const linkPayload: Record<string, unknown> = {
        school_profile_id: school.id,
        school_company_id: companyId,
        agency_profile_id: agencyProfileId,
        status: 'pending',
        requested_by: gate.userId || null,
        accepted_at: null,
        notes: body.notes || null,
        updated_at: new Date().toISOString(),
      };
      // Soft: member_type on link when column exists
      linkPayload.member_type = memberType;

      let { data, error: lErr } = await supabase
        .from('school_agency_links')
        .upsert(linkPayload, {
          onConflict: 'school_profile_id,agency_profile_id',
        })
        .select('*')
        .single();

      if (lErr && /member_type|column/i.test(lErr.message || '')) {
        delete linkPayload.member_type;
        const retry = await supabase
          .from('school_agency_links')
          .upsert(linkPayload, {
            onConflict: 'school_profile_id,agency_profile_id',
          })
          .select('*')
          .single();
        data = retry.data;
        lErr = retry.error;
      }

      if (lErr) {
        return NextResponse.json({ error: lErr.message }, { status: 400 });
      }

      // primary_agency_profile_id is set only when agency approves (see approve)

      return NextResponse.json({
        success: true,
        link: data,
        agency_name: agency.agency_name,
        hierarchy: hierarchy.chain,
        message: `Join request submitted to ${agency.agency_name}. They must approve before catalogue & claims unlock (${hierarchy.chain.join(' → ')}).`,
      });
    }

    // Leave agency
    if (action === 'leave') {
      const agencyProfileId = Number(body.agency_profile_id);
      const { school } = await getOrCreateSchoolProfile(supabase, companyId);
      if (!school) {
        return NextResponse.json({ error: 'No school' }, { status: 503 });
      }
      const { error } = await supabase
        .from('school_agency_links')
        .update({
          status: 'left',
          updated_at: new Date().toISOString(),
        })
        .eq('school_profile_id', school.id)
        .eq('agency_profile_id', agencyProfileId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // Agency accepts / suspends / rejects school
    if (
      action === 'set_link_status' ||
      action === 'approve' ||
      action === 'suspend' ||
      action === 'reject'
    ) {
      const linkId = Number(body.link_id);
      let status = String(body.status || 'active');
      if (action === 'approve') status = 'active';
      if (action === 'suspend') status = 'suspended';
      if (action === 'reject') status = 'left';
      const patch: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === 'active') {
        patch.accepted_at = new Date().toISOString();
      }
      let q = supabase
        .from('school_agency_links')
        .update(patch)
        .eq('agency_profile_id', companyId);
      if (Number.isFinite(linkId)) {
        q = q.eq('id', linkId);
      } else if (body.school_profile_id) {
        q = q.eq('school_profile_id', Number(body.school_profile_id));
      } else {
        return NextResponse.json(
          { error: 'link_id or school_profile_id required' },
          { status: 400 }
        );
      }
      const { data: updated, error } = await q.select('*');
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // On approve: set primary agency on the school (catalogue authority)
      if (status === 'active' && updated?.[0]) {
        const schoolProfileId = Number(updated[0].school_profile_id);
        try {
          await supabase
            .from('school_profiles')
            .update({
              primary_agency_profile_id: companyId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', schoolProfileId);
        } catch {
          /* soft */
        }
      }

      return NextResponse.json({ success: true, status, link: updated?.[0] });
    }

    // Agency approves SP association request (preferred) or sets global status
    if (
      action === 'set_isp_status' ||
      action === 'approve_isp' ||
      action === 'suspend_isp' ||
      action === 'reject_isp' ||
      action === 'set_isp_link_status' ||
      action === 'approve_isp_link'
    ) {
      const { data: agencyGate } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_name, agency_type, status')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!agencyGate || agencyGate.status !== 'active') {
        return NextResponse.json(
          {
            error:
              'Only a registered DBE / PEU agency can approve or suspend SPs',
          },
          { status: 403 }
        );
      }

      const now = new Date().toISOString();
      const linkId = body.link_id != null ? Number(body.link_id) : null;
      let ispProfileId = Number(body.isp_profile_id);

      // Resolve from association link when provided
      let linkRow: Record<string, unknown> | null = null;
      if (linkId && Number.isFinite(linkId)) {
        const { data: lr } = await supabase
          .from('nsnp_isp_agency_links')
          .select('*')
          .eq('id', linkId)
          .eq('agency_profile_id', companyId)
          .maybeSingle();
        linkRow = lr;
        if (lr) ispProfileId = Number(lr.isp_profile_id);
      }

      if (!Number.isFinite(ispProfileId)) {
        return NextResponse.json(
          { error: 'isp_profile_id or link_id required' },
          { status: 400 }
        );
      }

      let linkStatus = String(body.status || 'active');
      if (
        action === 'approve_isp' ||
        action === 'approve_isp_link'
      ) {
        linkStatus = 'active';
      }
      if (action === 'suspend_isp') linkStatus = 'suspended';
      if (action === 'reject_isp') linkStatus = 'rejected';

      // Update association link (create if only isp_profile_id given)
      const linkPatch: Record<string, unknown> = {
        status: linkStatus,
        updated_at: now,
        reviewed_by: gate.userId || null,
      };
      if (linkStatus === 'active') {
        linkPatch.accepted_at = now;
        linkPatch.rejection_reason = null;
      }
      if (linkStatus === 'rejected' || linkStatus === 'suspended') {
        linkPatch.rejection_reason =
          body.reason || body.notes || body.rejection_reason || null;
      }

      let linkOut: Record<string, unknown> | null = linkRow;
      if (linkRow) {
        const { data: updatedLink, error: uErr } = await supabase
          .from('nsnp_isp_agency_links')
          .update(linkPatch)
          .eq('id', linkRow.id)
          .eq('agency_profile_id', companyId)
          .select('*')
          .single();
        if (uErr) {
          return NextResponse.json({ error: uErr.message }, { status: 400 });
        }
        linkOut = updatedLink;
      } else {
        const { data: upserted, error: upErr } = await supabase
          .from('nsnp_isp_agency_links')
          .upsert(
            {
              isp_profile_id: ispProfileId,
              agency_profile_id: companyId,
              ...linkPatch,
              requested_at: now,
            },
            { onConflict: 'isp_profile_id,agency_profile_id' }
          )
          .select('*')
          .single();
        if (upErr) {
          return NextResponse.json({ error: upErr.message }, { status: 400 });
        }
        linkOut = upserted;
      }

      // Mirror global compliance for programme gates
      const compliance =
        linkStatus === 'active'
          ? 'compliant'
          : linkStatus === 'suspended'
            ? 'suspended'
            : linkStatus === 'rejected'
              ? 'revoked'
              : 'pending';

      const ispPatch: Record<string, unknown> = {
        compliance_status: compliance,
        updated_at: now,
      };
      if (compliance === 'compliant') {
        ispPatch.approved_by_agency_profile_id = companyId;
        ispPatch.approved_at = now;
        ispPatch.approved_by_user_id = gate.userId || null;
        ispPatch.rejection_reason = null;
        ispPatch.suspended_at = null;
      } else if (compliance === 'suspended' || compliance === 'revoked') {
        ispPatch.suspended_at = now;
        ispPatch.suspension_reason =
          body.reason || body.notes || body.rejection_reason || null;
      }

      let { data: ispData, error: ispErr } = await supabase
        .from('nsnp_isp_profiles')
        .update(ispPatch)
        .eq('profile_id', ispProfileId)
        .select('*')
        .single();
      if (ispErr && /column|schema cache/i.test(ispErr.message || '')) {
        const retry = await supabase
          .from('nsnp_isp_profiles')
          .update({ compliance_status: compliance, updated_at: now })
          .eq('profile_id', ispProfileId)
          .select('*')
          .single();
        ispData = retry.data;
        ispErr = retry.error;
      }
      if (ispErr) {
        return NextResponse.json({ error: ispErr.message }, { status: 400 });
      }

      try {
        await supabase.from('nsnp_activity_events').insert({
          company_id: companyId,
          target_company_id: ispProfileId,
          kind: `isp_link_${linkStatus}`,
          title:
            linkStatus === 'active'
              ? `Approved by ${agencyGate.agency_name || 'department'}`
              : linkStatus === 'rejected'
                ? 'Department rejected your join request'
                : `SP association ${linkStatus}`,
          body: String(
            body.reason ||
              `Your association with ${agencyGate.agency_name} is now ${linkStatus}`
          ),
          href: '/dashboard/schools/isps',
          metadata: {
            agency_profile_id: companyId,
            link_status: linkStatus,
            compliance_status: compliance,
          },
        });
      } catch {
        /* soft */
      }

      return NextResponse.json({
        success: true,
        link: linkOut,
        isp: ispData,
        approved_by: agencyGate.agency_name,
        compliance_status: compliance,
        link_status: linkStatus,
      });
    }

    // Directory of all schools & SPs already on the platform (fast add)
    if (action === 'list_candidates') {
      const { data: agencyGate } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_name, agency_type')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!agencyGate) {
        return NextResponse.json(
          { error: 'Only a registered DBE / PEU department can list candidates' },
          { status: 403 }
        );
      }
      if (
        familyForAgencyType(String(agencyGate.agency_type || 'dbe')) ===
        'health'
      ) {
        return NextResponse.json(
          {
            error: 'Schools module is for schools only (not other facility types)',
            redirect: '/dashboard/schools/join',
          },
          { status: 403 }
        );
      }

      const q = String(body.q || body.query || '')
        .trim()
        .toLowerCase();
      const limit = Math.min(
        500,
        Math.max(20, Number(body.limit) || 120)
      );
      const availableOnly = body.available_only !== false;

      // Existing links (for available_only + already-linked badges)
      const schoolLinkBySid = new Map<
        number,
        { status: string; link_id: number }
      >();
      const existingLinks = await fetchAgencySchoolLinks(supabase, companyId, [
        'pending',
        'active',
        'suspended',
      ]);
      for (const l of existingLinks) {
        schoolLinkBySid.set(Number(l.school_profile_id), {
          status: String(l.status),
          link_id: Number(l.id),
        });
      }

      let schoolRows: Array<Record<string, unknown>> = [];

      // Search path: scan school_profiles (may be large) then filter
      // Default path without q: skip full 5k scan — use profile directory only
      if (q) {
        const schoolRowsRaw = await fetchAllPaged(
          supabase,
          'school_profiles',
          'id, profile_id, school_name, emis_number, natemis, province, district, member_type, status, learner_count_enrolled',
          (qB) => qB.order('school_name', { ascending: true })
        );
        schoolRows = schoolRowsRaw.filter((s) => {
          const mt = String(s.member_type || 'school');
          if (['hospital', 'clinic', 'shelter'].includes(mt)) return false;
          const hay = [
            s.school_name,
            s.emis_number,
            s.natemis,
            s.district,
            s.province,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        });
        if (availableOnly) {
          schoolRows = schoolRows.filter(
            (s) => !schoolLinkBySid.has(Number(s.id))
          );
        }
        schoolRows = schoolRows.slice(0, limit);
      }

      const schoolCompanyIds = [
        ...new Set(
          schoolRows
            .map((s) => Number(s.profile_id))
            .filter((n) => Number.isFinite(n) && n > 0 && n !== companyId)
        ),
      ];

      // Profiles typed as school without school_profiles yet
      const { data: schoolishProfiles } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, org_type, business_type, city, province')
        .or(
          'org_type.eq.school,business_type.eq.school,business_type.ilike.%school%'
        )
        .limit(150);

      // SPs on system
      const { data: ispRows } = await supabase
        .from('nsnp_isp_profiles')
        .select(
          'profile_id, trading_name, compliance_status, provinces, food_handling_cert'
        )
        .order('trading_name')
        .limit(500);

      const ispIds = [
        ...new Set(
          (ispRows || [])
            .map((i) => Number(i.profile_id))
            .filter((n) => Number.isFinite(n) && n > 0 && n !== companyId)
        ),
      ];

      const { data: spishProfiles } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, org_type, business_type, city, province')
        .or(
          'org_type.eq.nsnp_isp,business_type.eq.nsnp_isp,business_type.ilike.%service provider%,business_type.ilike.%isp%'
        )
        .limit(300);

      // Names for school companies
      const allCompanyIds = [
        ...new Set([
          ...schoolCompanyIds,
          ...ispIds,
          ...(schoolishProfiles || []).map((p) => Number(p.id)),
          ...(spishProfiles || []).map((p) => Number(p.id)),
        ]),
      ].filter((n) => n !== companyId);

      const nameById: Record<
        number,
        { trading_name?: string; legal_name?: string; city?: string; province?: string; org_type?: string; business_type?: string }
      > = {};
      for (let i = 0; i < allCompanyIds.length; i += 100) {
        const chunk = allCompanyIds.slice(i, i + 100);
        const { data: profs } = await supabase
          .from('profiles')
          .select(
            'id, trading_name, legal_name, city, province, org_type, business_type'
          )
          .in('id', chunk);
        for (const p of profs || []) {
          nameById[Number(p.id)] = p as (typeof nameById)[number];
        }
      }

      const ispLinkById = new Map<
        number,
        { status: string; link_id: number }
      >();
      if (ispIds.length) {
        const { data: il } = await supabase
          .from('nsnp_isp_agency_links')
          .select('id, isp_profile_id, status')
          .eq('agency_profile_id', companyId)
          .in('isp_profile_id', ispIds)
          .in('status', ['pending', 'active', 'suspended', 'rejected']);
        for (const l of il || []) {
          ispLinkById.set(Number(l.isp_profile_id), {
            status: String(l.status),
            link_id: Number(l.id),
          });
        }
      }

      const schoolsOnSystem = schoolRows
        .filter((s) => Number(s.profile_id) !== companyId)
        .map((s) => {
          const cid = Number(s.profile_id);
          const prof = nameById[cid] || {};
          const link = schoolLinkBySid.get(Number(s.id));
          return {
            company_id: cid || 0,
            school_profile_id: Number(s.id),
            name:
              String(s.school_name || '') ||
              prof.trading_name ||
              prof.legal_name ||
              `School ${s.id}`,
            emis: s.emis_number || s.natemis || null,
            province: s.province || prof.province || null,
            district: s.district || null,
            city: prof.city || null,
            member_type: s.member_type || 'school',
            learners: s.learner_count_enrolled,
            link_status: link?.status || null,
            link_id: link?.link_id || null,
            already_linked: Boolean(
              link && ['pending', 'active', 'suspended'].includes(link.status)
            ),
          };
        });

      // Profiles typed school without school_profiles row
      const schoolProfileSet = new Set(schoolCompanyIds);
      for (const p of schoolishProfiles || []) {
        const cid = Number(p.id);
        if (cid === companyId || schoolProfileSet.has(cid)) continue;
        schoolProfileSet.add(cid);
        schoolsOnSystem.push({
          company_id: cid,
          school_profile_id: 0,
          name: p.trading_name || p.legal_name || `Company ${cid}`,
          emis: null,
          province: p.province || null,
          district: null,
          city: p.city || null,
          member_type: 'school',
          learners: null,
          link_status: null,
          link_id: null,
          already_linked: false,
        });
      }

      const spsOnSystem = (ispRows || [])
        .filter((i) => Number(i.profile_id) !== companyId)
        .map((i) => {
          const cid = Number(i.profile_id);
          const prof = nameById[cid] || {};
          const link = ispLinkById.get(cid);
          return {
            company_id: cid,
            name:
              i.trading_name ||
              prof.trading_name ||
              prof.legal_name ||
              `SP ${cid}`,
            province:
              Array.isArray(i.provinces) && i.provinces.length
                ? (i.provinces as string[]).join(', ')
                : prof.province || null,
            city: prof.city || null,
            compliance_status: i.compliance_status,
            food_handling_cert: i.food_handling_cert,
            link_status: link?.status || null,
            link_id: link?.link_id || null,
            already_linked: Boolean(
              link && ['pending', 'active'].includes(link.status)
            ),
          };
        });

      const ispSet = new Set(ispIds);
      for (const p of spishProfiles || []) {
        const cid = Number(p.id);
        if (cid === companyId || ispSet.has(cid)) continue;
        ispSet.add(cid);
        spsOnSystem.push({
          company_id: cid,
          name: p.trading_name || p.legal_name || `Company ${cid}`,
          province: p.province || null,
          city: p.city || null,
          compliance_status: null,
          food_handling_cert: null,
          link_status: null,
          link_id: null,
          already_linked: false,
        });
      }

      schoolsOnSystem.sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      );
      spsOnSystem.sort((a, b) => String(a.name).localeCompare(String(b.name)));

      return NextResponse.json({
        success: true,
        schools_on_system: schoolsOnSystem,
        sps_on_system: spsOnSystem,
        summary: {
          schools_total: schoolsOnSystem.length,
          schools_available: schoolsOnSystem.filter((s) => !s.already_linked)
            .length,
          sps_total: spsOnSystem.length,
          sps_available: spsOnSystem.filter((s) => !s.already_linked).length,
        },
      });
    }

    // Agency searches companies to add as school or SP
    if (action === 'search_companies') {
      const q = String(body.q || body.query || '')
        .trim()
        .replace(/[%_,]/g, ' ')
        .slice(0, 80);
      if (q.length < 2) {
        return NextResponse.json({
          success: true,
          companies: [],
          message: 'Type at least 2 characters',
        });
      }
      const { data: agencyGate } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!agencyGate) {
        return NextResponse.json(
          { error: 'Only a registered department can search' },
          { status: 403 }
        );
      }
      let companies: Array<Record<string, unknown>> = [];
      const asId = Number(q);
      if (Number.isFinite(asId) && asId > 0 && !/\s/.test(q)) {
        const { data } = await supabase
          .from('profiles')
          .select(
            'id, trading_name, legal_name, org_type, business_type, city, province'
          )
          .eq('id', asId)
          .limit(1);
        companies = (data || []) as Array<Record<string, unknown>>;
      } else {
        const { data } = await supabase
          .from('profiles')
          .select(
            'id, trading_name, legal_name, org_type, business_type, city, province'
          )
          .or(`trading_name.ilike.%${q}%,legal_name.ilike.%${q}%`)
          .limit(25);
        companies = (data || []) as Array<Record<string, unknown>>;
      }
      // Mark already linked
      const ids = companies.map((c) => Number(c.id));
      const schoolLinked = new Set<number>();
      const ispLinked = new Set<number>();
      if (ids.length) {
        const { data: schools } = await supabase
          .from('school_profiles')
          .select('id, profile_id')
          .in('profile_id', ids);
        const schoolByCompany = new Map(
          (schools || []).map((s) => [Number(s.profile_id), Number(s.id)])
        );
        const schoolProfileIds = [...schoolByCompany.values()];
        if (schoolProfileIds.length) {
          const { data: sl } = await supabase
            .from('school_agency_links')
            .select('school_profile_id, status')
            .eq('agency_profile_id', companyId)
            .in('school_profile_id', schoolProfileIds)
            .in('status', ['pending', 'active']);
          for (const l of sl || []) {
            for (const [cid, sid] of schoolByCompany) {
              if (sid === Number(l.school_profile_id)) schoolLinked.add(cid);
            }
          }
        }
        const { data: il } = await supabase
          .from('nsnp_isp_agency_links')
          .select('isp_profile_id, status')
          .eq('agency_profile_id', companyId)
          .in('isp_profile_id', ids)
          .in('status', ['pending', 'active']);
        for (const l of il || []) {
          ispLinked.add(Number(l.isp_profile_id));
        }
      }
      return NextResponse.json({
        success: true,
        companies: companies.map((c) => ({
          ...c,
          already_school: schoolLinked.has(Number(c.id)),
          already_sp: ispLinked.has(Number(c.id)),
        })),
      });
    }

    // Department creates a brand-new school company + link
    if (action === 'create_school') {
      const { data: agencyGate } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_name, status, agency_type')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!agencyGate || agencyGate.status !== 'active') {
        return NextResponse.json(
          { error: 'Only a registered DBE / PEU can create schools' },
          { status: 403 }
        );
      }
      if (
        familyForAgencyType(String(agencyGate.agency_type || 'dbe')) ===
        'health'
      ) {
        return NextResponse.json(
          { error: 'Schools module is for schools only' },
          { status: 403 }
        );
      }
      const name = String(body.school_name || body.name || '').trim();
      if (name.length < 2) {
        return NextResponse.json(
          { error: 'school_name required' },
          { status: 400 }
        );
      }
      const now = new Date().toISOString();
      const approveNow = body.approve !== false;
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .insert({
          trading_name: name,
          legal_name: name,
          org_type: 'school',
          business_type: 'school',
          industry: 'Public schools',
          industries: ['Public schools'],
          province: body.province || null,
          city: body.city || body.district || null,
          country: 'South Africa',
          continent: 'Africa',
          planet: 'Earth',
          status: 'active',
          created_at: now,
          updated_at: now,
          metadata: {
            entity_kind: 'school',
            dbe_created: true,
            dbe_agency_profile_id: companyId,
            enabled_modules: {
              schools: true,
              home: true,
              guide: true,
              network: true,
            },
          },
        })
        .select('id')
        .single();
      if (pErr || !prof) {
        return NextResponse.json(
          { error: pErr?.message || 'Could not create school company' },
          { status: 400 }
        );
      }
      const targetCompanyId = Number(prof.id);
      const { school, error: sErr } = await getOrCreateSchoolProfile(
        supabase,
        targetCompanyId
      );
      if (sErr || !school) {
        return NextResponse.json(
          { error: sErr || 'School profile failed' },
          { status: 400 }
        );
      }
      await supabase
        .from('school_profiles')
        .update({
          school_name: name,
          emis_number: body.emis_number || body.natemis || null,
          natemis: body.natemis || body.emis_number || null,
          province: body.province || null,
          district: body.district || null,
          member_type: 'school',
          primary_agency_profile_id: approveNow ? companyId : null,
          status: 'active',
          updated_at: now,
        })
        .eq('id', school.id);
      const status = approveNow ? 'active' : 'pending';
      const { data: link, error: lErr } = await supabase
        .from('school_agency_links')
        .upsert(
          {
            school_profile_id: school.id,
            school_company_id: targetCompanyId,
            agency_profile_id: companyId,
            status,
            accepted_at: approveNow ? now : null,
            notes: 'Created by DBE on Join hub',
            updated_at: now,
          },
          { onConflict: 'school_profile_id,agency_profile_id' }
        )
        .select('*')
        .single();
      if (lErr) {
        return NextResponse.json({ error: lErr.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        company_id: targetCompanyId,
        school,
        link,
        message: approveNow
          ? `School “${name}” created and approved under ${agencyGate.agency_name}`
          : `School “${name}” created as pending`,
      });
    }

    // Department creates a brand-new SP company + link
    if (action === 'create_sp' || action === 'create_isp') {
      const { data: agencyGate } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_name, status, agency_type')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!agencyGate || agencyGate.status !== 'active') {
        return NextResponse.json(
          { error: 'Only a registered DBE / PEU can create SPs' },
          { status: 403 }
        );
      }
      const name = String(body.trading_name || body.name || '').trim();
      if (name.length < 2) {
        return NextResponse.json(
          { error: 'SP name required' },
          { status: 400 }
        );
      }
      const now = new Date().toISOString();
      const approveNow = body.approve !== false;
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .insert({
          trading_name: name,
          legal_name: name,
          org_type: 'nsnp_isp',
          business_type: 'nsnp_isp',
          province: body.province || null,
          country: 'South Africa',
          continent: 'Africa',
          planet: 'Earth',
          status: 'active',
          created_at: now,
          updated_at: now,
          metadata: {
            entity_kind: 'sp',
            dbe_created: true,
            enabled_modules: {
              schools: true,
              suppliers: true,
              inventory: true,
              network: true,
              home: true,
              guide: true,
            },
          },
        })
        .select('id')
        .single();
      if (pErr || !prof) {
        return NextResponse.json(
          { error: pErr?.message || 'Could not create SP company' },
          { status: 400 }
        );
      }
      const targetCompanyId = Number(prof.id);
      await supabase.from('nsnp_isp_profiles').upsert(
        {
          profile_id: targetCompanyId,
          trading_name: name,
          compliance_status: approveNow ? 'compliant' : 'pending',
          food_handling_cert: true,
          provinces: body.province ? [body.province] : [],
          updated_at: now,
        },
        { onConflict: 'profile_id' }
      );
      const linkStatus = approveNow ? 'active' : 'pending';
      const { data: link, error: lErr } = await supabase
        .from('nsnp_isp_agency_links')
        .upsert(
          {
            isp_profile_id: targetCompanyId,
            agency_profile_id: companyId,
            status: linkStatus,
            accepted_at: approveNow ? now : null,
            notes: 'Created by DBE on Join hub',
            updated_at: now,
          },
          { onConflict: 'isp_profile_id,agency_profile_id' }
        )
        .select('*')
        .single();
      if (lErr) {
        // Soft: link table may use different conflict
        await supabase.from('nsnp_isp_agency_links').insert({
          isp_profile_id: targetCompanyId,
          agency_profile_id: companyId,
          status: linkStatus,
          updated_at: now,
        });
      }
      if (approveNow) {
        await supabase
          .from('nsnp_isp_profiles')
          .update({
            approved_by_agency_profile_id: companyId,
            approved_at: now,
            compliance_status: 'compliant',
            updated_at: now,
          })
          .eq('profile_id', targetCompanyId);
      }
      return NextResponse.json({
        success: true,
        company_id: targetCompanyId,
        link,
        message: approveNow
          ? `SP “${name}” created and approved under ${agencyGate.agency_name}`
          : `SP “${name}” created as pending`,
      });
    }

    // Department adds a school (by company id) — optional instant approve
    if (action === 'add_school' || action === 'invite_school') {
      const { data: agencyGate } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_name, status, agency_type')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!agencyGate || agencyGate.status !== 'active') {
        return NextResponse.json(
          { error: 'Only a registered DBE / PEU can add schools' },
          { status: 403 }
        );
      }
      // Add by school_profile_id (registry school) when company id not given
      const schoolProfileId = Number(body.school_profile_id || 0);
      let targetCompanyId = Number(
        body.school_company_id || body.target_company_id || body.company_id
      );

      if (
        (!Number.isFinite(targetCompanyId) || targetCompanyId === companyId) &&
        Number.isFinite(schoolProfileId) &&
        schoolProfileId > 0
      ) {
        const { data: spRow } = await supabase
          .from('school_profiles')
          .select('id, profile_id, school_name')
          .eq('id', schoolProfileId)
          .maybeSingle();
        if (!spRow) {
          return NextResponse.json(
            { error: 'School not found' },
            { status: 404 }
          );
        }
        targetCompanyId =
          spRow.profile_id != null ? Number(spRow.profile_id) : NaN;
        if (!Number.isFinite(targetCompanyId)) {
          return NextResponse.json(
            {
              error:
                'School has no company workspace yet — use Create school or Import.',
            },
            { status: 400 }
          );
        }
      }

      if (!Number.isFinite(targetCompanyId) || targetCompanyId === companyId) {
        return NextResponse.json(
          { error: 'school_company_id or school_profile_id required' },
          { status: 400 }
        );
      }
      const { school, error: sErr } = await getOrCreateSchoolProfile(
        supabase,
        targetCompanyId
      );
      if (sErr || !school) {
        return NextResponse.json(
          { error: sErr || 'Could not create school profile for that company' },
          { status: 400 }
        );
      }
      // Align identity as school
      try {
        await supabase
          .from('profiles')
          .update({
            org_type: 'school',
            business_type: 'school',
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetCompanyId);
        await supabase
          .from('school_profiles')
          .update({
            member_type: 'school',
            school_name:
              body.school_name ||
              school.school_name ||
              `School ${targetCompanyId}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', school.id);
      } catch {
        /* soft */
      }

      const approveNow = body.approve === true || body.status === 'active';
      const status = approveNow ? 'active' : 'pending';
      const now = new Date().toISOString();
      const { data: link, error: lErr } = await supabase
        .from('school_agency_links')
        .upsert(
          {
            school_profile_id: school.id,
            school_company_id: targetCompanyId,
            agency_profile_id: companyId,
            status,
            requested_by: gate.userId || null,
            accepted_at: approveNow ? now : null,
            notes: body.notes || 'Added by department',
            updated_at: now,
          },
          { onConflict: 'school_profile_id,agency_profile_id' }
        )
        .select('*')
        .single();
      if (lErr) {
        return NextResponse.json({ error: lErr.message }, { status: 400 });
      }
      if (approveNow) {
        try {
          await supabase
            .from('school_profiles')
            .update({
              primary_agency_profile_id: companyId,
              updated_at: now,
            })
            .eq('id', school.id);
        } catch {
          /* soft */
        }
      }
      return NextResponse.json({
        success: true,
        link,
        school,
        message: approveNow
          ? `School added and approved under ${agencyGate.agency_name}`
          : `School added as pending — approve when ready`,
      });
    }

    // Department adds an SP (by company id) — optional instant approve
    if (action === 'add_isp' || action === 'add_sp' || action === 'invite_isp') {
      const { data: agencyGate } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_name, status')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!agencyGate || agencyGate.status !== 'active') {
        return NextResponse.json(
          { error: 'Only a registered DBE/PEU can add SPs' },
          { status: 403 }
        );
      }
      const targetCompanyId = Number(
        body.isp_profile_id ||
          body.sp_company_id ||
          body.target_company_id ||
          body.company_id
      );
      if (!Number.isFinite(targetCompanyId) || targetCompanyId === companyId) {
        return NextResponse.json(
          { error: 'sp company id required (another company)' },
          { status: 400 }
        );
      }

      const { data: targetProf } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name')
        .eq('id', targetCompanyId)
        .maybeSingle();
      if (!targetProf) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }

      const tradingName =
        body.trading_name ||
        targetProf.trading_name ||
        targetProf.legal_name ||
        `SP ${targetCompanyId}`;

      await supabase.from('nsnp_isp_profiles').upsert(
        {
          profile_id: targetCompanyId,
          trading_name: tradingName,
          compliance_status: 'pending',
          food_handling_cert: Boolean(body.food_handling_cert),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      );
      try {
        await supabase
          .from('profiles')
          .update({
            org_type: 'nsnp_isp',
            business_type: 'nsnp_isp',
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetCompanyId);
      } catch {
        /* soft */
      }

      const approveNow = body.approve === true || body.status === 'active';
      const status = approveNow ? 'active' : 'pending';
      const now = new Date().toISOString();
      const linkPatch: Record<string, unknown> = {
        isp_profile_id: targetCompanyId,
        agency_profile_id: companyId,
        status,
        requested_by: gate.userId || null,
        requested_at: now,
        updated_at: now,
        notes: body.notes || 'Added by department',
      };
      if (approveNow) {
        linkPatch.accepted_at = now;
        linkPatch.reviewed_by = gate.userId || null;
      }
      const { data: link, error: lErr } = await supabase
        .from('nsnp_isp_agency_links')
        .upsert(linkPatch, {
          onConflict: 'isp_profile_id,agency_profile_id',
        })
        .select('*')
        .single();
      if (lErr) {
        return NextResponse.json({ error: lErr.message }, { status: 400 });
      }
      if (approveNow) {
        await supabase
          .from('nsnp_isp_profiles')
          .update({
            compliance_status: 'compliant',
            approved_by_agency_profile_id: companyId,
            approved_at: now,
            approved_by_user_id: gate.userId || null,
            updated_at: now,
          })
          .eq('profile_id', targetCompanyId);
      }
      return NextResponse.json({
        success: true,
        link,
        message: approveNow
          ? `SP added and approved under ${agencyGate.agency_name}`
          : `SP added as pending — approve when ready`,
      });
    }

    // Agency reviews claim packs — must confirm official DBE email
    if (action === 'set_claim_status' || action === 'review_claim') {
      const claimId = Number(body.claim_id);
      const claimStatus = String(body.status || 'approved');
      if (!Number.isFinite(claimId)) {
        return NextResponse.json({ error: 'claim_id required' }, { status: 400 });
      }
      if (!['approved', 'rejected', 'paid'].includes(claimStatus)) {
        return NextResponse.json(
          {
            error:
              'Use approve, reject, or paid. DBE email confirmation is required.',
          },
          { status: 400 }
        );
      }
      const reviewAction =
        claimStatus === 'approved'
          ? 'approve'
          : claimStatus === 'rejected'
            ? 'reject'
            : 'paid';
      const approverEmail = String(
        body.approver_email || body.email || ''
      )
        .trim()
        .toLowerCase();
      if (!approverEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approverEmail)) {
        return NextResponse.json(
          {
            error:
              'Enter your official DBE email to confirm this claim decision.',
          },
          { status: 400 }
        );
      }
      // Reuse strong review handler in-process
      const reviewReq = new NextRequest(
        new URL('/api/schools/claims/dbe-review', request.url),
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: request.headers.get('cookie') || '',
            authorization: request.headers.get('authorization') || '',
            'x-legacy-privy-user-id':
              request.headers.get('x-legacy-privy-user-id') || '',
          },
          body: JSON.stringify({
            companyId,
            claim_id: claimId,
            action: reviewAction,
            approver_email: approverEmail,
            notes: body.notes || null,
          }),
        }
      );
      const { POST: reviewPost } = await import(
        '@/app/api/schools/claims/dbe-review/route'
      );
      return reviewPost(reviewReq);
    }

    // Lock / unlock a claim period for all schools under this agency
    if (action === 'lock_claim_period' || action === 'unlock_claim_period') {
      const periodFrom = String(body.period_from || body.from || '');
      const periodTo = String(body.period_to || body.to || '');
      if (!periodFrom || !periodTo) {
        return NextResponse.json(
          { error: 'period_from and period_to required' },
          { status: 400 }
        );
      }
      const locked = action === 'lock_claim_period';
      const { data, error } = await supabase
        .from('nsnp_claim_period_locks')
        .upsert(
          {
            agency_profile_id: companyId,
            period_from: periodFrom,
            period_to: periodTo,
            locked,
            locked_at: new Date().toISOString(),
            locked_by: gate.userId || null,
            notes: body.notes || null,
          },
          { onConflict: 'agency_profile_id,period_from,period_to' }
        )
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, lock: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
