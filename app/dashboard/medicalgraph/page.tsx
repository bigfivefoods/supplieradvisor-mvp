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
  Hospital,
  UserRound,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  MedicalgraphPage,
  MedicalgraphRequired,
} from '@/components/clinic/MedicalgraphShell';
import MedicalgraphSystemFlow from '@/components/clinic/MedicalgraphSystemFlow';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';

const MODULES: HubModule[] = [
  {
    href: '/dashboard/medicalgraph/practitioners',
    icon: Hospital,
    code: '01',
    title: 'Practitioners',
    desc: 'GPs, specialists, nurses — disciplines, rates, bios.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/medicalgraph/patients',
    icon: Users,
    code: '02',
    title: 'Patients',
    desc: 'Patient register, status, assigned practitioner.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/medicalgraph/services',
    icon: HeartPulse,
    code: '03',
    title: 'Services',
    desc: 'Assessments, treatments, home visits — duration & price.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/medicalgraph/packages',
    icon: CreditCard,
    code: '04',
    title: 'Packages',
    desc: 'Rehab packs and multi-session bundles.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/medicalgraph/calendar',
    icon: CalendarDays,
    code: '05',
    title: 'Calendar',
    desc: 'Schedule appointments and assign practitioners.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/medicalgraph/bookings',
    icon: ClipboardCheck,
    code: '06',
    title: 'Bookings',
    desc: 'Book patients onto appointments; mark attended.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/medicalgraph/messages',
    icon: MessageSquare,
    code: '07',
    title: 'Messages',
    desc: 'Desk · practitioners · patients — care and team threads.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
  {
    href: '/dashboard/medicalgraph/website',
    icon: Globe,
    code: '08',
    title: 'Website',
    desc: 'Public clinic profile, booking settings, embed token.',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/medicalgraph/report',
    icon: Sparkles,
    code: '09',
    title: 'Reports',
    desc: 'Practitioners, patients, appointments utilisation.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
];

export default function MedicalgraphHubPage() {
  return (
    <MedicalgraphRequired>
      <Inner />
    </MedicalgraphRequired>
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
        `/api/clinic/medicalgraph?companyId=${companyId}`,
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
      const res = await fetch('/api/clinic/medicalgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'seed_demo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      setSummary(data.summary || null);
      toast.success('Demo clinic loaded — practitioners, patients, diary');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <MedicalgraphPage>
      <RelationshipHeader
        eyebrow="Tertiary · Services · Medical practice"
        title="MedicalAdvisor"
        titleAccent="®"
        description="Medical practice OS for GPs and clinics: practitioners, patients, consults, care packages, diary, bookings, portal and website."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/medicalgraph/calendar"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <CalendarDays className="w-4 h-4" /> Diary
            </Link>
            <Link
              href="/dashboard/medicalgraph/website"
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

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (
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
        <MedicalgraphSystemFlow />
      </div>

      <div className="my-8 grid sm:grid-cols-2 gap-3">
        {[
          {
            t: 'Practitioners · disciplines',
            b: 'Register physios and allied health, set rates, assign disciplines, and keep bios for the clinic website.',
          },
          {
            t: 'Patients · packages',
            b: 'Patient register with status, assigned practitioner, and multi-session rehab packs.',
          },
          {
            t: 'Diary · bookings',
            b: 'Schedule assessments and treatments, book patients, mark attended or no-show.',
          },
          {
            t: 'Website · reports',
            b: 'Publish clinic profile and diary settings; review utilisation by practitioner and service.',
          },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-2xl border border-emerald-300 bg-emerald-50/50 px-4 py-3 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40"
          >
            <div className="text-sm font-black text-slate-900 dark:text-emerald-50">
              {x.t}
            </div>
            <p className="text-[12px] text-slate-600 dark:text-emerald-100/85 mt-1 leading-relaxed">
              {x.b}
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-black uppercase tracking-widest text-emerald-800/70 dark:text-emerald-200 mb-4">
        Workbenches
      </h2>
      <HubModuleGrid modules={MODULES} />
    </MedicalgraphPage>
  );
}
