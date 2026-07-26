import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

/**
 * DBE / governmental agency:
 * - Register current company as agency (DBE)
 * - School joins agency
 * - Agency lists linked schools + summary scores
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
      const { data: links, error: lErr } = await supabase
        .from('school_agency_links')
        .select('*')
        .eq('agency_profile_id', companyId)
        .in('status', ['active', 'pending', 'suspended'])
        .limit(2000);

      if (lErr && /does not exist|schema cache/i.test(lErr.message)) {
        return NextResponse.json({
          success: true,
          agency: myAgency,
          schools: [],
          warning: lErr.message,
        });
      }
      if (lErr) {
        return NextResponse.json({ error: lErr.message }, { status: 400 });
      }

      const schoolIds = [
        ...new Set(
          (links || [])
            .map((l) => Number(l.school_profile_id))
            .filter((n) => Number.isFinite(n))
        ),
      ];

      let schools: Array<Record<string, unknown>> = [];
      if (schoolIds.length) {
        const { data: rows } = await supabase
          .from('school_profiles')
          .select(
            'id, profile_id, school_name, emis_number, province, district, quintile, learner_count_enrolled, learner_count_verified, learner_count_nsnp_eligible, staff_count, lat, lng, status'
          )
          .in('id', schoolIds);
        schools = (rows || []) as Array<Record<string, unknown>>;
      }

      // Latest prize scores if any
      const schoolIdList = schools.map((s) => Number(s.id));
      let scores: Array<Record<string, unknown>> = [];
      if (schoolIdList.length) {
        const { data: sc } = await supabase
          .from('nsnp_prize_scores')
          .select(
            'school_profile_id, total_score, approved_brand_pct, feeding_completeness_pct, data_quality_pct, computed_at, period_id'
          )
          .in('school_profile_id', schoolIdList)
          .order('computed_at', { ascending: false })
          .limit(500);
        // keep latest per school
        const seen = new Set<number>();
        for (const row of sc || []) {
          const sid = Number(row.school_profile_id);
          if (seen.has(sid)) continue;
          seen.add(sid);
          scores.push(row as Record<string, unknown>);
        }
      }
      const scoreBySchool = new Map(
        scores.map((s) => [Number(s.school_profile_id), s])
      );

      const enriched: Array<Record<string, unknown>> = schools.map((s) => {
        const link = (links || []).find(
          (l) => Number(l.school_profile_id) === Number(s.id)
        );
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

      const summary = {
        schoolCount: enriched.length,
        activeLinks: (links || []).filter((l) => l.status === 'active').length,
        pendingLinks: (links || []).filter((l) => l.status === 'pending')
          .length,
        totalLearners: enriched.reduce(
          (n, s) => n + Number(s.learner_count_enrolled ?? 0),
          0
        ),
        totalVerified: enriched.reduce(
          (n, s) => n + Number(s.learner_count_verified ?? 0),
          0
        ),
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
        summary,
        links: links || [],
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
      agencies: dirRes.data || [],
      isAgency: Boolean(myAgency),
      myAgency: myAgency || null,
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

    // Register this company as DBE / PEU / provincial agency
    if (action === 'register_agency') {
      const name =
        String(body.agency_name || body.name || '').trim() ||
        'Government agency';
      const { data, error } = await supabase
        .from('nsnp_agency_profiles')
        .upsert(
          {
            profile_id: companyId,
            agency_name: name,
            agency_type: body.agency_type || 'dbe',
            province: body.province || null,
            district: body.district || null,
            contact_name: body.contact_name || null,
            contact_email: body.contact_email || null,
            contact_phone: body.contact_phone || null,
            description: body.description || null,
            status: 'active',
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
          .update({
            org_type: 'government',
            trading_name: name,
          })
          .eq('id', companyId);
      } catch {
        /* soft */
      }
      return NextResponse.json({ success: true, agency: data });
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
        .select('id, status, agency_name')
        .eq('profile_id', agencyProfileId)
        .maybeSingle();
      if (!agency || agency.status !== 'active') {
        return NextResponse.json(
          { error: 'Agency not found or inactive' },
          { status: 404 }
        );
      }

      // Schools may only REQUEST association — DBE/agency must approve.
      // Never honour client-supplied status=active (governance lock).
      const { data, error: lErr } = await supabase
        .from('school_agency_links')
        .upsert(
          {
            school_profile_id: school.id,
            school_company_id: companyId,
            agency_profile_id: agencyProfileId,
            status: 'pending',
            requested_by: gate.userId || null,
            accepted_at: null,
            notes: body.notes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'school_profile_id,agency_profile_id' }
        )
        .select('*')
        .single();

      if (lErr) {
        return NextResponse.json({ error: lErr.message }, { status: 400 });
      }

      // primary_agency_profile_id is set only when agency approves (see approve)

      return NextResponse.json({
        success: true,
        link: data,
        agency_name: agency.agency_name,
        message:
          'Join request submitted. Your DBE/PEU must approve before catalogue & claims unlock.',
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

    // Agency approves ISP association request (preferred) or sets global status
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
              'Only a registered DBE / PEU / DoH agency can approve or suspend ISPs',
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
                : `ISP association ${linkStatus}`,
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

    // Agency reviews claim packs (audit trail)
    if (action === 'set_claim_status' || action === 'review_claim') {
      const claimId = Number(body.claim_id);
      const claimStatus = String(body.status || 'approved');
      if (!Number.isFinite(claimId)) {
        return NextResponse.json({ error: 'claim_id required' }, { status: 400 });
      }
      if (!['approved', 'rejected', 'paid', 'submitted', 'draft'].includes(claimStatus)) {
        return NextResponse.json({ error: 'Invalid claim status' }, { status: 400 });
      }
      const { data: existing } = await supabase
        .from('nsnp_claim_packs')
        .select('id, audit_log, profile_id, school_profile_id')
        .eq('id', claimId)
        .eq('agency_profile_id', companyId)
        .maybeSingle();
      const prevLog = Array.isArray(existing?.audit_log)
        ? existing!.audit_log
        : [];
      const auditEntry = {
        at: new Date().toISOString(),
        by: gate.userId || null,
        action: claimStatus,
        note: body.notes || null,
      };
      const { data, error } = await supabase
        .from('nsnp_claim_packs')
        .update({
          status: claimStatus,
          reviewed_at: new Date().toISOString(),
          review_notes: body.notes || null,
          reviewed_by: gate.userId || null,
          audit_log: [...prevLog, auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId)
        .eq('agency_profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        const retry = await supabase
          .from('nsnp_claim_packs')
          .update({ status: claimStatus })
          .eq('id', claimId)
          .eq('agency_profile_id', companyId)
          .select('*')
          .single();
        if (retry.error) {
          return NextResponse.json({ error: retry.error.message }, { status: 400 });
        }
        return NextResponse.json({ success: true, claim: retry.data });
      }
      return NextResponse.json({ success: true, claim: data });
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
