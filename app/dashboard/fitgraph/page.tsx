'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
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
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';

function hubModules(hasFrontDesk: boolean): HubModule[] {
  return [
  {
    href: '/dashboard/fitgraph/coaches',
    icon: UserRound,
    code: '01',
    title: 'Coaches',
    desc: 'Trainers, specialties, coach portal links to share classes.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/fitgraph/coach-calendar',
    icon: CalendarDays,
    code: '01b',
    title: 'Coach calendar',
    desc: 'Per-coach plan, actual attendance, bespoke & weekly series.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/fitgraph/clients',
    icon: Users,
    code: '02',
    title: 'Clients / members',
    desc: 'Member book, membership status, assigned coach.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/fitgraph/memberships',
    icon: CreditCard,
    code: '03',
    title: 'Membership plans',
    desc: 'Unlimited, packs, pricing and class/PT credits.',
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
    desc: 'HIIT, strength, yoga — capacity and default duration.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/fitgraph/calendar',
    icon: CalendarDays,
    code: '06',
    title: 'Calendar',
    desc: 'Schedule coaches onto sessions; publish to website.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
  {
    href: '/dashboard/fitgraph/bookings',
    icon: ClipboardCheck,
    code: '07',
    title: 'Bookings',
    desc: 'Book members into classes; auto-waitlist when full.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/fitgraph/checkins',
    icon: Sparkles,
    code: '08',
    title: 'Check-ins',
    desc: hasFrontDesk
      ? 'Front-desk and class attendance log.'
      : 'Coach or portal attendance log (no front desk).',
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
    title: 'Website & ops',
    desc: 'Front desk vs coach-led ops model, public calendar, embed, contracts.',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/fitgraph/report',
    icon: Package,
    code: '11',
    title: 'Reports',
    desc: 'Slice & dice: coaches, classes, plan vs actual, feedback, members.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
];
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
  const [summary, setSummary] = useState<Record<string, number | boolean> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fitness/fitgraph?companyId=${companyId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSummary(data.summary || null);
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
        body: JSON.stringify({ companyId, action: 'seed_demo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      setSummary(data.summary || null);
      toast.success('Demo gym loaded — coaches, classes, subscriptions, public calendar');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <FitgraphPage>
      <RelationshipHeader
        eyebrow="Tertiary · Services · Fitness & wellness"
        title="FitAdvisor"
        titleAccent="®"
        description="Gym services OS: coaches with tenure, rates and contracts; members (incl. .xlsx); plan vs actual; post-class feedback; website embed; slice-and-dice reports."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/fitgraph/website"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Globe className="w-4 h-4" /> Website
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

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : (
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
          <TelemetryCard
            label="Sessions today"
            value={String(summary?.sessionsToday ?? 0)}
            sub={`${summary?.publicSessionsUpcoming ?? 0} public upcoming`}
          />
          <TelemetryCard
            label="Ops model"
            value={summary?.hasFrontDesk === false ? 'Coach-led' : 'Front desk'}
            sub={
              summary?.websiteEnabled
                ? summary?.publicBooking
                  ? 'Website live · booking on'
                  : 'Website live'
                : 'Set under Website'
            }
          />
        </HubTelemetryGrid>
      )}

      <div className="mt-8">
        <FitgraphSystemFlow
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
            b: 'Schedule coaches, class plans and series; mark who came vs planned; B2C join links for members.',
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
            className="rounded-2xl border border-violet-300 bg-violet-50/50 px-4 py-3 dark:!border-violet-400 dark:!bg-violet-950 dark:ring-1 dark:ring-violet-500/40"
          >
            <div className="text-sm font-black text-slate-900 dark:text-violet-50">
              {x.t}
            </div>
            <p className="text-[12px] text-slate-600 dark:text-violet-100/85 mt-1 leading-relaxed">
              {x.b}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-violet-800/70 mb-4 dark:text-violet-300/80">
          Workbenches
        </h2>
        <HubModuleGrid
          modules={hubModules(summary?.hasFrontDesk !== false)}
          uniformDark
        />
      </div>
    </FitgraphPage>
  );
}
