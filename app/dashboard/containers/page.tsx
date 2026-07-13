'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Map,
  Users,
  Edit3,
  Boxes,
  GraduationCap,
  BarChart3,
  Scale,
  ShieldCheck,
  MapPin,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Share2,
  Heart,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import {
  HubHero,
  HubModuleGrid,
  HubPrinciples,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';

type Summary = {
  total: number;
  active: number;
  mapped: number;
  unmapped: number;
  withContractor: number;
  contractors: number;
  contractorsVerified: number;
  trainingCertified: number;
  trainingPending: number;
};

export default function ContainersHub() {
  return (
    <CompanyRequired>
      <HubInner />
    </CompanyRequired>
  );
}

function HubInner() {
  const companyId = getSelectedCompanyId()!;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, tRes] = await Promise.all([
        fetch(`/api/containers?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/containers/contractors?companyId=${companyId}`).then((r) => r.json()),
      ]);
      const containers = (cRes.containers || []) as Array<{
        status?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        contractor_id?: number | null;
        assigned_contractor?: string | null;
      }>;
      const contractors = (tRes.contractors || []) as Array<{
        training_status?: string | null;
        verification_status?: string | null;
      }>;

      const mapped = containers.filter(
        (c) => c.latitude != null && c.longitude != null
      ).length;
      const withContractor = containers.filter(
        (c) => c.contractor_id || c.assigned_contractor
      ).length;
      const active = containers.filter(
        (c) =>
          !c.status ||
          ['active', 'deployed', 'operational', 'open'].includes(
            String(c.status).toLowerCase()
          )
      ).length;

      setSummary({
        total: containers.length,
        active,
        mapped,
        unmapped: containers.length - mapped,
        withContractor,
        contractors: contractors.length,
        contractorsVerified: contractors.filter(
          (c) => String(c.verification_status || '').toLowerCase() === 'verified'
        ).length,
        trainingCertified: contractors.filter(
          (c) => c.training_status === 'certified'
        ).length,
        trainingPending: contractors.filter(
          (c) => !c.training_status || c.training_status === 'pending'
        ).length,
      });
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = summary;

  const modules: HubModule[] = [
    {
      href: '/dashboard/containers/manage',
      icon: Edit3,
      code: '01',
      title: 'Manage containers',
      desc: 'Create, edit, search, and delete retail outlets — full CRUD.',
      accent: 'from-violet-50 to-white border-violet-100',
      metric: s?.total ?? '—',
      metricLabel: 'outlets',
    },
    {
      href: '/dashboard/containers/map',
      icon: Map,
      code: '02',
      title: 'Live map',
      desc: 'People fed, jobs created, or outlet pins — switch modes on the map.',
      accent: 'from-sky-50 to-white border-sky-100',
      metric: s?.mapped ?? '—',
      metricLabel: 'mapped',
    },
    {
      href: '/dashboard/containers/impact',
      icon: Heart,
      code: '03',
      title: 'Food security & jobs',
      desc: 'Jobs per container and people fed from food sales — report + assumptions.',
      accent: 'from-emerald-50 to-white border-emerald-100',
    },
    {
      href: '/dashboard/containers/add',
      icon: Plus,
      code: '04',
      title: 'Add container',
      desc: 'Onboard a new retail container and pin its location.',
      accent: 'from-cyan-50 to-white border-cyan-100',
    },
    {
      href: '/dashboard/containers/contractors',
      icon: Users,
      code: '05',
      title: 'Contractors',
      desc: 'Appoint operators, VerifyNow ID checks, banking, and invites.',
      accent: 'from-emerald-50 to-white border-emerald-100',
      metric: s?.contractors ?? '—',
      metricLabel: 'operators',
    },
    {
      href: '/dashboard/containers/training',
      icon: GraduationCap,
      code: '06',
      title: 'Training hub',
      desc: 'Monitor contractor training and certification status.',
      accent: 'from-amber-50 to-white border-amber-100',
      metric: s?.trainingCertified ?? '—',
      metricLabel: 'certified',
    },
    {
      href: '/dashboard/containers/manage',
      icon: Boxes,
      code: '07',
      title: 'Inventory & orders',
      desc: 'Open an outlet to order, receive, and track stock.',
      accent: 'from-rose-50 to-white border-rose-100',
    },
    {
      href: '/dashboard/containers/riad-log',
      icon: Scale,
      code: '08',
      title: 'Container RIAD',
      desc: 'Risks, issues, actions & decisions — shared with operators.',
      accent: 'from-violet-50 to-white border-violet-100',
    },
    {
      href: '/dashboard/containers/metrics',
      icon: BarChart3,
      code: '09',
      title: 'Network metrics',
      desc: 'Pulse across outlets, contractors, and coverage.',
      accent: 'from-slate-50 to-white border-slate-200',
    },
    {
      href: '/dashboard/containers/settings',
      icon: Share2,
      code: '10',
      title: 'Share on website',
      desc: 'Embed live map + metrics on bigfivegroup.africa (public link / iframe).',
      accent: 'from-violet-50 to-white border-violet-100',
    },
    {
      href: '/dashboard/containers/contractors',
      icon: ShieldCheck,
      code: '11',
      title: 'Verify contractors',
      desc: 'SA ID documents and VerifyNow Home Affairs checks.',
      accent: 'from-sky-50 to-white border-sky-100',
    },
  ];

  return (
    <ContainersPage>
      <ContainersHeader
        title="Containers"
        titleAccent="Command"
        description="Retail outlets run by independent contractors — map impact (people fed & jobs), appoint & train operators, order stock, RIAD, and payouts. Share the public map from Settings."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/containers/impact"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Heart className="w-4 h-4" />
              Food security & jobs
            </Link>
            <Link
              href="/dashboard/containers/settings"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share on website
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link href="/dashboard/containers/add" className="btn-secondary !py-2.5 !px-5 text-sm">
              <Plus className="w-4 h-4" /> Add container
            </Link>
          </div>
        }
      />

      <HubHero
        pill="Live retail · impact · operate"
        title="Locate every outlet."
        description="GPS-mapped containers show food security and jobs impact by area. Operators claim, train, and log sales so people-fed and jobs metrics stay real."
        stats={[
          {
            label: 'Outlets',
            value: loading ? '—' : s?.total ?? 0,
            valueClass: 'text-[#00b4d8]',
          },
          {
            label: 'Mapped',
            value: loading ? '—' : s?.mapped ?? 0,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Staffed',
            value: loading ? '—' : s?.withContractor ?? 0,
            valueClass: 'text-amber-600',
          },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="Outlets"
          value={s?.total ?? 0}
          sub={`${s?.active ?? 0} active`}
          accent="cyan"
          icon={Package}
          href="/dashboard/containers/manage"
        />
        <TelemetryCard
          label="Mapped"
          value={s?.mapped ?? 0}
          sub={`${s?.unmapped ?? 0} need GPS`}
          accent={(s?.unmapped || 0) > 0 ? 'amber' : 'emerald'}
          icon={MapPin}
          href="/dashboard/containers/map"
        />
        <TelemetryCard
          label="Contractors"
          value={s?.contractors ?? 0}
          sub={`${s?.contractorsVerified ?? 0} verified`}
          accent="violet"
          icon={Users}
          href="/dashboard/containers/contractors"
        />
        <TelemetryCard
          label="Staffed outlets"
          value={s?.withContractor ?? 0}
          sub="Have an operator"
          accent="emerald"
          icon={UserCheck}
          href="/dashboard/containers/contractors"
        />
        <TelemetryCard
          label="Certified"
          value={s?.trainingCertified ?? 0}
          sub={`${s?.trainingPending ?? 0} pending train`}
          accent="sky"
          icon={GraduationCap}
          href="/dashboard/containers/training"
        />
        <TelemetryCard
          label="RIAD register"
          value="Open"
          sub="Risks · issues · actions"
          accent="amber"
          icon={AlertTriangle}
          href="/dashboard/containers/riad-log"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={modules} />

      <HubPrinciples
        items={[
          {
            title: 'Locate every outlet',
            body: 'GPS-mapped containers are the foundation of stock, sales, and contractor allocation.',
          },
          {
            title: 'Operator ownership',
            body: 'Independent contractors claim outlets, train, and run day-to-day sales with clear verification.',
          },
          {
            title: 'Close the loop',
            body: 'RIAD, training, and metrics keep the network visible — one language with CRM and SRM.',
          },
        ]}
      />
    </ContainersPage>
  );
}
