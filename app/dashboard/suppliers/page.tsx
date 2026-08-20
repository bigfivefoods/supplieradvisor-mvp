'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
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
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';
import { AdvisorMemberAppInvite } from '@/components/b2c/AdvisorMemberAppInvite';
import { otifefBand, trustBand } from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import {
  AlertBanner,
  RelationshipHeader,
} from '@/components/relationship/RelationshipChrome';
import {
  HubHero,
  HubModuleGrid,
  HubPrinciples,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import JourneyChecklist from '@/components/journey/JourneyChecklist';
import TradeNextBanner from '@/components/journey/TradeNextBanner';
import { computeHubNextAction } from '@/lib/connections/next-action';
import CatalogueEmptyBanner from '@/components/business/CatalogueEmptyBanner';

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

export default function SuppliersHubPage() {
  return (
    <CompanyRequired>
      <HubInner />
    </CompanyRequired>
  );
}

function HubInner() {
  const companyId = getSelectedCompanyId()!;
  const { user, ready } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [openInboundPos, setOpenInboundPos] = useState(0);
  const [pendingConnections, setPendingConnections] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = privyUserId
        ? `companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId)}`
        : `companyId=${companyId}`;
      const [sumRes, poRes, connRes] = await Promise.all([
        fetch(`/api/suppliers/summary?companyId=${companyId}`),
        fetch(`/api/customers/purchase-orders?${qs}`),
        fetch(`/api/connections?${qs}`),
      ]);
      const data = await sumRes.json();
      setSummary(data.summary || null);
      setWarning(data.warning || null);

      if (poRes.ok) {
        const poData = await poRes.json();
        setOpenInboundPos(Number(poData.counts?.open || 0));
      } else {
        setOpenInboundPos(0);
      }

      if (connRes.ok) {
        const connData = await connRes.json();
        setPendingConnections(Number(connData.summary?.pendingIn || 0));
      } else {
        setPendingConnections(0);
      }
    } catch {
      setSummary(null);
      setOpenInboundPos(0);
      setPendingConnections(0);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const ot = summary?.otifef;
  const band = otifefBand(ot?.overall || 0);
  const trust = trustBand(summary?.avgTrust || 0);
  const s = summary;

  /** End-to-end sourcing journey: Source → Connect → Procure → Rate → Report */
  const modules: HubModule[] = [
    {
      href: '/dashboard/suppliers/discover',
      icon: Search,
      code: '01',
      title: 'Source — discover',
      desc: 'Find & search suppliers on the network: location, industry, certs, trust & OTIFEF.',
      accent: 'from-violet-50 to-white border-violet-100',
    },
    {
      href: '/dashboard/suppliers/shortlist',
      icon: Award,
      code: '02',
      title: 'Source — shortlist',
      desc: 'Compare shortlisted suppliers before you connect or buy.',
      accent: 'from-fuchsia-50 to-white border-fuchsia-100',
    },
    {
      href: '/dashboard/suppliers/connect',
      icon: Handshake,
      code: '03',
      title: 'Connect',
      desc: 'Request / accept platform connections that unlock POs, docs, ratings.',
      accent: 'from-cyan-50 to-white border-cyan-100',
      metric: s?.connected ?? '—',
      metricLabel: 'connected',
    },
    {
      href: '/dashboard/messages?from=suppliers&channel=supplier',
      icon: MessageSquare,
      code: '03b',
      title: 'Messages',
      desc: 'Message connected suppliers about POs, OTIFEF, and follow-ups.',
      accent: 'from-fuchsia-50 to-white border-fuchsia-100',
    },
    {
      href: '/dashboard/suppliers/network',
      icon: Users,
      code: '04',
      title: 'Supplier book',
      desc: 'Prospects, preferred, and connected partners in one book.',
      accent: 'from-sky-50 to-white border-sky-100',
      metric: s?.total ?? '—',
      metricLabel: 'in book',
    },
    {
      href: '/dashboard/suppliers/add',
      icon: Plus,
      code: '05',
      title: 'Add & invite',
      desc: 'Off-platform suppliers: add to book and invite them to claim.',
      accent: 'from-emerald-50 to-white border-emerald-100',
      metric: s?.invitePending ?? '—',
      metricLabel: 'pending',
    },
    {
      href: '/dashboard/suppliers/invites',
      icon: Handshake,
      code: '06',
      title: 'Invite lifecycle',
      desc: 'Pending, resend, revoke — full invite tracking.',
      accent: 'from-teal-50 to-white border-teal-100',
    },
    {
      href: '/dashboard/suppliers/portal',
      icon: Globe,
      code: '06b',
      title: 'Guest portal',
      desc: 'Share POs and documents with suppliers who have not joined yet.',
      accent: 'from-cyan-50 to-white border-cyan-100',
    },
    {
      href: '/dashboard/suppliers/po',
      icon: Truck,
      code: '07',
      title: 'Procure — purchase orders',
      desc: 'Raise POs (add supplier if missing), receive, escrow, settle.',
      accent: 'from-amber-50 to-white border-amber-100',
    },
    {
      href: '/dashboard/escrow',
      icon: ShieldCheck,
      code: '08',
      title: 'Procure — escrow',
      desc: 'USDC / ETH rails: fund → ship → release or dispute.',
      accent: 'from-orange-50 to-white border-orange-100',
    },
    {
      href: '/dashboard/suppliers/documents',
      icon: FileText,
      code: '09',
      title: 'Contracts & documents',
      desc: 'SLAs, certs, pricing agreements shared when connected.',
      accent: 'from-slate-50 to-white border-slate-200',
    },
    {
      href: '/dashboard/suppliers/performance',
      icon: TrendingUp,
      code: '10',
      title: 'Rate — OTIFEF scorecards',
      desc: 'On-Time · In-Full · Error-Free across the supply base.',
      accent: 'from-rose-50 to-white border-rose-100',
      metric: loading ? '—' : `${(ot?.overall ?? 0).toFixed(0)}%`,
      metricLabel: 'OTIFEF',
    },
    {
      href: '/dashboard/suppliers/ratings',
      icon: Star,
      code: '11',
      title: 'Rate — peer reviews',
      desc: 'Quality, delivery, communication, value after every PO.',
      accent: 'from-violet-50 to-white border-violet-100',
    },
    {
      href: '/dashboard/suppliers/report',
      icon: FileText,
      code: '12',
      title: 'Report — supply pack',
      desc: 'Spend, OTIFEF, concentration, and performance reporting.',
      accent: 'from-sky-50 to-white border-sky-100',
    },
    {
      href: '/dashboard/suppliers/riad-log',
      icon: AlertTriangle,
      code: '13',
      title: 'Report — supplier RIAD',
      desc: 'Risks, issues, actions, decisions on the supply base.',
      accent: 'from-amber-50 to-white border-amber-100',
      metric: s?.openRiads ?? '—',
      metricLabel: 'open',
    },
  ];

  return (
    <SuppliersPage>
      <RelationshipHeader
        eyebrow="Supplier relationship management"
        title="Suppliers"
        titleAccent="Sourcing"
        description="End-to-end SRM: source (find & search) → connect & invite → procure (PO / escrow) → rate OTIFEF & peers → report performance. One precision supply tower."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link href="/dashboard/suppliers/discover" className="btn-primary !py-2.5 !px-5 text-sm">
              <Search className="w-4 h-4" /> Discover
            </Link>
          </div>
        }
      />

      <div className="mb-6">
        <AdvisorMemberAppInvite
          kind="supplier"
          companyId={companyId}
          brand={getSelectedCompanyName()}
          audience="suppliers"
        />
      </div>

      <JourneyChecklist role="supplier" />
      <CatalogueEmptyBanner />

      {!loading ? (
        <TradeNextBanner
          action={computeHubNextAction({
            role: 'supplier',
            openInboundPos,
            catalogueEmpty: false,
            pendingConnections,
          })}
        />
      ) : null}

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

      <HubHero
        pill="Live SRM · discover → rate"
        title="Suppliers you can trust."
        description="OTIFEF, peer ratings, and verification compose a living trust score. Connect when it matters — invite offline partners who claim and take ownership."
        stats={[
          {
            label: 'In book',
            value: loading ? '—' : s?.total ?? 0,
            valueClass: 'text-[#00b4d8]',
          },
          {
            label: 'OTIFEF',
            value: loading ? '—' : `${(ot?.overall ?? 0).toFixed(0)}%`,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Open RIAD',
            value: loading ? '—' : s?.openRiads ?? 0,
            valueClass: 'text-amber-600',
          },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="In my book"
          value={s?.total ?? 0}
          sub="Prospects + active"
          accent="violet"
          icon={Users}
          href="/dashboard/suppliers/network"
        />
        <TelemetryCard
          label="Connected"
          value={s?.connected ?? 0}
          sub="On-platform edges"
          accent="emerald"
          icon={Handshake}
          href="/dashboard/suppliers/network"
        />
        <TelemetryCard
          label="Pending invites"
          value={s?.invitePending ?? 0}
          sub="Awaiting claim"
          accent={(s?.invitePending || 0) > 0 ? 'amber' : 'cyan'}
          icon={Globe}
          href="/dashboard/suppliers/invites"
        />
        <TelemetryCard
          label="Verified"
          value={s?.verified ?? 0}
          sub="In network"
          accent="sky"
          icon={ShieldCheck}
        />
        <TelemetryCard
          label="Avg trust"
          value={s?.avgTrust ?? 0}
          sub={trust.label}
          accent="violet"
          icon={TrendingUp}
          href="/dashboard/suppliers/performance"
        />
        <TelemetryCard
          label="On time"
          value={loading ? '—' : `${(ot?.onTime ?? 0).toFixed(0)}%`}
          sub="By promised date"
          accent="cyan"
          icon={Truck}
          href="/dashboard/suppliers/performance"
        />
        <TelemetryCard
          label="Overall OTIFEF"
          value={loading ? '—' : `${(ot?.overall ?? 0).toFixed(1)}%`}
          sub={`${band.label} · ${ot?.totalPOs ?? 0} POs`}
          accent="emerald"
          icon={Award}
          href="/dashboard/suppliers/performance"
        />
        <TelemetryCard
          label="Open RIADs"
          value={s?.openRiads ?? 0}
          sub="Supply-base risks"
          accent={(s?.openRiads || 0) > 0 ? 'amber' : 'slate'}
          icon={AlertTriangle}
          href="/dashboard/suppliers/riad-log"
        />
      </HubTelemetryGrid>

      {!loading && s?.topSuppliers && s.topSuppliers.length > 0 && (
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-800">Top OTIFEF suppliers</h3>
            <Link
              href="/dashboard/suppliers/performance"
              className="text-xs font-bold text-[#00b4d8]"
            >
              Full scorecards →
            </Link>
          </div>
          <ul className="space-y-2">
            {s.topSuppliers.map((row, i) => (
              <li
                key={row.supplier_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 px-3 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-black text-neutral-300 w-5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-semibold text-slate-900 truncate">{row.name}</span>
                  <span className="text-[11px] text-neutral-400">{row.total_pos} POs</span>
                </div>
                <span className="font-black text-[#00b4d8] tabular-nums">
                  {row.overall.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <HubModuleGrid modules={modules} />

      <HubPrinciples
        items={[
          {
            title: 'Trust is measurable',
            body: 'OTIFEF, peer ratings, and verification compose a living trust score — not a gut feel.',
          },
          {
            title: 'Connect on-chain when it matters',
            body: 'Standard POs for speed; optional POEscrowV2 create → fund → ship → confirmDelivery when capital must be locked.',
          },
          {
            title: 'Invite, then hand over',
            body: 'Add any supplier offline. They claim, verify, and take ownership — your edge stays live.',
          },
        ]}
      />
    </SuppliersPage>
  );
}
