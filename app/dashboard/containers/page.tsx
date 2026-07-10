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
  ArrowRight,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import {
  KpiCard,
  ModuleGrid,
  Panel,
  RelationshipHeader,
  SectionLabel,
  type ModuleCard,
} from '@/components/relationship/RelationshipChrome';

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

const PROCESS = [
  {
    label: 'Add',
    href: '/dashboard/containers/add',
    desc: 'Onboard a retail outlet to the network.',
  },
  {
    label: 'Map',
    href: '/dashboard/containers/map',
    desc: 'Pin GPS so stock and sales attach to a place.',
  },
  {
    label: 'Contractors',
    href: '/dashboard/containers/contractors',
    desc: 'Appoint independent operators.',
  },
  {
    label: 'Train',
    href: '/dashboard/containers/training',
    desc: 'Certify operators before go-live.',
  },
  {
    label: 'Stock',
    href: '/dashboard/containers/manage',
    desc: 'Order, receive, and manage outlet inventory.',
  },
  {
    label: 'RIAD',
    href: '/dashboard/containers/riad-log',
    desc: 'Log risk, issues, actions, decisions.',
  },
  {
    label: 'Metrics',
    href: '/dashboard/containers/metrics',
    desc: 'Performance of the outlet network.',
  },
];

const MODULES: ModuleCard[] = [
  {
    href: '/dashboard/containers/manage',
    icon: Edit3,
    title: 'Manage containers',
    desc: 'Create, edit, search, and delete retail outlets — full CRUD',
    badge: 'Core',
  },
  {
    href: '/dashboard/containers/map',
    icon: Map,
    title: 'Live map',
    desc: 'Every outlet on a map with GPS pins and contractor status',
    badge: 'Live',
  },
  {
    href: '/dashboard/containers/add',
    icon: Plus,
    title: 'Add container',
    desc: 'Onboard a new retail container and pin its location',
  },
  {
    href: '/dashboard/containers/contractors',
    icon: Users,
    title: 'Contractors',
    desc: 'Appoint operators, VerifyNow ID checks, banking, and invites',
    badge: 'Core',
  },
  {
    href: '/dashboard/containers/training',
    icon: GraduationCap,
    title: 'Training hub',
    desc: 'Monitor contractor training and certification status',
  },
  {
    href: '/dashboard/containers/manage',
    icon: Boxes,
    title: 'Inventory & orders',
    desc: 'Open an outlet to order, receive, and track stock',
  },
  {
    href: '/dashboard/containers/riad-log',
    icon: Scale,
    title: 'Container RIAD',
    desc: 'Risks, issues, actions & decisions — shared with operators',
  },
  {
    href: '/dashboard/containers/metrics',
    icon: BarChart3,
    title: 'Network metrics',
    desc: 'Pulse across outlets, contractors, and coverage',
  },
  {
    href: '/dashboard/containers/contractors',
    icon: ShieldCheck,
    title: 'Verify contractors',
    desc: 'SA ID documents and VerifyNow Home Affairs checks',
  },
];

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

  return (
    <ContainersPage>
      <RelationshipHeader
        eyebrow="Container retail network"
        title="Containers you can"
        titleAccent="operate"
        description="Retail outlets run by independent contractors — map locations, appoint & train operators, order and receive stock, RIAD register, and manage payouts in one light command surface."
        action={
          <>
            <Link
              href="/dashboard/containers/add"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Plus className="w-4 h-4" /> Add container
            </Link>
            <Link
              href="/dashboard/containers/manage"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <Edit3 className="w-4 h-4" /> Manage
            </Link>
          </>
        }
      />

      <SectionLabel>Pulse</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <KpiCard
          icon={Package}
          label="Outlets"
          value={summary?.total ?? 0}
          sub={`${summary?.active ?? 0} active`}
          href="/dashboard/containers/manage"
          loading={loading}
          tone="cyan"
        />
        <KpiCard
          icon={MapPin}
          label="Mapped"
          value={summary?.mapped ?? 0}
          sub={`${summary?.unmapped ?? 0} need GPS`}
          href="/dashboard/containers/map"
          loading={loading}
          tone={(summary?.unmapped || 0) > 0 ? 'amber' : 'emerald'}
        />
        <KpiCard
          icon={Users}
          label="Contractors"
          value={summary?.contractors ?? 0}
          sub={`${summary?.contractorsVerified ?? 0} verified`}
          href="/dashboard/containers/contractors"
          loading={loading}
        />
        <KpiCard
          icon={UserCheck}
          label="Staffed outlets"
          value={summary?.withContractor ?? 0}
          sub="Have an operator"
          href="/dashboard/containers/contractors"
          loading={loading}
          tone="emerald"
        />
        <KpiCard
          icon={GraduationCap}
          label="Certified"
          value={summary?.trainingCertified ?? 0}
          sub={`${summary?.trainingPending ?? 0} pending train`}
          href="/dashboard/containers/training"
          loading={loading}
          tone="violet"
        />
        <KpiCard
          icon={AlertTriangle}
          label="RIAD register"
          value="Open"
          sub="Risks · issues · actions"
          href="/dashboard/containers/riad-log"
          tone="amber"
        />
      </div>

      <SectionLabel
        action={
          <Link
            href="/dashboard/containers/map"
            className="text-xs font-semibold text-[#00b4d8] hover:underline inline-flex items-center gap-1"
          >
            Open map <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
      >
        Workspace
      </SectionLabel>
      <ModuleGrid modules={MODULES} />

      <div className="mt-10">
        <Panel title="Operating principle">
          <div className="px-5 py-6 sm:px-8 sm:py-8 grid sm:grid-cols-3 gap-6 text-sm">
            <Principle
              n="01"
              title="Locate every outlet"
              body="GPS-mapped containers are the foundation of stock, sales, and contractor allocation."
            />
            <Principle
              n="02"
              title="Operator ownership"
              body="Independent contractors claim outlets, train, and run day-to-day sales with clear verification."
            />
            <Principle
              n="03"
              title="Close the loop"
              body="RIAD, training, and metrics keep the network visible — one language with CRM and SRM."
            />
          </div>
        </Panel>
      </div>
    </ContainersPage>
  );
}

function Principle({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] font-black tracking-[0.2em] text-[#00b4d8] mb-2">{n}</div>
      <div className="font-bold text-slate-800 mb-1.5">{title}</div>
      <p className="text-xs text-neutral-500 leading-relaxed">{body}</p>
    </div>
  );
}
