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
  Stethoscope,
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
    desc: 'Schedule appointments and assign staff.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/dentalgraph/bookings',
    icon: ClipboardCheck,
    code: '06',
    title: 'Bookings',
    desc: 'Book patients onto appointments; mark attended.',
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
    title: 'Reports',
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
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

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
            b: 'Patient register with status, assigned clinician, and multi-session care plans.',
          },
          {
            t: 'Diary · bookings',
            b: 'Schedule assessments and treatments, book patients, mark attended or no-show.',
          },
          {
            t: 'Website · reports',
            b: 'Publish practice profile and diary settings; review utilisation by clinician and service.',
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
