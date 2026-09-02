'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  ListChecks,
  Globe,
  Loader2,
  Package,
  Sparkles,
  UserRound,
  Users,
  CreditCard,
  MessageSquare,
  Repeat,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  FitgraphPage,
  FitgraphRequired,
} from '@/components/fitness/FitgraphShell';
import FitgraphSystemFlow from '@/components/fitness/FitgraphSystemFlow';
import AdvisorSystemOverview from '@/components/advisors/AdvisorSystemOverview';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import { AdvisorOutcomesPanel } from '@/components/services/AdvisorOutcomesPanel';
import { AdvisorRecallPanel } from '@/components/services/AdvisorRecallPanel';
import {
  AdvisorTodayBoard,
  type TodayBoardGroup,
} from '@/components/services/AdvisorTodayBoard';
import { gymTodayFloorClasses } from '@/lib/fitness/gym-today-floor';
import type { FitgraphStore } from '@/lib/fitness/fitgraph';
import { AdvisorBillingClarityCard } from '@/components/services/AdvisorBillingClarityCard';
import { AdvisorMemberJoinInbox } from '@/components/advisors/AdvisorMemberJoinInbox';
import { AdvisorCommandBookingCards } from '@/components/advisors/AdvisorCommandBookingCards';
import { MemberSpecialDatesPanel } from '@/components/fitness/MemberSpecialDatesPanel';
import { memberSpecialDates } from '@/lib/fitness/member-special-dates';

