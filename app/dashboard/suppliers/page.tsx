'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import {
  Users,
  Award,
  Search,
  Handshake,
  Globe,
  RefreshCw,
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
  HubTelemetryGrid,
  TelemetryCard,
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

  return (
    <SuppliersPage>
      <RelationshipHeader
        band={true}
        eyebrow="Supplier relationship management"
        title="Suppliers"
        titleAccent="Sourcing"
        description="The supply book, what needs a decision, and the suppliers you rely on. Source, order, and score live on the rail."
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

      <HubTelemetryGrid className="mb-6">
        <TelemetryCard
          label="In the book"
          value={loading ? '—' : s?.total ?? 0}
          sub={`${s?.active ?? 0} active · ${s?.preferred ?? 0} preferred`}
          accent="violet"
          icon={Users}
          href="/dashboard/suppliers/network"
        />
        <TelemetryCard
          label="Connected"
          value={loading ? '—' : s?.connected ?? 0}
          sub={`${s?.verified ?? 0} verified on the network`}
          accent="emerald"
          icon={Handshake}
          href="/dashboard/suppliers/network"
        />
        <TelemetryCard
          label="Awaiting claim"
          value={loading ? '—' : s?.invitePending ?? 0}
          sub="Invites not yet accepted"
          accent={(s?.invitePending || 0) > 0 ? 'amber' : 'slate'}
          icon={Globe}
          href="/dashboard/suppliers/invites"
        />
        <TelemetryCard
          label="OTIFEF"
          value={loading ? '—' : `${(ot?.overall ?? 0).toFixed(0)}%`}
          sub={`${band.label} · trust ${trust.label} · ${ot?.totalPOs ?? 0} POs`}
          accent="cyan"
          icon={Award}
          href="/dashboard/suppliers/performance"
        />
      </HubTelemetryGrid>

      <div className="mb-8 grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-800">Needs a decision</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Open work on this supply base. A zero means that queue is clear.
          </p>
          <ul className="mt-3 divide-y divide-neutral-100">
            {[
              {
                label: 'Purchase orders still open',
                value: openInboundPos,
                href: '/dashboard/suppliers/po',
              },
              {
                label: 'Connection requests',
                value: pendingConnections,
                href: '/dashboard/connections',
              },
              {
                label: 'Invites awaiting claim',
                value: s?.invitePending ?? 0,
                href: '/dashboard/suppliers/invites',
              },
              {
                label: 'Open supply risks',
                value: s?.openRiads ?? 0,
                href: '/dashboard/suppliers/riad-log',
              },
            ].map((row) => (
              <li key={row.label}>
                <Link
                  href={row.href}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:text-[#0077b6]"
                >
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span
                    className={`tabular-nums font-black ${
                      row.value > 0 ? 'text-amber-700' : 'text-slate-400'
                    }`}
                  >
                    {loading ? '—' : row.value}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-800">Who you rely on</h3>
            <Link
              href="/dashboard/suppliers/performance"
              className="text-xs font-bold text-[#0077b6] hover:underline"
            >
              Scorecards
            </Link>
          </div>
          {!loading && s?.topSuppliers && s.topSuppliers.length > 0 ? (
            <ul className="mt-3 divide-y divide-neutral-100">
              {s.topSuppliers.map((row, i) => (
                <li key={row.supplier_id}>
                  <Link
                    href={`/dashboard/suppliers/network?id=${row.supplier_id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:text-[#0077b6]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-5 text-[10px] font-black text-neutral-300">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">
                          {row.name}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {row.total_pos} POs
                        </span>
                      </span>
                    </span>
                    <span className="font-black tabular-nums text-[#0077b6]">
                      {row.overall.toFixed(0)}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-1 py-10 text-center text-sm text-neutral-500">
              {loading ? (
                'Loading the book…'
              ) : (
                <>
                  No scored suppliers yet.{' '}
                  <Link href="/dashboard/suppliers/discover" className="font-semibold text-[#0077b6] hover:underline">
                    Discover
                  </Link>{' '}
                  or{' '}
                  <Link href="/dashboard/suppliers/add" className="font-semibold text-[#0077b6] hover:underline">
                    add one
                  </Link>
                  .
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </SuppliersPage>
  );
}
