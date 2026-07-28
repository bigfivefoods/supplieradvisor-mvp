import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  emptyMonitoringForm,
  scoreMonitoringForm,
  type MonitoringFormData,
} from '@/lib/schools/nsnp-monitoring-tool';
import {
  buildMonitoringFeedbackPdf,
  monitoringPdfFilename,
} from '@/lib/schools/nsnp-monitoring-feedback-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET ?companyId=&id=  — PDF of monitoring feedback form
 * POST body { companyId, form_data, scores? } — PDF from live form (no save required)
 */
export async function GET(request: NextRequest) {
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
    const agency = await getAgencyRegistration(supabase, companyId);
    const school = agency
      ? null
      : await getOrCreateSchoolProfile(supabase, companyId).catch(() => null);

    const { data, error } = await supabase
      .from('nsnp_monitoring_tools')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const allowed =
      (agency && Number(data.agency_profile_id) === companyId) ||
      (school &&
        Number(data.school_profile_id) === Number(school.id) &&
        String(data.status) === 'submitted');
    if (!allowed) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
    }

    const form = {
      ...emptyMonitoringForm(),
      ...(data.form_data && typeof data.form_data === 'object'
        ? data.form_data
        : {}),
    } as MonitoringFormData;
    const scores = scoreMonitoringForm(form);

    const pdf = await buildMonitoringFeedbackPdf({
      form,
      scores,
      visitDate: data.visit_date,
      status: data.status,
      monitorName: data.monitor_name,
      schoolName: form.a1_school_name,
      emis: form.a2_emis,
      peuVisitId: data.peu_visit_id != null ? Number(data.peu_visit_id) : null,
      monitoringId: Number(data.id),
      submittedAt: data.submitted_at,
    });

    const filename = monitoringPdfFilename({
      schoolName: form.a1_school_name,
      visitDate: data.visit_date,
      monitoringId: Number(data.id),
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF failed' },
      { status: 500 }
    );
  }
}

/** Live form preview PDF (draft / before save). */
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

    const form = {
      ...emptyMonitoringForm(),
      ...(body.form_data && typeof body.form_data === 'object'
        ? body.form_data
        : {}),
    } as MonitoringFormData;
    const scores = scoreMonitoringForm(form);

    const pdf = await buildMonitoringFeedbackPdf({
      form,
      scores,
      visitDate: form.a7_visit_date,
      status: body.status || 'draft',
      monitorName: form.a6_monitor_name,
      schoolName: form.a1_school_name,
      emis: form.a2_emis,
      peuVisitId: body.peu_visit_id != null ? Number(body.peu_visit_id) : null,
      monitoringId: body.id != null ? Number(body.id) : null,
    });

    const filename = monitoringPdfFilename({
      schoolName: form.a1_school_name,
      visitDate: form.a7_visit_date,
      monitoringId: body.id != null ? Number(body.id) : null,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF failed' },
      { status: 500 }
    );
  }
}
