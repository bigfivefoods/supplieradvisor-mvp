'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Globe,
  Loader2,
  Package,
  Sparkles,
  MessageSquare,
  UserRound,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  DentalgraphPage,
  DentalgraphRequired,
} from '@/components/dental/DentalgraphShell';
import DentalgraphSystemFlow from '@/components/dental/DentalgraphSystemFlow';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import { AdvisorOutcomesPanel } from '@/components/services/AdvisorOutcomesPanel';
import { AdvisorRecallPanel } from '@/components/services/AdvisorRecallPanel';
import { AdvisorTodayBoard } from '@/components/services/AdvisorTodayBoard';
import { AdvisorBillingClarityCard } from '@/components/services/AdvisorBillingClarityCard';
import {
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';

const MODULES: HubModule[] = [
  {
    href: '/dashboard/dentalgraph/staff',
    icon: UserRound,
    code: '01',
    title: 'Staff',
    desc: 'Dentists, hygienists, assistants — roles, rates, bios.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/dentalgraph/patients',
    icon: Users,
    code: '02',
    title: 'Patients',
    desc: 'Patient register, status, assigned clinician.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/dentalgraph/services',
    icon: Sparkles,
    code: '03',
    title: 'Services',
    desc: 'Check-ups, hygiene, fillings, endo — duration & price.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/dentalgraph/packages',
    icon: CreditCard,
    code: '04',
    title: 'Packages',
    desc: 'Care plans and multi-session bundles.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/dentalgraph/calendar',
    icon: CalendarDays,
    code: '05',
    title: 'Calendar',
    desc: 'Main diary — click an event to open (view/edit).',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/dentalgraph/bookings',
    icon: ClipboardCheck,
    code: '06',
    title: 'Desk',
    desc: 'Front desk: waitlist queue, book patients, mark attended.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/dentalgraph/messages',
    icon: MessageSquare,
    code: '07',
    title: 'Messages',
    desc: 'Desk · staff · patients — care and team threads.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
  {
    href: '/dashboard/dentalgraph/website',
    icon: Globe,
    code: '08',
    title: 'Website',
    desc: 'Public practice profile, booking settings, embed token.',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/dentalgraph/report',
    icon: Sparkles,
    code: '09',
    title: 'Management report',
    desc: 'Staff, patients, appointments utilisation.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
];

export default function DentalgraphHubPage() {
  return (
    <DentalgraphRequired>
      <Inner />
    </DentalgraphRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [summary, setSummary] = useState<Record<string, number | boolean> | null>(
    null
  );
  const [store, setStore] = useState<{
    appointments?: Array<{
      id: string;
      date: string;
      start_time: string;
      service_id?: string;
      staff_id?: string | null;
      status?: string;
      location?: string;
    }>;
    bookings?: Array<{
      id: string;
      appointment_id: string;
      patient_id: string;
      status: string;
      family_member_name?: string | null;
    }>;
    patients?: Array<{ id: string; name: string }>;
    staff?: Array<{ id: string; name: string }>;
    services?: Array<{ id: string; name: string }>;
  } | null>(null);
  const [outcomes, setOutcomes] = useState<
    import('@/lib/services/advisor-outcomes').OutcomesSnapshot | null
  >(null);
  const [recalls, setRecalls] = useState<
    Array<{
      id: string;
      name: string;
      email?: string;
      last_attended: string | null;
      days_since: number | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [remindersBusy, setRemindersBusy] = useState(false);
  const [markBusy, setMarkBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dental/dentalgraph?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setSummary(data.summary || null);
      setStore(data.store || null);
      const oRes = await fetch('/api/dental/dentalgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'outcomes', period_days: 30 }),
      });
      const oData = await oRes.json();
      if (oRes.ok) {
        setOutcomes(oData.outcomes || null);
        setRecalls(oData.recalls || []);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/dental/dentalgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'seed_demo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      setSummary(data.summary || null);
      toast.success('Demo practice loaded — staff, patients, diary');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const sendReminders = async () => {
    setRemindersBusy(true);
    try {
      const res = await fetch('/api/dental/dentalgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'send_reminders' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reminders failed');
      toast.success(data.message || 'Reminders sent');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Reminders failed');
    } finally {
      setRemindersBusy(false);
    }
  };

  const markBooking = async (
    bookingId: string,
    status: 'attended' | 'no_show' | 'cancelled'
  ) => {
    setMarkBusy(bookingId);
    try {
      const res = await fetch('/api/dental/dentalgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'mark_attendance',
          booking_id: bookingId,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      if (data.message) toast.success(data.message);
      else toast.success(`Marked ${status.replace('_', ' ')}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setMarkBusy(null);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayRows = (() => {
    if (!store) return [];
    const appts = (store.appointments || []).filter(
      (a) => a.date === today && a.status !== 'cancelled'
    );
    const rows: import('@/components/services/AdvisorTodayBoard').TodayBoardRow[] =
      [];
    for (const a of appts) {
      const svc = store.services?.find((s) => s.id === a.service_id);
      const staff = store.staff?.find((s) => s.id === a.staff_id);
      const books = (store.bookings || []).filter(
        (b) => b.appointment_id === a.id && b.status !== 'cancelled'
      );
      if (books.length === 0) {
        rows.push({
          id: `a-${a.id}`,
          time: a.start_time,
          title: svc?.name || 'Appointment',
          person: staff?.name,
          status: 'open',
          meta: a.location,
          href: '/dashboard/dentalgraph/calendar',
        });
      } else {
        for (const b of books) {
          const patient = store.patients?.find((p) => p.id === b.patient_id);
          rows.push({
            id: b.id,
            time: a.start_time,
            title: svc?.name || 'Appointment',
            person: staff?.name,
            attendee: b.family_member_name || patient?.name,
            status: b.status,
            meta: a.location,
            href: '/dashboard/dentalgraph/bookings',
          });
        }
      }
    }
    return rows.sort((a, b) => a.time.localeCompare(b.time));
  })();

  return (
    <DentalgraphPage>
      <RelationshipHeader
        eyebrow="Tertiary · Services · Dental"
        title="DentalAdvisor"
        titleAccent="®"
        description="Dental practice OS for dentists, hygienists and the practice team: staff, patients, services, care plans, diary, bookings, messages and website."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/dentalgraph/calendar"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <CalendarDays className="w-4 h-4" /> Diary
            </Link>
            <Link
              href="/dashboard/dentalgraph/website"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Globe className="w-4 h-4" /> Website
            </Link>
            <button
              type="button"
              disabled={seeding}
              onClick={() => void seed()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              Load demo practice
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-6">
            <AdvisorBillingClarityCard
              brand={
                (store as { settings?: { brand_name?: string } } | null)?.settings
                  ?.brand_name || 'your practice'
              }
              moduleLabel="DentalAdvisor®"
              accentClass="border-sky-200 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/30"
            />
            <AdvisorOutcomesPanel
              outcomes={outcomes}
              accent="sky"
              title="DentalAdvisor outcomes (30 days)"
              onRefresh={() => void load()}
              onSendReminders={() => void sendReminders()}
              remindersBusy={remindersBusy}
            />
            <AdvisorTodayBoard
              date={today}
              rows={todayRows}
              title="Today's chair board"
              accentClass="border-sky-200 dark:border-sky-800"
              onMark={(id, status) => {
                if (id.startsWith('a-')) {
                  toast.message('Open diary to book a patient into this slot');
                  return;
                }
                void markBooking(id, status);
              }}
              markBusyId={markBusy}
            />
            <AdvisorRecallPanel
              rows={recalls}
              title="Hygiene / check-up recalls"
              description="Patients due for a follow-up (default 180 days since last attended visit)."
              onBook={() => {
                window.location.href = '/dashboard/dentalgraph/calendar';
              }}
            />
          </div>
          <HubTelemetryGrid>
            <TelemetryCard
              label="Staff"
              value={String(summary?.staffCount ?? 0)}
              sub="Active team"
            />
            <TelemetryCard
              label="Patients"
              value={String(summary?.patientCount ?? 0)}
              sub={`${summary?.activePatients ?? 0} active / new`}
            />
            <TelemetryCard
              label="Today"
              value={String(summary?.appointmentsToday ?? 0)}
              sub={`${summary?.appointmentsUpcoming ?? 0} upcoming`}
            />
            <TelemetryCard
              label="Website"
              value={summary?.websiteEnabled ? 'Live' : 'Off'}
              sub={
                summary?.websiteEnabled
                  ? 'Public booking ready'
                  : 'Publish from Website'
              }
            />
          </HubTelemetryGrid>
        </>
      )}

      <div className="mt-8">
        <DentalgraphSystemFlow />
      </div>

      <div className="my-8 grid sm:grid-cols-2 gap-3">
        {[
          {
            t: 'Staff · roles',
            b: 'Register dentists and the dental team, set rates, assign roles, and keep bios for the practice website.',
          },
          {
            t: 'Patients · packages',
            b: 'Patient register with status, assigned clinician, family members, and multi-session care plans.',
          },
          {
            t: 'Diary · bookings · recalls',
            b: 'Schedule treatments, book patients (or household), mark attended / no-show, promote waitlist, run recalls.',
          },
          {
            t: 'Website · outcomes',
            b: 'Publish practice profile; track attendance, no-shows, and feedback on the hub.',
          },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-2xl border border-sky-300 bg-sky-50/50 px-4 py-3 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/40"
          >
            <div className="text-sm font-black text-slate-900 dark:text-sky-50">
              {x.t}
            </div>
            <p className="text-[12px] text-slate-600 dark:text-sky-100/85 mt-1 leading-relaxed">
              {x.b}
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-black uppercase tracking-widest text-sky-800/70 dark:text-sky-200 mb-4">
        Workbenches
      </h2>
      <HubModuleGrid modules={MODULES} />
    </DentalgraphPage>
  );
}
