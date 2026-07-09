'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Truck,
  Plus,
  Users,
  FileText,
  AlertTriangle,
  Award,
  TrendingUp,
  Search,
  Handshake,
  Star,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { otifefBand, trustBand } from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersNav,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import {
  AlertBanner,
  KpiCard,
  MetricHero,
  ModuleGrid,
  Panel,
  ProcessRail,
  RelationshipHeader,
  SectionLabel,
  type ModuleCard,
} from '@/components/relationship/RelationshipChrome';

type Summary = {
  total: number;
  active: number;
  preferred: number;
  connected: number;
  invited: number;
  invitePending: number;
  verified: number;
  openRiads: number;
  avgTrust: number;
  otifef: {
    overall: number;
    onTime: number;
    inFull: number;
    errorFree: number;
    totalPOs: number;
    supplierCount: number;
  };
  topSuppliers: Array<{
    supplier_id: number;
    name: string;
    overall: number;
    total_pos: number;
  }>;
};

const PROCESS = [
  { label: 'Discover', href: '/dashboard/suppliers/discover' },
  { label: 'Invite', href: '/dashboard/suppliers/add' },
  { label: 'Connect', href: '/dashboard/suppliers/network' },
  { label: 'PO', href: '/dashboard/suppliers/po' },
  { label: 'Escrow', href: '/dashboard/suppliers/po' },
  { label: 'OTIFEF', href: '/dashboard/suppliers/performance' },
  { label: 'Rate', href: '/dashboard/suppliers/ratings' },
];

const MODULES: ModuleCard[] = [
  {
    href: '/dashboard/suppliers/discover',
    icon: Search,
    title: 'Discover trusted suppliers',
    desc: 'Deep metadata search — location, industry, certifications, trust & OTIFEF',
    badge: 'Trust',
  },
  {
    href: '/dashboard/suppliers/network',
    icon: Users,
    title: 'My supplier network',
    desc: 'Your book — prospects, preferred, connected partners',
    badge: 'Core',
  },
  {
    href: '/dashboard/suppliers/add',
    icon: Plus,
    title: 'Add & invite',
    desc: 'Add off-platform suppliers; they claim and take over',
    badge: 'Connect',
  },
  {
    href: '/dashboard/suppliers/invites',
    icon: Handshake,
    title: 'Invitations',
    desc: 'Pending, resend, revoke — full invite lifecycle',
  },
  {
    href: '/dashboard/suppliers/po',
    icon: Truck,
    title: 'Purchase orders',
    desc: 'Standard + on-chain escrow, delivery capture, release funds',
    badge: 'Core',
  },
  {
    href: '/dashboard/suppliers/performance',
    icon: TrendingUp,
    title: 'OTIFEF performance',
    desc: 'On-Time · In-Full · Error-Free scorecards',
    badge: 'Live',
  },
  {
    href: '/dashboard/suppliers/ratings',
    icon: Star,
    title: 'Ratings & reviews',
    desc: 'Quality, delivery, communication, value after every PO',
  },
  {
    href: '/dashboard/suppliers/documents',
    icon: FileText,
    title: 'Shared documents',
    desc: 'Contracts, certs, SLAs — share when connected',
  },
  {
    href: '/dashboard/suppliers/portal',
    icon: Globe,
    title: 'Ops board',
    desc: 'Command center: connect → buy → measure → rate',
  },
  {
    href: '/dashboard/suppliers/contracts',
    icon: Award,
    title: 'Contracts',
    desc: 'Supply agreements and commercial terms',
  },
  {
    href: '/dashboard/suppliers/riad-log',
    icon: AlertTriangle,
    title: 'Supplier RIAD',
    desc: 'Risks, issues, actions, decisions across the supply base',
  },
];

