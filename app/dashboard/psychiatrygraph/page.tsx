'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Globe,
  HeartPulse,
  Loader2,
  Package,
  Sparkles,
  MessageSquare,
  BrainCircuit,
  UserRound,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  PsychiatrygraphPage,
  PsychiatrygraphRequired,
} from '@/components/clinic/PsychiatrygraphShell';
import PsychiatrygraphSystemFlow from '@/components/clinic/PsychiatrygraphSystemFlow';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import { AdvisorOutcomesPanel } from '@/components/services/AdvisorOutcomesPanel';
import { AdvisorRecallPanel } from '@/components/services/AdvisorRecallPanel';
import { AdvisorTodayBoard } from '@/components/services/AdvisorTodayBoard';
import { AdvisorBillingClarityCard } from '@/components/services/AdvisorBillingClarityCard';
import { AdvisorMemberJoinInbox } from '@/components/advisors/AdvisorMemberJoinInbox';
import {
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import { AdvisorCommandBookingCards } from '@/components/advisors/AdvisorCommandBookingCards';

const MODULES: HubModule[] = [
  {
    href: '/dashboard/psychiatrygraph/practitioners',
    icon: BrainCircuit,
    code: '01',
    title: 'Practitioners',
    desc: 'Psychiatrists, psychologists, counsellors — disciplines, rates, bios.',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/psychiatrygraph/patients',
    icon: Users,
    code: '02',
    title: 'Patients',
    desc: 'Patient register, status, assigned practitioner.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/psychiatrygraph/services',
    icon: HeartPulse,
    code: '03',
    title: 'Services',
    desc: 'Assessments, treatments, home visits — duration & price.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/psychiatrygraph/packages',
    icon: CreditCard,
    code: '04',
    title: 'Packages',
    desc: 'Rehab packs and multi-session bundles.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/psychiatrygraph/calendar',
    icon: CalendarDays,
    code: '05',
    title: 'Calendar',
    desc: 'Main diary — click an event to open (view/edit).',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/psychiatrygraph/bookings',
    icon: ClipboardCheck,
    code: '06',
    title: 'Desk',
    desc: 'Front desk: waitlist queue, book patients, mark attended.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/psychiatrygraph/messages',
    icon: MessageSquare,
    code: '07',
    title: 'Messages',
    desc: 'Desk · practitioners · patients — care and team threads.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
  {
    href: '/dashboard/psychiatrygraph/website',
    icon: Globe,
    code: '08',
    title: 'Website',
    desc: 'Public clinic profile, booking settings, embed token.',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/psychiatrygraph/report',
    icon: Sparkles,
    code: '09',
    title: 'Management report',
    desc: 'Practitioners, patients, appointments utilisation.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
];

export default function PsychiatrygraphHubPage() {
  return (
    <PsychiatrygraphRequired>
      <Inner />
    </PsychiatrygraphRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [summary, setSummary] = useState<
    Record<string, number | boolean | string | null | undefined> | null
  >(null);
  const [store, setStore] = useState<{
    appointments?: Array<{
      id: string;
      date: string;
      start_time: string;
      service_id?: string;
      practitioner_id?: string | null;
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
    practitioners?: Array<{ id: string; name: string }>;
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
        `/api/clinic/psychiatrygraph?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setSummary(data.summary || null);
      setStore(data.store || null);
      const oRes = await fetch('/api/clinic/psychiatrygraph', {
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
      const res = await fetch('/api/clinic/psychiatrygraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'seed_demo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      setSummary(data.summary || null);
      toast.success('Demo clinic loaded — practitioners, patients, diary');
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
      const res = await fetch('/api/clinic/psychiatrygraph', {
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
      const res = await fetch('/api/clinic/psychiatrygraph', {
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
      const prac = store.practitioners?.find((p) => p.id === a.practitioner_id);
      const books = (store.bookings || []).filter(
        (b) => b.appointment_id === a.id && b.status !== 'cancelled'
      );
      if (books.length === 0) {
        rows.push({
          id: `a-${a.id}`,
          time: a.start_time,
          title: svc?.name || 'Appointment',
          person: prac?.name,
          status: 'open',
          meta: a.location,
          href: '/dashboard/psychiatrygraph/calendar',
        });
      } else {
        for (const b of books) {
          const patient = store.patients?.find((p) => p.id === b.patient_id);
          rows.push({
            id: b.id,
            time: a.start_time,
            title: svc?.name || 'Appointment',
            person: prac?.name,
            attendee: b.family_member_name || patient?.name,
            status: b.status,
            meta: a.location,
            href: '/dashboard/psychiatrygraph/bookings',
          });
        }
      }
    }
    return rows.sort((a, b) => a.time.localeCompare(b.time));
  })();

  return (
    <PsychiatrygraphPage>
      <RelationshipHeader
        eyebrow="Tertiary · Services · Mental health"
        title="PsychiatryAdvisor"
        titleAccent="®"
        description="Mental health OS for psychiatry and psychology: practitioners, patients, services, care packages, diary, bookings, portal and website."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/psychiatrygraph/calendar"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <CalendarDays className="w-4 h-4" /> Diary
            </Link>
            <Link
              href="/dashboard/psychiatrygraph/website"
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
              Load demo clinic
            </button>
          </div>
        }
      />

      <AdvisorMemberJoinInbox
        companyId={companyId}
        module="psychiatrygraph"
        patientsHref="/dashboard/psychiatrygraph/patients"
      />

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-6">
            <AdvisorBillingClarityCard
              brand={
                (store as { settings?: { brand_name?: string } } | null)?.settings
                  ?.brand_name || 'your practice'
              }
              moduleLabel="PsychiatryAdvisor®"
              accountsHref="/dashboard/psychiatrygraph/accounts"
              accentClass="border-rose-200 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/30"
            />
            <AdvisorOutcomesPanel
              outcomes={outcomes}
              accent="indigo"
              title="PsychiatryAdvisor outcomes (30 days)"
              onRefresh={() => void load()}
              onSendReminders={() => void sendReminders()}
              remindersBusy={remindersBusy}
            />
            <AdvisorTodayBoard
              date={today}
              rows={todayRows}
              title="Today's session board"
              accentClass="border-indigo-200 dark:border-indigo-800"
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
              title="Review / follow-up recalls"
              description="Patients due for a follow-up session."
              onBook={() => {
                window.location.href = '/dashboard/psychiatrygraph/calendar';
              }}
            />
          </div>
          <HubTelemetryGrid>
            <TelemetryCard
              label="Practitioners"
              value={String(summary?.practitionerCount ?? 0)}
              sub="Active team"
            />
            <TelemetryCard
              label="Patients"
              value={String(summary?.patientCount ?? 0)}
              sub={`${summary?.activePatients ?? 0} active / new`}
            />
            <AdvisorCommandBookingCards
              summary={summary}
              calendarHref="/dashboard/psychiatrygraph/calendar"
            />
          </HubTelemetryGrid>
        </>
      )}

      <div className="mt-8">
        <PsychiatrygraphSystemFlow />
      </div>

      <div className="my-8 grid sm:grid-cols-2 gap-3">
        {[
          {
            t: 'Practitioners · disciplines',
            b: 'Register psychiatrists and mental health team, set rates, assign disciplines, and keep bios for the practice website.',
          },
          {
            t: 'Patients · packages',
            b: 'Patient register with status, assigned clinician, family members, and multi-session care packs.',
          },
          {
            t: 'Diary · bookings · recalls',
            b: 'Schedule sessions, book patients (or household), mark attended / no-show, promote waitlist.',
          },
          {
            t: 'Website · outcomes',
            b: 'Publish practice profile; track attendance, no-shows, and feedback on the hub.',
          },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-2xl border border-indigo-300 bg-indigo-50/50 px-4 py-3 dark:!border-indigo-400 dark:!bg-indigo-950 dark:ring-1 dark:ring-indigo-500/40"
          >
            <div className="text-sm font-black text-slate-900 dark:text-indigo-50">
              {x.t}
            </div>
            <p className="text-[12px] text-slate-600 dark:text-indigo-100/85 mt-1 leading-relaxed">
              {x.b}
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-black uppercase tracking-widest text-indigo-800/70 dark:text-indigo-200 mb-4">
        Workbenches
      </h2>
      <HubModuleGrid modules={MODULES} />
    </PsychiatrygraphPage>
  );
}
