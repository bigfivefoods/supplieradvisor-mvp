/**
 * GET/POST /api/services/advisor/cron
 * Cron: 24h booking reminders + pack expiry warnings across Advisor modules.
 * Auth: Bearer CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { needsReminder, sendBookingReminderEmail } from '@/lib/services/advisor-reminders';
import { notifyBookingReminderPush } from '@/lib/b2c/member-push';
import { packExpiryWarnings, fitPtPackToLedger } from '@/lib/services/advisor-pack-ledger';
import { appendAdvisorEvent } from '@/lib/services/advisor-events';
import { getResend, getResendFrom, getAppUrl } from '@/lib/resend';
import { readFitgraphFromMetadata, writeFitgraphToMetadata } from '@/lib/fitness/fitgraph';
import { readDentalgraphFromMetadata, writeDentalgraphToMetadata } from '@/lib/dental/dentalgraph';
import {
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
} from '@/lib/clinic/medicalgraph';
import {
  applyCompanyLogoToSettings,
  logoUrlFromSettings,
} from '@/lib/business/company-logo';
import { clinicSendReminders } from '@/lib/services/clinic-advisor-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type ModuleKey = 'fitgraph' | 'dentalgraph' | 'physiograph' | 'medicalgraph' | 'psychiatrygraph';

async function runForCompany(
  companyId: number,
  meta: Record<string, unknown>,
  profile?: { logo_url?: string | null; trading_name?: string | null }
): Promise<{
  companyId: number;
  reminders: number;
  pack_warnings: number;
  modules: string[];
}> {
  let reminders = 0;
  let pack_warnings = 0;
  const modules: string[] = [];
  let nextMeta = { ...meta };
  const now = new Date().toISOString();
  const app = getAppUrl();

  // —— GymAdvisor ——
  if (meta.fitgraph) {
    modules.push('fitgraph');
    const store = readFitgraphFromMetadata(meta);
    for (const b of store.bookings) {
      if (b.status !== 'booked') continue;
      const session = store.sessions.find((s) => s.id === b.session_id);
      if (!session || session.status === 'cancelled') continue;
      if (!needsReminder(b, session.date, session.start_time, 24)) continue;
      const client = store.clients.find((c) => c.id === b.client_id);
      if (!client || (!client.email && !client.platform_user_id)) continue;
      const ct = store.class_types.find((t) => t.id === session.class_type_id);
      const manageUrl = client.portal_token
        ? `/member/fitgraph/${client.portal_token}`
        : undefined;
      let emailed = false;
      if (client.email) {
        const result = await sendBookingReminderEmail({
          to: client.email,
          personName: b.family_member_name || client.name || 'Member',
          brand: store.settings?.brand_name || 'Gym',
          eventTitle: ct?.name || 'Class',
          date: session.date,
          start_time: session.start_time,
          location: session.location,
          manageUrl,
          moduleLabel: 'GymAdvisor®',
          moduleKey: 'fitgraph',
          logoUrl: profile?.logo_url || logoUrlFromSettings(store.settings),
        });
        emailed = result.ok;
      }
      const pushed = client.platform_user_id
        ? (
            await notifyBookingReminderPush({
              platformUserId: client.platform_user_id,
              brand: store.settings?.brand_name || 'Gym',
              title: ct?.name || 'Class',
              date: session.date,
              start_time: session.start_time,
              portalPath: manageUrl,
            })
          ).sent
        : 0;
      if (emailed || pushed > 0) {
        b.reminded_at = now;
        b.reminder_count = (Number(b.reminder_count) || 0) + 1;
        reminders++;
        const ev = appendAdvisorEvent(nextMeta, {
          module: 'fitgraph',
          company_id: companyId,
          type: 'reminder.sent',
          person_id: b.client_id,
          booking_id: b.id,
        });
        nextMeta = ev.metadata;
      }
    }
    // Pack expiry emails (best-effort)
    const packs = (store.pt_packs || []).map(fitPtPackToLedger);
    const warnings = packExpiryWarnings(packs, 14);
    const resend = getResend();
    for (const w of warnings.slice(0, 20)) {
      const client = store.clients.find((c) => c.id === w.person_id);
      if (!client?.email || !resend) continue;
      try {
        await resend.emails.send({
          from: getResendFrom(),
          to: client.email,
          subject: `Pack expiring soon · ${w.remaining} session(s) left`,
          html: `<p>Hi ${client.name},</p><p>Your session pack has <strong>${w.remaining}</strong> session(s) and expires in <strong>${w.days_left}</strong> day(s). Book soon at ${store.settings?.brand_name || 'your gym'}.</p><p><a href="${app}">Open portal</a></p>`,
        });
        pack_warnings++;
        const ev = appendAdvisorEvent(nextMeta, {
          module: 'fitgraph',
          company_id: companyId,
          type: 'pack.expired_warn',
          person_id: w.person_id,
          meta: { pack_id: w.id, days_left: w.days_left, remaining: w.remaining },
        });
        nextMeta = ev.metadata;
      } catch {
        /* soft */
      }
    }
    nextMeta = writeFitgraphToMetadata(nextMeta, store);
  }

  // —— DentalAdvisor ——
  if (meta.dentalgraph) {
    modules.push('dentalgraph');
    const store = readDentalgraphFromMetadata(meta);
    for (const b of store.bookings) {
      if (b.status !== 'booked') continue;
      const appt = store.appointments.find((a) => a.id === b.appointment_id);
      if (!appt || appt.status === 'cancelled') continue;
      if (!needsReminder(b, appt.date, appt.start_time, 24)) continue;
      const patient = store.patients.find((p) => p.id === b.patient_id);
      if (!patient || (!patient.email && !patient.platform_user_id)) continue;
      const svc = store.services.find((s) => s.id === appt.service_id);
      const manageUrl = patient.portal_token
        ? `/member/dentalgraph/${patient.portal_token}`
        : undefined;
      let emailed = false;
      if (patient.email) {
        const result = await sendBookingReminderEmail({
          to: patient.email,
          personName: b.family_member_name || patient.name || 'Patient',
          brand: store.settings?.brand_name || 'Practice',
          eventTitle: svc?.name || 'Appointment',
          date: appt.date,
          start_time: appt.start_time,
          location: appt.location,
          manageUrl,
          moduleLabel: 'DentalAdvisor®',
          moduleKey: 'dentalgraph',
          logoUrl: profile?.logo_url || logoUrlFromSettings(store.settings),
        });
        emailed = result.ok;
      }
      const pushed = patient.platform_user_id
        ? (
            await notifyBookingReminderPush({
              platformUserId: patient.platform_user_id,
              brand: store.settings?.brand_name || 'Practice',
              title: svc?.name || 'Appointment',
              date: appt.date,
              start_time: appt.start_time,
              portalPath: manageUrl,
            })
          ).sent
        : 0;
      if (emailed || pushed > 0) {
        b.reminded_at = now;
        b.reminder_count = (Number(b.reminder_count) || 0) + 1;
        reminders++;
        const ev = appendAdvisorEvent(nextMeta, {
          module: 'dentalgraph',
          company_id: companyId,
          type: 'reminder.sent',
          person_id: b.patient_id,
          booking_id: b.id,
        });
        nextMeta = ev.metadata;
      }
    }
    nextMeta = writeDentalgraphToMetadata(nextMeta, store);
  }

  // —— MedicalAdvisor (branded pre + post session) ——
  if (meta.medicalgraph) {
    modules.push('medicalgraph');
    const store = readMedicalgraphFromMetadata(meta);
    applyCompanyLogoToSettings(store, profile?.logo_url || null);
    const { sent } = await clinicSendReminders(
      store,
      {
        moduleLabel: 'MedicalAdvisor®',
        portalPath: 'medicalgraph',
        brandFallback: profile?.trading_name || 'Practice',
        companyId,
        logoUrl: profile?.logo_url || logoUrlFromSettings(store.settings),
      },
      now
    );
    reminders += sent;
    nextMeta = writeMedicalgraphToMetadata(nextMeta, store);
  }

  // Clinic modules — generic structure
  for (const key of ['physiograph', 'psychiatrygraph'] as ModuleKey[]) {
    const raw = meta[key];
    if (!raw || typeof raw !== 'object') continue;
    modules.push(key);
    const store = raw as {
      bookings?: Array<{
        id: string;
        status: string;
        appointment_id: string;
        patient_id: string;
        family_member_name?: string | null;
        reminded_at?: string | null;
        reminder_count?: number;
      }>;
      appointments?: Array<{
        id: string;
        date: string;
        start_time: string;
        status: string;
        service_id?: string;
        location?: string;
      }>;
      patients?: Array<{
        id: string;
        name: string;
        email?: string;
        portal_token?: string | null;
        platform_user_id?: string | null;
      }>;
      services?: Array<{ id: string; name: string }>;
      settings?: { brand_name?: string; company_logo_url?: string | null };
    };
    const label =
      key === 'physiograph'
        ? 'PhysioAdvisor®'
        : key === 'medicalgraph'
          ? 'MedicalAdvisor®'
          : 'PsychiatryAdvisor®';
    for (const b of store.bookings || []) {
      if (b.status !== 'booked') continue;
      const appt = (store.appointments || []).find((a) => a.id === b.appointment_id);
      if (!appt || appt.status === 'cancelled') continue;
      if (!needsReminder(b, appt.date, appt.start_time, 24)) continue;
      const patient = (store.patients || []).find((p) => p.id === b.patient_id);
      if (!patient || (!patient.email && !patient.platform_user_id)) continue;
      const svc = (store.services || []).find((s) => s.id === appt.service_id);
      const manageUrl = patient.portal_token
        ? `/member/${key}/${patient.portal_token}`
        : undefined;
      let emailed = false;
      if (patient.email) {
        const result = await sendBookingReminderEmail({
          to: patient.email,
          personName: b.family_member_name || patient.name || 'Patient',
          brand: store.settings?.brand_name || 'Practice',
          eventTitle: svc?.name || 'Appointment',
          date: appt.date,
          start_time: appt.start_time,
          location: appt.location,
          manageUrl,
          moduleLabel: label,
          moduleKey: key,
          logoUrl: profile?.logo_url || logoUrlFromSettings(store.settings),
        });
        emailed = result.ok;
      }
      const pushed = patient.platform_user_id
        ? (
            await notifyBookingReminderPush({
              platformUserId: patient.platform_user_id,
              brand: store.settings?.brand_name || 'Practice',
              title: svc?.name || 'Appointment',
              date: appt.date,
              start_time: appt.start_time,
              portalPath: manageUrl,
            })
          ).sent
        : 0;
      if (emailed || pushed > 0) {
        b.reminded_at = now;
        b.reminder_count = (Number(b.reminder_count) || 0) + 1;
        reminders++;
      }
    }
    nextMeta = { ...nextMeta, [key]: store };
  }

  nextMeta.advisor_reminders_last_run = {
    at: now,
    reminders_sent: reminders,
    pack_warnings,
    modules,
  };
  if (reminders > 0 || pack_warnings > 0 || modules.length) {
    const supabase = getSupabaseServer();
    await supabase
      .from('profiles')
      .update({ metadata: nextMeta, updated_at: now })
      .eq('id', companyId);
  } else if (modules.length) {
    // still stamp last scan when modules present but nothing to send
    const supabase = getSupabaseServer();
    await supabase
      .from('profiles')
      .update({ metadata: nextMeta, updated_at: now })
      .eq('id', companyId);
  }

  return { companyId, reminders, pack_warnings, modules };
}

