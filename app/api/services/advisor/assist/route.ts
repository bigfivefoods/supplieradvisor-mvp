/**
 * POST /api/services/advisor/assist
 * Deterministic AI assist drafts (recall, class plan, visit summary, marketplace blurb).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  draftClassPlan,
  draftMarketplaceBlurb,
  draftRecallMessage,
  draftVisitSummary,
} from '@/lib/services/advisor-ai-assist';
import { whatsAppUrl, WA_TEMPLATES } from '@/lib/services/advisor-whatsapp';
import { evaluateReschedule } from '@/lib/services/advisor-reschedule';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const kind = String(body.kind || body.action || 'recall');

    if (kind === 'recall') {
      const draft = draftRecallMessage({
        personName: String(body.person_name || body.name || 'there'),
        brand: String(body.brand || 'Practice'),
        daysSince: body.days_since != null ? Number(body.days_since) : null,
        serviceHint: body.service_hint ? String(body.service_hint) : undefined,
      });
      const phone = body.phone ? String(body.phone) : '';
      return NextResponse.json({
        success: true,
        draft,
        whatsapp_url: phone
          ? whatsAppUrl(phone, draft.whatsapp)
          : whatsAppUrl('', draft.whatsapp),
      });
    }

    if (kind === 'class_plan') {
      const draft = draftClassPlan({
        className: String(body.class_name || body.title || 'Class'),
        durationMin: Number(body.duration_min) || 45,
        focus: body.focus ? String(body.focus) : undefined,
        level: body.level ? String(body.level) : undefined,
      });
      return NextResponse.json({ success: true, draft });
    }

    if (kind === 'visit_summary') {
      const text = draftVisitSummary({
        personName: String(body.person_name || 'Patient'),
        serviceName: body.service_name ? String(body.service_name) : undefined,
        painScore:
          body.pain_score != null ? Number(body.pain_score) : null,
        functionScore:
          body.function_score != null ? Number(body.function_score) : null,
        notes: body.notes ? String(body.notes) : undefined,
      });
      return NextResponse.json({ success: true, summary: text });
    }

    if (kind === 'marketplace_blurb') {
      const blurb = draftMarketplaceBlurb({
        brand: String(body.brand || 'Practice'),
        moduleLabel: String(body.module_label || 'Advisor'),
        city: body.city ? String(body.city) : undefined,
        specialties: Array.isArray(body.specialties)
          ? body.specialties.map(String)
          : undefined,
      });
      return NextResponse.json({ success: true, blurb });
    }

    if (kind === 'whatsapp_template') {
      const template = String(body.template || 'booking_confirm') as keyof typeof WA_TEMPLATES;
      const fn = WA_TEMPLATES[template];
      if (!fn) {
        return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (fn as any)(body.vars || body);
      const phone = body.phone ? String(body.phone) : '';
      return NextResponse.json({
        success: true,
        text,
        whatsapp_url: whatsAppUrl(phone, text),
      });
    }

    if (kind === 'reschedule_check') {
      const decision = evaluateReschedule({
        policy: body.policy || null,
        eventDate: String(body.date || ''),
        eventTime: String(body.start_time || body.time || '09:00'),
        personSoftBlocked: body.soft_blocked === true,
      });
      return NextResponse.json({ success: true, decision });
    }

    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