function hubModules(
  hasFrontDesk: boolean,
  classSubscribe = false
): HubModule[] {
  const all: HubModule[] = [
  {
    href: '/dashboard/fitgraph/coaches',
    icon: UserRound,
    code: '01',
    title: 'Coaches',
    desc: 'Contract or permanent, commercial terms, work PWA.',
    accent: 'from-yellow-50 to-white border-yellow-100',
  },
  {
    href: '/dashboard/fitgraph/clients',
    icon: Users,
    code: '02',
    title: 'Clients / members',
    desc: 'Member book · member / private · classes',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: classSubscribe
      ? '/dashboard/fitgraph/classes'
      : '/dashboard/fitgraph/memberships',
    icon: CreditCard,
    code: '03',
    title: classSubscribe ? 'Classes' : 'Membership plans',
    desc: classSubscribe
      ? 'Edit class · coach · calendar · booked members'
      : 'Unlimited, packs, pricing and class/PT credits.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/fitgraph/subscriptions',
    icon: Repeat,
    code: '04',
    title: 'Subscriptions',
    desc: 'Active member subs, pause/cancel, remaining credits.',
    accent: 'from-teal-50 to-white border-teal-100',
  },
  {
    href: '/dashboard/fitgraph/classes',
    icon: Dumbbell,
    code: '05',
    title: 'Class types',
    desc: 'First: define HIIT, strength, yoga — capacity & duration.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/fitgraph/movements',
    icon: Dumbbell,
    code: '05b',
    title: 'Movement library',
    desc: 'Coach exercises with images or video descriptions.',
    accent: 'from-lime-50 to-white border-lime-100',
  },
  {
    href: '/dashboard/fitgraph/programmes',
    icon: ListChecks,
    code: '05c',
    title: 'Programmes',
    desc: 'Build a calendar of movements, sell it, and follow client progress.',
    accent: 'from-orange-50 to-white border-orange-100',
  },
  {
    href: '/dashboard/fitgraph/leaderboard',
    icon: Sparkles,
    code: '05d',
    title: 'Leadership board',
    desc: 'Owner activities, men/women age benchmarks, member PWA scores.',
    accent: 'from-yellow-50 to-white border-yellow-100',
  },
  {
    href: '/dashboard/fitgraph/calendar',
    icon: CalendarDays,
    code: '06',
    title: 'Calendar',
    desc: 'Main diary — click an event to open (view/edit).',
    accent: 'from-rose-50 to-white border-rose-100',
  },
  {
    href: '/dashboard/fitgraph/bookings',
    icon: ClipboardCheck,
    code: '07',
    title: 'Desk',
    desc: 'Front desk: book members, waitlist, mark attended.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/fitgraph/checkins',
    icon: Sparkles,
    code: '08',
    title: 'Check-ins',
    desc: hasFrontDesk
      ? 'Phone QR + desk log · paid/unpaid alerts.'
      : 'Phone QR check-in · membership payment alerts.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
  {
    href: '/dashboard/fitgraph/feedback',
    icon: Sparkles,
    code: '08b',
    title: 'Class feedback',
    desc: 'Member & coach post-class feel, intensity (RPE), comments.',
    accent: 'from-orange-50 to-white border-orange-100',
  },
  {
    href: '/dashboard/fitgraph/messages',
    icon: MessageSquare,
    code: '09',
    title: 'Messages',
    desc: hasFrontDesk
      ? 'Desk · coaches · members — colleague, care, and class groups.'
      : 'Coach-led: coach ↔ member and class groups (no desk persona).',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
  {
    href: '/dashboard/fitgraph/website',
    icon: Globe,
    code: '10',
    title: 'Website & apps',
    desc: 'Publish the public site, door QR, member app and preview.',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/fitgraph/report',
    icon: Package,
    code: '11',
    title: 'Reports',
    desc: 'Slice & dice · pack · trends · A4 PDF',
    accent: 'from-slate-50 to-white border-slate-200',
  },
  {
    href: '/dashboard/people',
    icon: UserRound,
    code: '12',
    title: 'People (HR)',
    desc: 'Employed coaches dual-write into the Core People directory.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/customers',
    icon: Users,
    code: '13',
    title: 'Customers (CRM)',
    desc: 'Members land on the Core customer book for invoices and AR.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/accounting',
    icon: CreditCard,
    code: '14',
    title: 'Finance',
    desc: 'Membership fees post as customer invoices — collect here or on Accounts.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  ];
  return all.filter((m) => {
    if (m.href === '/dashboard/fitgraph/subscriptions') return false;
    if (m.code === '05') return false;
    return true;
  });
}

export default function FitgraphHubPage() {
  return (
    <FitgraphRequired>
      <Inner />
    </FitgraphRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [summary, setSummary] = useState<
    Record<string, number | boolean | string | null | undefined> | null
  >(null);
  const [store, setStore] = useState<FitgraphStore | null>(null);
  const [outcomes, setOutcomes] = useState<import('@/lib/services/advisor-outcomes').OutcomesSnapshot | null>(null);
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
      const res = await fetch(`/api/fitness/fitgraph?companyId=${companyId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSummary(data.summary || null);
      setStore(data.store || null);
      // outcomes
      const oRes = await fetch('/api/fitness/fitgraph', {
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
      const res = await fetch('/api/fitness/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'seed_demo',
          updated_at: store?.updated_at || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      setSummary(data.summary || null);
      setStore(data.store || null);
      toast.success('Demo gym loaded — coaches, classes, subscriptions, public calendar');
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
      const res = await fetch('/api/fitness/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'send_reminders',
          updated_at: store?.updated_at || null,
        }),
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
      const res = await fetch('/api/fitness/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'mark_attendance',
          booking_id: bookingId,
          status,
          updated_at: store?.updated_at || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data?.error === 'stale_store') {
          throw new Error(
            'This GymAdvisor book changed in another tab. Please refresh and try again.'
          );
        }
        throw new Error(data.error || 'Update failed');
      }
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
  const specialDates = memberSpecialDates(store?.clients ?? [], {
    from: today,
    days: 14,
  });
  const specialToday = specialDates.filter(
    (r) => r.days_until === 0 && r.kind !== 'joined'
  ).length;
  const todayGroups: TodayBoardGroup[] = store
    ? gymTodayFloorClasses(store, today).map((cls) => ({
        id: cls.id,
        time: cls.time,
        title: cls.title,
        person: cls.person,
        meta: cls.meta,
        href: cls.href,
        members: cls.members.map((m) => ({
          id: m.id,
          time: cls.time,
          title: cls.title,
          attendee: m.name,
          status: m.status,
        })),
      }))
    : [];

  return (
    <FitgraphPage>
      <RelationshipHeader
        eyebrow="Tertiary · Services · Fitness & wellness"
        title="GymAdvisor"
        titleAccent="®"
        description="Gym services OS: coaches with tenure, rates and contracts; members (incl. .xlsx); plan vs actual; post-class feedback; website embed; slice-and-dice reports."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/fitgraph/website"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Globe className="w-4 h-4" /> Website & apps
            </Link>
            <Link
              href="/dashboard/fitgraph/calendar"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <CalendarDays className="w-4 h-4" /> Schedule
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
              Load demo gym
            </button>
          </div>
        }
      />

      <AdvisorBillingClarityCard
        brand={store?.settings?.brand_name || 'your gym'}
        moduleLabel="GymAdvisor®"
        accountsHref="/dashboard/fitgraph/accounts"
        accentClass="border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30"
      />
      <AdvisorMemberJoinInbox
        companyId={companyId}
        module="fitgraph"
        patientsHref="/dashboard/fitgraph/clients"
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-600" />
        </div>
      ) : (
        <>
        <HubTelemetryGrid>
          <TelemetryCard
            label="Active members"
            value={String(summary?.activeMembers ?? 0)}
            sub={`${summary?.activeSubscriptions ?? 0} subscriptions`}
          />
          <TelemetryCard
            label="Coaches"
            value={String(summary?.coachCount ?? 0)}
            sub={`${summary?.classTypeCount ?? 0} class types`}
          />
          <AdvisorCommandBookingCards
            summary={summary}
            calendarHref="/dashboard/fitgraph/calendar"
          />
          <TelemetryCard
            label="Member dates"
            value={String(specialToday)}
            sub={
              specialToday
                ? 'birthdays & gym anniversaries today'
                : `${specialDates.filter((r) => r.kind !== 'joined').length} in the next 14 days`
            }
            accent="amber"
          />
        </HubTelemetryGrid>
        <div className="space-y-4 mb-6 mt-6">
          <AdvisorOutcomesPanel
            outcomes={outcomes}
            accent="yellow"
            title="GymAdvisor outcomes (30 days)"
            onRefresh={() => void load()}
            onSendReminders={() => void sendReminders()}
            remindersBusy={remindersBusy}
          />
          <AdvisorTodayBoard
            date={today}
            groups={todayGroups}
            title="Today's floor board"
            accentClass="border-yellow-200 dark:border-yellow-800"
            onMark={(id, status) => {
              void markBooking(id, status);
            }}
            markBusyId={markBusy}
          />
          <MemberSpecialDatesPanel
            rows={specialDates}
            hrefFor={(r) => `/dashboard/fitgraph/clients?open=${r.client_id}`}
          />
          <AdvisorRecallPanel
            rows={recalls}
            title="Member re-engagement"
            description="Members with no attended class in ~45 days (or never attended)."
            onBook={() => {
              window.location.href = '/dashboard/fitgraph/calendar';
            }}
          />
        </div>
        </>
      )}

      <div className="mt-8 space-y-3">
        <AdvisorSystemOverview module="fitgraph" />
        <FitgraphSystemFlow
          defaultCollapsed
          hasFrontDesk={summary?.hasFrontDesk !== false}
        />
      </div>

      <div className="my-8 grid sm:grid-cols-2 gap-3">
        {[
          {
            t: 'People · tenure · rates',
            b: 'Edit coaches, specialty catalogue, engagement history, pay rates and PDF contracts. Bulk load members via .xlsx.',
          },
          {
            t: 'Calendar · plan vs actual',
            b: 'One gym diary for all coaches: class plans, series, attendance, and B2C join links.',
          },
          {
            t: 'Feedback · reports',
            b: 'Members and coaches rate feel & intensity after class. Slice reports by date, coach, class and specialty — export CSV.',
          },
          {
            t: 'Website · contracts',
            b: 'Gym bio, public PDF contracts, branded embed and online booking for your own site.',
          },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-2xl border border-yellow-300 bg-yellow-50/50 px-4 py-3 dark:!border-yellow-400 dark:!bg-yellow-950 dark:ring-1 dark:ring-yellow-500/40"
          >
            <div className="text-sm font-black text-slate-900 dark:text-yellow-50">
              {x.t}
            </div>
            <p className="text-[12px] text-slate-600 dark:text-yellow-100/85 mt-1 leading-relaxed">
              {x.b}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-yellow-800/70 mb-4 dark:text-yellow-300/80">
          Workbenches
        </h2>
        <HubModuleGrid
          modules={hubModules(
            summary?.hasFrontDesk !== false,
            store?.settings?.class_subscribe === true
          )}
          uniformDark
        />
      </div>
    </FitgraphPage>
  );
}
