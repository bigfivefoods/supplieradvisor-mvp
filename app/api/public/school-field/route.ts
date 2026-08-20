/**
 * Public field PWA API (token auth) — serve day + PEU visit checklist.
 * GET  ?token=
 * POST { token, action, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FieldKind = 'serve_day' | 'peu_visit';

async function resolveToken(token: string): Promise<{
  kind: FieldKind;
  companyId: number;
  schoolProfileId: number;
  schoolName: string;
} | null> {
  const clean = token.trim();
  if (clean.length < 12) return null;
  const supabase = getSupabaseServer();
  const parsed = /^(?:sfd|peu)_(\d+)_/.exec(clean);
  const companyIdHint = parsed ? Number(parsed[1]) : NaN;
  if (!Number.isFinite(companyIdHint) || companyIdHint <= 0) return null;

  const matchKind = (meta: Record<string, unknown>): FieldKind | null => {
    const tokens =
      meta.schooladvisor_field_tokens &&
      typeof meta.schooladvisor_field_tokens === 'object'
        ? (meta.schooladvisor_field_tokens as Record<string, string>)
        : {};
    if (tokens.serve_day === clean) return 'serve_day';
    if (tokens.peu_visit === clean) return 'peu_visit';
    return null;
  };

  const { data: school } = await supabase
    .from('school_profiles')
    .select('id, school_name, profile_id, metadata')
    .eq('profile_id', companyIdHint)
    .maybeSingle();
  if (school) {
    const meta =
      school.metadata && typeof school.metadata === 'object'
        ? (school.metadata as Record<string, unknown>)
        : {};
    const kind = matchKind(meta);
    if (kind) {
      return {
        kind,
        companyId: companyIdHint,
        schoolProfileId: Number(school.id),
        schoolName: String(school.school_name || 'School'),
      };
    }
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('id, metadata, trading_name')
    .eq('id', companyIdHint)
    .maybeSingle();
  if (!prof) return null;
  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? (prof.metadata as Record<string, unknown>)
      : {};
  const kind = matchKind(meta);
  if (!kind) return null;
  return {
    kind,
    companyId: Number(prof.id),
    schoolProfileId: Number(school?.id || 0),
    schoolName: String(school?.school_name || prof.trading_name || 'School'),
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit({
    key: `school-field-get:${ip}`,
    limit: 90,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const token = String(req.nextUrl.searchParams.get('token') || '');
  const resolved = await resolveToken(token);
  if (!resolved || !resolved.companyId) {
    return NextResponse.json({ error: 'Invalid field token' }, { status: 404 });
  }

  const supabase = getSupabaseServer();
  const date = String(req.nextUrl.searchParams.get('date') || todayIso());

  if (resolved.kind === 'serve_day') {
    const { data: feed } = await supabase
      .from('school_feeding_days')
      .select('id, served_meals, learners_present, waste_meals, menu_name, feed_date')
      .eq('school_profile_id', resolved.schoolProfileId)
      .eq('feed_date', date)
      .maybeSingle();
    const { data: att } = await supabase
      .from('school_attendance_days')
      .select('id, present_count')
      .eq('school_profile_id', resolved.schoolProfileId)
      .eq('attendance_date', date)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      kind: 'serve_day',
      school: {
        id: resolved.schoolProfileId,
        name: resolved.schoolName,
        company_id: resolved.companyId,
      },
      date,
      feeding: feed,
      attendance: att,
      offline_scope: 'serve-day',
    });
  }

  // PEU visit checklist shell
  const { data: openVisit } = await supabase
    .from('school_peu_visits')
    .select('id, status, visit_date, notes, checklist')
    .eq('school_profile_id', resolved.schoolProfileId)
    .in('status', ['planned', 'in_progress', 'open', 'scheduled'])
    .order('visit_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    kind: 'peu_visit',
    school: {
      id: resolved.schoolProfileId,
      name: resolved.schoolName,
      company_id: resolved.companyId,
    },
    date,
    visit: openVisit,
    checklist_defaults: [
      { id: 'hygiene', label: 'Kitchen hygiene acceptable', done: false },
      { id: 'stock', label: 'Stock vs menu cover checked', done: false },
      { id: 'records', label: 'Attendance & serve records present', done: false },
      { id: 'catalogue', label: 'Approved list / brands verified', done: false },
      { id: 'safety', label: 'Food safety controls observed', done: false },
    ],
    offline_scope: 'peu-visit',
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit({
      key: `school-field-post:${ip}`,
      limit: 40,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const body = await req.json();
    const token = String(body.token || '');
    const resolved = await resolveToken(token);
    if (!resolved || !resolved.companyId) {
      return NextResponse.json({ error: 'Invalid field token' }, { status: 404 });
    }
    const action = String(body.action || 'save');
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const date = String(body.date || todayIso()).slice(0, 10);

    if (resolved.kind === 'serve_day' && (action === 'save' || action === 'serve')) {
      const present = Number(body.present ?? body.learners_present ?? 0);
      const served = Number(body.served_meals ?? body.served ?? 0);
      const waste = Number(body.waste_meals ?? body.waste ?? 0);
      if (!Number.isFinite(served) || served < 0) {
        return NextResponse.json({ error: 'served_meals required' }, { status: 400 });
      }

      // Attendance
      if (Number.isFinite(present) && present >= 0) {
        const { data: existingAtt } = await supabase
          .from('school_attendance_days')
          .select('id')
          .eq('school_profile_id', resolved.schoolProfileId)
          .eq('attendance_date', date)
          .maybeSingle();
        if (existingAtt?.id) {
          await supabase
            .from('school_attendance_days')
            .update({
              present_count: present,
              updated_at: now,
            })
            .eq('id', existingAtt.id);
        } else {
          await supabase.from('school_attendance_days').insert({
            school_profile_id: resolved.schoolProfileId,
            attendance_date: date,
            present_count: present,
            created_at: now,
            updated_at: now,
          });
        }
      }

      const { data: existingFeed } = await supabase
        .from('school_feeding_days')
        .select('id')
        .eq('school_profile_id', resolved.schoolProfileId)
        .eq('feed_date', date)
        .maybeSingle();
      const feedRow = {
        school_profile_id: resolved.schoolProfileId,
        feed_date: date,
        served_meals: served,
        learners_present: present || null,
        waste_meals: waste || 0,
        menu_name: body.menu_name != null ? String(body.menu_name) : undefined,
        source: 'field_pwa',
        updated_at: now,
      };
      if (existingFeed?.id) {
        await supabase
          .from('school_feeding_days')
          .update(feedRow)
          .eq('id', existingFeed.id);
      } else {
        await supabase.from('school_feeding_days').insert({
          ...feedRow,
          created_at: now,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Serve day saved',
        date,
        served_meals: served,
        present,
      });
    }

    if (resolved.kind === 'peu_visit' && (action === 'save' || action === 'complete')) {
      const checklist = Array.isArray(body.checklist) ? body.checklist : [];
      const notes = body.notes != null ? String(body.notes) : '';
      const status = action === 'complete' ? 'completed' : 'in_progress';
      const { data: existing } = await supabase
        .from('school_peu_visits')
        .select('id')
        .eq('school_profile_id', resolved.schoolProfileId)
        .eq('visit_date', date)
        .maybeSingle();
      const row = {
        school_profile_id: resolved.schoolProfileId,
        visit_date: date,
        status,
        notes,
        checklist,
        source: 'field_pwa',
        updated_at: now,
        completed_at: action === 'complete' ? now : null,
      };
      if (existing?.id) {
        await supabase.from('school_peu_visits').update(row).eq('id', existing.id);
      } else {
        await supabase.from('school_peu_visits').insert({
          ...row,
          created_at: now,
        });
      }

      // Write kitchen CoA verification onto school passport
      if (action === 'complete' || body.kitchen_status) {
        try {
          const kStatus = String(
            body.kitchen_status ||
              (checklist.filter((c: { done?: boolean }) => c.done).length >= 4
                ? 'verified'
                : 'conditional')
          );
          const verifyStatus =
            kStatus === 'noncompliant'
              ? 'noncompliant'
              : kStatus === 'conditional'
                ? 'conditional'
                : 'verified';
          const { data: schoolRow } = await supabase
            .from('school_profiles')
            .select('id, metadata, profile_id')
            .eq('id', resolved.schoolProfileId)
            .maybeSingle();
          if (schoolRow) {
            const {
              readKitchenPassport,
              mergePassport,
              writeKitchenToSchoolMeta,
              readSelfAudits,
            } = await import('@/lib/schools/kitchen-safety');
            const meta =
              schoolRow.metadata && typeof schoolRow.metadata === 'object'
                ? { ...(schoolRow.metadata as Record<string, unknown>) }
                : {};
            let pass = readKitchenPassport(meta);
            pass = mergePassport(pass, {
              peu_verify_status: verifyStatus,
              peu_verify_at: date,
              peu_verify_notes: notes || null,
              coa_number:
                body.coa_number != null
                  ? String(body.coa_number)
                  : pass.coa_number,
            });
            const nextMeta = writeKitchenToSchoolMeta(
              meta,
              pass,
              readSelfAudits(meta)
            );
            await supabase
              .from('school_profiles')
              .update({ metadata: nextMeta, updated_at: now })
              .eq('id', resolved.schoolProfileId);
            if (verifyStatus === 'noncompliant') {
              try {
                await supabase.from('school_compliance_events').insert({
                  school_profile_id: resolved.schoolProfileId,
                  profile_id: schoolRow.profile_id || resolved.companyId,
                  kind: 'kitchen_peu',
                  title: 'PEU kitchen verification non-compliant',
                  status: 'open',
                  severity: 'critical',
                  event_date: date,
                  body: notes || 'Field PEU non-compliant kitchen (R638/CoA).',
                  metadata: { source: 'field_pwa' },
                });
              } catch {
                /* soft */
              }
            }
          }
        } catch {
          /* soft */
        }
      }

      return NextResponse.json({
        success: true,
        message: action === 'complete' ? 'Visit completed' : 'Visit saved',
        status,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[public/school-field]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
