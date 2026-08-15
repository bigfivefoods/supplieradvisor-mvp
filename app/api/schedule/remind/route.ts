import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess } from '@/lib/auth/api-auth';
import { sendBookingReminderEmail } from '@/lib/services/advisor-reminders';
import { whatsAppUrl, WA_TEMPLATES } from '@/lib/services/advisor-whatsapp';

export const runtime = 'nodejs';

/**
 * POST { companyId, channel: 'email'|'whatsapp', to, personName, brand,
 *   eventTitle, date, start_time, location?, manageUrl?, phone? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const auth = await requireCompanyAccess(req, companyId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const channel = String(body.channel || 'email');
    const personName = String(body.personName || 'there');
    const brand = String(body.brand || 'Practice');
    const eventTitle = String(body.eventTitle || 'Appointment');
    const date = String(body.date || '');
    const start_time = String(body.start_time || '');
    const location = body.location ? String(body.location) : undefined;
    const manageUrl = body.manageUrl ? String(body.manageUrl) : undefined;

    if (channel === 'whatsapp') {
      const phone = String(body.phone || '');
      const text = WA_TEMPLATES.reminder_24h({
        name: personName,
        brand,
        title: eventTitle,
        date,
        time: start_time,
        manageUrl,
      });
      const url = whatsAppUrl(phone, text);
      return NextResponse.json({ success: true, whatsapp_url: url });
    }

    const to = String(body.to || '').toLowerCase().trim();
    if (!to.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email required for email reminders' },
        { status: 400 }
      );
    }

    const result = await sendBookingReminderEmail({
      to,
      personName,
      brand,
      eventTitle,
      date,
      start_time,
      location,
      manageUrl,
      moduleLabel: body.moduleLabel ? String(body.moduleLabel) : undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Send failed' },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('remind', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Reminder failed' },
      { status: 500 }
    );
  }
}