export default function SuppliersHubPage() {
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
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/summary?companyId=${companyId}`);
      const data = await res.json();
      setSummary(data.summary || null);
      setWarning(data.warning || null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ot = summary?.otifef;
  const band = otifefBand(ot?.overall || 0);
  const trust = trustBand(summary?.avgTrust || 0);

  return (
    <SuppliersPage>
      <RelationshipHeader
        nav={<SuppliersNav />}
        eyebrow="Supplier relationship management"
        title="Suppliers you can"
        titleAccent="trust"
        description="Discover verified partners, connect on-chain, share documents in real time, invite off-platform suppliers who take over their profile, and run OTIFEF with peer ratings — one precision SRM process."
        action={
          <>
            <Link href="/dashboard/suppliers/discover" className="btn-primary !py-2.5 !px-5 text-sm">
              <Search className="w-4 h-4" /> Discover
            </Link>
            <Link href="/dashboard/suppliers/add" className="btn-secondary !py-2.5 !px-5 text-sm">
              <Plus className="w-4 h-4" /> Add supplier
            </Link>
          </>
        }
      />

      {warning && (
        <AlertBanner>
          {warning}
          {(warning.includes('srm_suppliers') || warning.includes('does not exist')) && (
            <span className="block text-xs mt-1 opacity-80">
              Run <code className="font-mono">20260709_srm_supplier_module.sql</code> in Supabase.
            </span>
          )}
        </AlertBanner>
      )}

      <SectionLabel>Lifecycle</SectionLabel>
      <ProcessRail steps={PROCESS} />

      <SectionLabel>Pulse</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <KpiCard
          icon={Users}
          label="In my book"
          value={summary?.total ?? 0}
          sub="Prospects + active"
          href="/dashboard/suppliers/network"
          loading={loading}
        />
        <KpiCard
          icon={Handshake}
          label="Connected"
          value={summary?.connected ?? 0}
          sub="On-platform edges"
          href="/dashboard/suppliers/network"
          tone="emerald"
          loading={loading}
        />
        <KpiCard
          icon={Globe}
          label="Pending invites"
          value={summary?.invitePending ?? 0}
          sub="Awaiting claim"
          href="/dashboard/suppliers/invites"
          tone={(summary?.invitePending || 0) > 0 ? 'amber' : 'cyan'}
          loading={loading}
        />
        <KpiCard
          icon={ShieldCheck}
          label="Verified"
          value={summary?.verified ?? 0}
          sub="In network"
          tone="cyan"
          loading={loading}
        />
        <KpiCard
          icon={TrendingUp}
          label="Avg trust"
          value={summary?.avgTrust ?? 0}
          sub={trust.label}
          href="/dashboard/suppliers/performance"
          tone="violet"
          loading={loading}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Open RIADs"
          value={summary?.openRiads ?? 0}
          sub="Supply-base risks"
          href="/dashboard/suppliers/riad-log"
          tone={(summary?.openRiads || 0) > 0 ? 'amber' : 'neutral'}
          loading={loading}
        />
      </div>

      <SectionLabel
        action={
          <Link
            href="/dashboard/suppliers/performance"
            className="text-xs font-semibold text-[#00b4d8] hover:underline"
          >
            Full scorecards →
          </Link>
        }
      >
        Portfolio OTIFEF
      </SectionLabel>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <MetricHero
          label="Overall OTIFEF"
          value={loading ? '—' : (ot?.overall ?? 0).toFixed(1)}
          unit="%"
          icon={TrendingUp}
          badge={
            <span className={`inline-flex text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${band.className}`}>
              {band.label}
            </span>
          }
          hint={`${ot?.totalPOs ?? 0} POs · ${ot?.supplierCount ?? 0} suppliers · 12 months`}
        />
        <KpiCard
          icon={Truck}
          label="On time"
          value={loading ? '—' : `${(ot?.onTime ?? 0).toFixed(1)}%`}
          sub="By promised date"
          loading={loading}
        />
        <KpiCard
          icon={FileText}
          label="In full"
          value={loading ? '—' : `${(ot?.inFull ?? 0).toFixed(1)}%`}
          sub="Quantity accuracy"
          loading={loading}
        />
        <KpiCard
          icon={Award}
          label="Error free"
          value={loading ? '—' : `${(ot?.errorFree ?? 0).toFixed(1)}%`}
          sub="Damage-free rate"
          loading={loading}
        />
      </div>

      {!loading && summary?.topSuppliers && summary.topSuppliers.length > 0 && (
        <Panel title="Top OTIFEF suppliers" className="mb-10">
          <ul className="divide-y divide-neutral-100">
            {summary.topSuppliers.map((s, i) => (
              <li
                key={s.supplier_id}
                className="px-5 py-3.5 flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-black text-neutral-300 w-5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-semibold text-slate-900 truncate">{s.name}</span>
                  <span className="text-[11px] text-neutral-400">{s.total_pos} POs</span>
                </div>
                <span className="font-black text-[#00b4d8] tabular-nums">
                  {s.overall.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <SectionLabel
        action={
          <Link
            href="/dashboard/suppliers/portal"
            className="text-xs font-semibold text-[#00b4d8] hover:underline"
          >
            Open ops board →
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
              title="Trust is measurable"
              body="OTIFEF, peer ratings, and verification compose a living trust score — not a gut feel."
            />
            <Principle
              n="02"
              title="Connect on-chain when it matters"
              body="Standard POs for speed; POEscrowV2 create → fund → release when capital must be locked."
            />
            <Principle
              n="03"
              title="Invite, then hand over"
              body="Add any supplier offline. They claim, verify, and take ownership — your edge stays live."
            />
          </div>
        </Panel>
      </div>
    </SuppliersPage>
  );
}

function Principle({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] font-black tracking-[0.2em] text-[#00b4d8] mb-2">{n}</div>
      <div className="font-bold text-slate-900 mb-1.5">{title}</div>
      <p className="text-xs text-neutral-500 leading-relaxed">{body}</p>
    </div>
  );
}