export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return run(request);
}

export async function POST(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return run(request);
}

async function run(request: NextRequest) {
  const limit = Math.min(
    80,
    Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 40))
  );
  const supabase = getSupabaseServer();
  // Scan recent profiles — filter in process for advisor metadata keys
  const { data: rows, error } = await supabase
    .from('profiles')
    .select('id, metadata, updated_at, logo_url, trading_name')
    .order('updated_at', { ascending: false })
    .limit(400);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const candidates = (rows || []).filter((r) => {
    const m = r.metadata as Record<string, unknown> | null;
    if (!m || typeof m !== 'object') return false;
    return Boolean(
      m.fitgraph ||
        m.dentalgraph ||
        m.physiograph ||
        m.medicalgraph ||
        m.psychiatrygraph
    );
  }).slice(0, limit);

  const results = [];
  let totalReminders = 0;
  let totalPackWarn = 0;
  for (const row of candidates) {
    try {
      const r = await runForCompany(
        Number(row.id),
        (row.metadata && typeof row.metadata === 'object'
          ? { ...(row.metadata as Record<string, unknown>) }
          : {}) as Record<string, unknown>,
        {
          logo_url: (row as { logo_url?: string | null }).logo_url,
          trading_name: (row as { trading_name?: string | null }).trading_name,
        }
      );
      totalReminders += r.reminders;
      totalPackWarn += r.pack_warnings;
      if (r.reminders || r.pack_warnings) results.push(r);
    } catch (e) {
      results.push({
        companyId: Number(row.id),
        error: e instanceof Error ? e.message : 'failed',
      });
    }
  }

  return NextResponse.json({
    success: true,
    scanned: candidates.length,
    companies_touched: results.length,
    reminders_sent: totalReminders,
    pack_warnings_sent: totalPackWarn,
    results,
  });
}
