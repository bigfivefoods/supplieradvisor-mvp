'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Truck,
  Plus,
  Users,
  FileText,
  AlertTriangle,
  ArrowRight,
  Award,
  TrendingUp,
  Search,
  Handshake,
  Star,
  ShieldCheck,
  Loader2,
  Globe,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { otifefBand, trustBand } from '@/lib/suppliers/types';
import { CompanyRequired, SuppliersNav } from '@/components/suppliers/SuppliersShell';

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
  topSuppliers: Array<{ supplier_id: number; name: string; overall: number; total_pos: number }>;
};

const MODULES = [
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
    desc: 'Your book of suppliers — connected, preferred, prospects',
    badge: 'Core',
  },
  {
    href: '/dashboard/suppliers/add',
    icon: Plus,
    title: 'Add & invite',
    desc: 'Add off-platform suppliers; they claim and take over their profile',
    badge: 'Connect',
  },
  {
    href: '/dashboard/suppliers/invites',
    icon: Handshake,
    title: 'Invitations',
    desc: 'Track pending invites, resend, revoke',
  },
  {
    href: '/dashboard/suppliers/performance',
    icon: TrendingUp,
    title: 'OTIFEF performance',
    desc: 'On-Time · In-Full · Error-Free scorecards by supplier',
    badge: 'Live',
  },
  {
    href: '/dashboard/suppliers/ratings',
    icon: Star,
    title: 'Ratings & reviews',
    desc: 'Rate quality, delivery, communication, value after every PO',
  },
  {
    href: '/dashboard/suppliers/documents',
    icon: FileText,
    title: 'Shared documents',
    desc: 'Contracts, certs, SLAs — share in real time when connected',
  },
  {
    href: '/dashboard/suppliers/po',
    icon: Truck,
    title: 'Purchase orders',
    desc: 'Standard + on-chain escrow lifecycle, OTIFEF delivery capture, release funds',
    badge: 'Core',
  },
  {
    href: '/dashboard/suppliers/portal',
    icon: Globe,
    title: 'Ops board',
    desc: 'Command center for connect → buy → measure → rate',
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
] as const;

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
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <SuppliersNav />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Supplier relationship management
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-[-2px] text-slate-900">
            Find suppliers you can <span className="text-[#00b4d8]">trust</span>
          </h1>
          <p className="text-neutral-600 mt-2 max-w-2xl text-sm sm:text-base">
            Discover verified suppliers with rich metadata, connect on-chain, share documents in
            real time, invite partners off-platform, and run OTIFEF performance with peer ratings —
            one world-class SRM process.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/suppliers/discover" className="btn-primary !py-2.5 !px-5 text-sm">
            <Search className="w-4 h-4" /> Discover
          </Link>
          <Link href="/dashboard/suppliers/add" className="btn-secondary !py-2.5 !px-5 text-sm">
            <Plus className="w-4 h-4" /> Add supplier
          </Link>
        </div>
      </div>

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
          {warning.includes('srm_suppliers') || warning.includes('does not exist') ? (
            <span className="block text-xs mt-1 opacity-80">
              Run <code className="font-mono">20260709_srm_supplier_module.sql</code> in Supabase.
            </span>
          ) : null}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-8">
        <Kpi
          icon={Users}
          label="In my book"
          value={loading ? '—' : String(summary?.total ?? 0)}
          hint="Prospects + active"
        />
        <Kpi
          icon={Handshake}
          label="Connected"
          value={loading ? '—' : String(summary?.connected ?? 0)}
          hint="On-platform edges"
          tone="emerald"
        />
        <Kpi
          icon={Globe}
          label="Pending invites"
          value={loading ? '—' : String(summary?.invitePending ?? 0)}
          hint="Awaiting claim"
          tone="sky"
        />
        <Kpi
          icon={ShieldCheck}
          label="Verified"
          value={loading ? '—' : String(summary?.verified ?? 0)}
          hint="In network"
        />
        <Kpi
          icon={TrendingUp}
          label="Avg trust"
          value={loading ? '—' : `${summary?.avgTrust ?? 0}`}
          hint={trust.label}
          tone="indigo"
        />
        <Kpi
          icon={AlertTriangle}
          label="Open RIADs"
          value={loading ? '—' : String(summary?.openRiads ?? 0)}
          hint="Supply-base risks"
          tone="amber"
        />
      </div>

      {/* OTIFEF hero */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-xl tracking-tight">
              Portfolio OTIFEF <span className="text-emerald-600">performance</span>
            </h2>
            <p className="text-sm text-neutral-500">
              Last 12 months · On-Time × In-Full × Error-Free
            </p>
          </div>
          <Link
            href="/dashboard/suppliers/performance"
            className="text-sm text-[#00b4d8] flex items-center gap-1 hover:underline"
          >
            Full scorecards <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl border p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl border border-neutral-200 p-6 relative overflow-hidden">
              <div className="text-xs font-medium text-neutral-500 mb-2">OVERALL OTIFEF</div>
              <div className="font-black text-5xl tracking-tighter mb-2">
                {(ot?.overall ?? 0).toFixed(1)}
                <span className="text-2xl">%</span>
              </div>
              <span className={`inline-flex text-xs font-bold px-3 py-1 rounded-full ${band.className}`}>
                {band.label}
              </span>
              <div className="text-xs text-neutral-500 mt-3">
                {ot?.totalPOs ?? 0} POs · {ot?.supplierCount ?? 0} suppliers
              </div>
            </div>
            <MetricCard label="On time" value={ot?.onTime ?? 0} hint="Delivered by promised date" />
            <MetricCard label="In full" value={ot?.inFull ?? 0} hint="Quantity accuracy" />
            <MetricCard label="Error free" value={ot?.errorFree ?? 0} hint="Damage-free rate" />
          </div>
        )}

        {!loading && summary?.topSuppliers && summary.topSuppliers.length > 0 && (
          <div className="mt-4 bg-white rounded-3xl border divide-y">
            <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Top OTIFEF suppliers (12m)
            </div>
            {summary.topSuppliers.map((s) => (
              <div
                key={s.supplier_id}
                className="px-5 py-3 flex items-center justify-between text-sm"
              >
                <span className="font-medium text-slate-900">{s.name}</span>
                <span className="font-black text-[#00b4d8]">{s.overall.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modules */}
      <h2 className="font-bold text-xl tracking-tight mb-4">SRM workspace</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className="group bg-white border border-neutral-200 rounded-3xl p-6 hover:border-[#00b4d8] hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-neutral-100 rounded-2xl group-hover:bg-[#00b4d8] group-hover:text-white transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  {'badge' in m && m.badge && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#00b4d8]/10 text-[#0077b6]">
                      {m.badge}
                    </span>
                  )}
                  <ArrowRight className="w-5 h-5 text-neutral-300 group-hover:text-[#00b4d8]" />
                </div>
              </div>
              <h3 className="font-bold text-lg tracking-tight mb-1">{m.title}</h3>
              <p className="text-sm text-neutral-600">{m.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'slate',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone?: 'slate' | 'emerald' | 'sky' | 'indigo' | 'amber';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-neutral-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    sky: 'bg-sky-100 text-sky-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    amber: 'bg-amber-100 text-amber-800',
  };
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4">
      <div className={`inline-flex p-2 rounded-xl mb-2 ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-black tracking-tight">{value}</div>
      <div className="text-xs font-medium text-slate-700">{label}</div>
      <div className="text-[11px] text-neutral-500 mt-0.5">{hint}</div>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="bg-white rounded-3xl border border-neutral-200 p-6">
      <div className="text-xs font-medium text-neutral-500 mb-2 uppercase">{label}</div>
      <div className="font-black text-4xl tracking-tighter mb-1">
        {value.toFixed(1)}
        <span className="text-xl">%</span>
      </div>
      <div className="text-xs text-neutral-500">{hint}</div>
    </div>
  );
}
