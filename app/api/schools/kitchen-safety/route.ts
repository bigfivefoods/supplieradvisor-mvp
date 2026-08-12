/**
 * School kitchen food safety (R638 / CoA) API.
 * GET  ?companyId=           school passport + audits + risk
 * GET  ?companyId=&view=register  agency kitchen safety register
 * POST { companyId, action: save_passport | self_audit | daily_log | peu_verify | save_policy }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { fetchAgencySchoolLinks } from '@/lib/schools/supabase-page';
import {
  DEFAULT_KITCHEN_POLICY,
  evaluateKitchenRisk,
  emptyKitchenPassport,
  kitchenSafetySummary,
  mergePassport,
  readKitchenPassport,
  readKitchenPolicy,
  readSelfAudits,
  registerRowFromSchool,
  scoreR638,
  writeKitchenToSchoolMeta,
  type KitchenSelfAudit,
  type KitchenSafetyPassport,
  type R638Answer,
  type R638ItemId,
  R638_CHECKLIST,
} from '@/lib/schools/kitchen-safety';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function schoolMeta(school: Record<string, unknown>) {
  return school.metadata && typeof school.metadata === 'object'
    ? { ...(school.metadata as Record<string, unknown>) }
    : {};
}

async function saveSchoolMeta(
  supabase: ReturnType<typeof getSupabaseServer>,
  schoolId: number,
  meta: Record<string, unknown>
) {
  const { error } = await supabase
    .from('school_profiles')
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq('id', schoolId);
  return error;
}

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

    const view = String(sp.get('view') || 'school').toLowerCase();
    const supabase = getSupabaseServer();

    // Agency register
    if (view === 'register' || view === 'agency') {
      const { data: agency } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, metadata')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!agency) {
        return NextResponse.json(
          { error: 'Agency register is for DBE / PEU only' },
          { status: 403 }
        );
      }
      const agencyMeta =
        agency.metadata && typeof agency.metadata === 'object'
          ? (agency.metadata as Record<string, unknown>)
          : {};
      const policy = readKitchenPolicy(agencyMeta);
      const links = await fetchAgencySchoolLinks(supabase, companyId, [
        'active',
        'pending',
      ]).catch(() => []);
      const schoolIds = [
        ...new Set(
          links.map((l) => Number(l.school_profile_id)).filter(Boolean)
        ),
      ];
      const rows = [];
      for (let i = 0; i < schoolIds.length; i += 80) {
        const slice = schoolIds.slice(i, i + 80);
        const { data: schools } = await supabase
          .from('school_profiles')
          .select(
            'id, school_name, emis_number, district, province, metadata, profile_id'
          )
          .in('id', slice)
          .limit(100);
        for (const s of schools || []) {
          rows.push(
            registerRowFromSchool(s as Record<string, unknown>, policy)
          );
        }
      }
      rows.sort((a, b) => {
        const rank = (x: string) =>
          x === 'red' ? 0 : x === 'amber' ? 1 : x === 'green' ? 2 : 3;
        return rank(a.risk_band) - rank(b.risk_band);
      });
      const filter = String(sp.get('filter') || 'all');
      const filtered =
        filter === 'red'
          ? rows.filter((r) => r.risk_band === 'red')
          : filter === 'no_coa'
            ? rows.filter((r) => r.coa_status === 'none')
            : filter === 'expired'
              ? rows.filter((r) => r.coa_status === 'expired')
              : filter === 'amber'
                ? rows.filter((r) => r.risk_band === 'amber')
                : rows;

      return NextResponse.json({
        success: true,
        role: 'agency',
        policy,
        checklist: R638_CHECKLIST,
        summary: kitchenSafetySummary(rows),
        rows: filtered,
        total: rows.length,
      });
    }

    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const meta = schoolMeta(school as Record<string, unknown>);
    const passport = readKitchenPassport(meta);
    const audits = readSelfAudits(meta);
    // Agency policy if linked
    let policy = DEFAULT_KITCHEN_POLICY;
    try {
      const { data: link } = await supabase
        .from('school_agency_links')
        .select('agency_profile_id')
        .eq('school_profile_id', school.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (link?.agency_profile_id) {
        const { data: ag } = await supabase
          .from('nsnp_agency_profiles')
          .select('metadata')
          .eq('profile_id', link.agency_profile_id)
          .maybeSingle();
        if (ag?.metadata && typeof ag.metadata === 'object') {
          policy = readKitchenPolicy(ag.metadata as Record<string, unknown>);
        }
      }
    } catch {
      /* soft */
    }
    const risk = evaluateKitchenRisk(passport, { policy });

    return NextResponse.json({
      success: true,
      role: 'school',
      school: {
        id: school.id,
        school_name: school.school_name,
        emis_number: school.emis_number,
      },
      passport,
      risk,
      policy,
      audits: audits.slice(0, 12),
      checklist: R638_CHECKLIST,
    });
  } catch (e: unknown) {
    console.error('[kitchen-safety GET]', e);
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

    const action = String(body.action || 'save_passport');
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    if (action === 'save_policy') {
      const { data: agency } = await supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, metadata')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!agency) {
        return NextResponse.json({ error: 'Agency only' }, { status: 403 });
      }
      const meta =
        agency.metadata && typeof agency.metadata === 'object'
          ? { ...(agency.metadata as Record<string, unknown>) }
          : {};
      const prev = readKitchenPolicy(meta);
      const policy = {
        claim_gate:
          body.claim_gate === 'hard' ? ('hard' as const) : ('soft' as const),
        coa_grace_days:
          body.coa_grace_days != null
            ? Number(body.coa_grace_days)
            : prev.coa_grace_days,
        peu_verify_months:
          body.peu_verify_months != null
            ? Number(body.peu_verify_months)
            : prev.peu_verify_months,
        self_audit_max_days:
          body.self_audit_max_days != null
            ? Number(body.self_audit_max_days)
            : prev.self_audit_max_days,
      };
      meta.kitchen_safety_policy = policy;
      await supabase
        .from('nsnp_agency_profiles')
        .update({ metadata: meta, updated_at: now })
        .eq('profile_id', companyId);
      return NextResponse.json({ success: true, policy });
    }

    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);
    const meta = schoolMeta(school as Record<string, unknown>);
    let passport = readKitchenPassport(meta);
    let audits = readSelfAudits(meta);

    if (action === 'save_passport') {
      const patch = (body.passport || body) as Partial<KitchenSafetyPassport>;
      passport = mergePassport(passport, {
        coa_status: patch.coa_status || passport.coa_status,
        coa_number: patch.coa_number !== undefined ? patch.coa_number : passport.coa_number,
        coa_municipality:
          patch.coa_municipality !== undefined
            ? patch.coa_municipality
            : passport.coa_municipality,
        coa_issued_on:
          patch.coa_issued_on !== undefined
            ? patch.coa_issued_on
            : passport.coa_issued_on,
        coa_expires_on:
          patch.coa_expires_on !== undefined
            ? patch.coa_expires_on
            : passport.coa_expires_on,
        coa_file_url:
          patch.coa_file_url !== undefined
            ? patch.coa_file_url
            : passport.coa_file_url,
        coa_applied_on:
          patch.coa_applied_on !== undefined
            ? patch.coa_applied_on
            : passport.coa_applied_on,
        pic_name: patch.pic_name !== undefined ? patch.pic_name : passport.pic_name,
        pic_phone:
          patch.pic_phone !== undefined ? patch.pic_phone : passport.pic_phone,
        pic_training_at:
          patch.pic_training_at !== undefined
            ? patch.pic_training_at
            : passport.pic_training_at,
        pic_training_file_url:
          patch.pic_training_file_url !== undefined
            ? patch.pic_training_file_url
            : passport.pic_training_file_url,
        kitchen_type:
          patch.kitchen_type !== undefined
            ? patch.kitchen_type
            : passport.kitchen_type,
        water_ok: patch.water_ok !== undefined ? patch.water_ok : passport.water_ok,
        power_ok: patch.power_ok !== undefined ? patch.power_ok : passport.power_ok,
        cold_storage_ok:
          patch.cold_storage_ok !== undefined
            ? patch.cold_storage_ok
            : passport.cold_storage_ok,
        principal_attested_at: body.attest
          ? now
          : passport.principal_attested_at,
      });
      const nextMeta = writeKitchenToSchoolMeta(meta, passport, audits);
      const sErr = await saveSchoolMeta(supabase, schoolId, nextMeta);
      if (sErr) {
        return NextResponse.json({ error: sErr.message }, { status: 400 });
      }
      const risk = evaluateKitchenRisk(passport);
      return NextResponse.json({
        success: true,
        passport,
        risk,
        message: 'Kitchen safety passport saved',
      });
    }

    if (action === 'self_audit') {
      const items = (body.items || {}) as Partial<
        Record<R638ItemId, R638Answer>
      >;
      const scored = scoreR638(items);
      if (scored.applicable === 0) {
        return NextResponse.json(
          { error: 'Answer at least one applicable R638 item' },
          { status: 400 }
        );
      }
      const audit: KitchenSelfAudit = {
        id: `r638_${Date.now().toString(36)}`,
        audited_at: now,
        items: items as Record<R638ItemId, R638Answer>,
        score: scored.score,
        band: scored.band,
        notes: body.notes != null ? String(body.notes) : null,
        by_name: body.by_name != null ? String(body.by_name) : null,
      };
      audits = [audit, ...audits].slice(0, 24);
      passport = mergePassport(passport, {
        r638_score: scored.score,
        r638_band: scored.band,
        r638_last_audit_at: now.slice(0, 10),
      });
      const nextMeta = writeKitchenToSchoolMeta(meta, passport, audits);
      const sErr = await saveSchoolMeta(supabase, schoolId, nextMeta);
      if (sErr) {
        return NextResponse.json({ error: sErr.message }, { status: 400 });
      }
      // Soft: open compliance event if red
      if (scored.band === 'red') {
        try {
          await supabase.from('school_compliance_events').insert({
            school_profile_id: schoolId,
            profile_id: companyId,
            kind: 'kitchen_r638',
            title: 'R638 kitchen self-audit red',
            status: 'open',
            severity: 'high',
            event_date: now.slice(0, 10),
            body: `Score ${scored.score}% — ${scored.no} fail item(s). Remediate premises/hygiene.`,
            metadata: { audit_id: audit.id, score: scored.score },
            created_by: gate.userId || null,
          });
        } catch {
          /* soft */
        }
      }
      return NextResponse.json({
        success: true,
        audit,
        passport,
        risk: evaluateKitchenRisk(passport),
        message: `Self-audit saved · ${scored.band} (${scored.score}%)`,
      });
    }

    if (action === 'daily_log') {
      // Attach to feeding day metadata for the date
      const date = String(body.date || now.slice(0, 10)).slice(0, 10);
      const log = {
        fridge_temp_ok:
          body.fridge_temp_ok === true || body.fridge_temp_ok === false
            ? body.fridge_temp_ok
            : null,
        fridge_temp_c:
          body.fridge_temp_c != null && body.fridge_temp_c !== ''
            ? Number(body.fridge_temp_c)
            : null,
        handwash_ok:
          body.handwash_ok === true || body.handwash_ok === false
            ? body.handwash_ok
            : null,
        illness_free:
          body.illness_free === true || body.illness_free === false
            ? body.illness_free
            : null,
        cleaned_ok:
          body.cleaned_ok === true || body.cleaned_ok === false
            ? body.cleaned_ok
            : null,
        source: 'kitchen_safety',
        logged_at: now,
      };
      const { data: existing } = await supabase
        .from('school_feeding_days')
        .select('id, metadata')
        .eq('school_profile_id', schoolId)
        .eq('feed_date', date)
        .maybeSingle();
      if (existing?.id) {
        const fm =
          existing.metadata && typeof existing.metadata === 'object'
            ? { ...(existing.metadata as Record<string, unknown>) }
            : {};
        fm.kitchen_daily_log = log;
        await supabase
          .from('school_feeding_days')
          .update({ metadata: fm, updated_at: now })
          .eq('id', existing.id);
      } else {
        await supabase.from('school_feeding_days').insert({
          school_profile_id: schoolId,
          feed_date: date,
          served_meals: 0,
          metadata: { kitchen_daily_log: log },
          created_at: now,
          updated_at: now,
        });
      }
      return NextResponse.json({
        success: true,
        date,
        log,
        message: 'Daily kitchen safety log saved',
      });
    }

    if (action === 'peu_verify') {
      // Agency / PEU can verify a school by schoolProfileId
      const targetSchoolId = Number(body.school_profile_id || schoolId);
      const { data: target } = await supabase
        .from('school_profiles')
        .select('id, metadata, school_name, profile_id')
        .eq('id', targetSchoolId)
        .maybeSingle();
      if (!target) {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
      }
      const tMeta = schoolMeta(target as Record<string, unknown>);
      let tPass = readKitchenPassport(tMeta);
      const status = String(body.status || 'verified') as
        | 'verified'
        | 'conditional'
        | 'noncompliant';
      if (!['verified', 'conditional', 'noncompliant'].includes(status)) {
        return NextResponse.json({ error: 'Invalid verify status' }, { status: 400 });
      }
      tPass = mergePassport(tPass, {
        peu_verify_status: status,
        peu_verify_at: now.slice(0, 10),
        peu_verify_by: body.by_name != null ? String(body.by_name) : null,
        peu_verify_notes: body.notes != null ? String(body.notes) : null,
      });
      // Optional CoA number confirm
      if (body.coa_number != null) {
        tPass = mergePassport(tPass, {
          coa_number: String(body.coa_number),
          coa_status:
            status === 'noncompliant' ? tPass.coa_status : tPass.coa_status || 'valid',
        });
      }
      const nextMeta = writeKitchenToSchoolMeta(
        tMeta,
        tPass,
        readSelfAudits(tMeta)
      );
      const sErr = await saveSchoolMeta(supabase, targetSchoolId, nextMeta);
      if (sErr) {
        return NextResponse.json({ error: sErr.message }, { status: 400 });
      }
      if (status === 'noncompliant') {
        try {
          await supabase.from('school_compliance_events').insert({
            school_profile_id: targetSchoolId,
            profile_id: Number(target.profile_id || companyId),
            kind: 'kitchen_peu',
            title: 'PEU kitchen verification non-compliant',
            status: 'open',
            severity: 'critical',
            event_date: now.slice(0, 10),
            body: body.notes || 'PEU found kitchen food safety non-compliant (R638/CoA).',
            metadata: { peu_verify_status: status },
            created_by: gate.userId || null,
          });
        } catch {
          /* soft */
        }
      }
      return NextResponse.json({
        success: true,
        passport: tPass,
        risk: evaluateKitchenRisk(tPass),
        message: `PEU verification: ${status}`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[kitchen-safety POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
