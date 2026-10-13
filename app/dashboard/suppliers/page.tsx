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
import ActivityFeed from '@/components/chrome/ActivityFeed';
import { SrmEmpty, SrmPanel, SrmSkeleton, srmFocus } from '@/components/suppliers/srm/SrmDesk';
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

      {loading ? (
        <div className="mb-6">
          <SrmSkeleton variant="cards" rows={4} />
        </div>
      ) : (
        <HubTelemetryGrid className="mb-6">
          <TelemetryCard
            label="In the book"
            value={s?.total ?? 0}
            sub={`${s?.active ?? 0} active · ${s?.preferred ?? 0} preferred`}
            accent="violet"
            icon={Users}
            href="/dashboard/suppliers/network"
          />
          <TelemetryCard
            label="Connected"
            value={s?.connected ?? 0}
            sub={`${s?.verified ?? 0} verified on the network`}
            accent="emerald"
            icon={Handshake}
            href="/dashboard/suppliers/network"
          />
          <TelemetryCard
            label="Awaiting claim"
            value={s?.invitePending ?? 0}
            sub="Invites not yet accepted"
            accent={(s?.invitePending || 0) > 0 ? 'amber' : 'slate'}
            icon={Globe}
            href="/dashboard/suppliers/invites"
          />
          <TelemetryCard
            label="OTIFEF"
            value={`${(ot?.overall ?? 0).toFixed(0)}%`}
            sub={`${band.label} · trust ${trust.label} · ${ot?.totalPOs ?? 0} POs`}
            accent="cyan"
            icon={Award}
            href="/dashboard/suppliers/performance"
          />
        </HubTelemetryGrid>
      )}

      <div className="mb-8 grid items-start gap-4 lg:grid-cols-2">
        <SrmPanel
          title="Needs a decision"
          description="Open work on this supply base. A zero means that queue is clear."
        >
          {loading ? (
            <SrmSkeleton rows={4} />
          ) : (
            <ul className="divide-y divide-slate-100">
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
                    className={`${srmFocus} flex min-h-12 items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50`}
                  >
                    <span className="font-medium text-slate-800">{row.label}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-sm font-black tabular-nums ${
                        row.value > 0
                          ? 'bg-amber-100 text-amber-950'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.value}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SrmPanel>

        <SrmPanel
          title="Who you rely on"
          description="Highest OTIFEF on the book. Open a name for the full profile."
          action={
            <Link
              href="/dashboard/suppliers/performance"
              className={`${srmFocus} text-xs font-bold text-[#0077b6] hover:underline`}
            >
              Scorecards
            </Link>
          }
        >
          {loading ? (
            <SrmSkeleton rows={4} />
          ) : s?.topSuppliers && s.topSuppliers.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {s.topSuppliers.map((row, i) => (
                <li key={row.supplier_id}>
                  <Link
                    href={`/dashboard/suppliers/network?id=${row.supplier_id}`}
                    className={`${srmFocus} flex min-h-12 items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-5 text-[10px] font-black text-slate-400">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">
                          {row.name}
                        </span>
                        <span className="text-[11px] text-slate-600">
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
            <div className="p-4">
              <SrmEmpty
                title="No scored suppliers yet"
                description="Discover a partner or add one to the book. Scorecards appear after purchase orders are delivered."
                actionHref="/dashboard/suppliers/discover"
                actionLabel="Discover suppliers"
              />
            </div>
          )}
        </SrmPanel>
      </div>

      <ActivityFeed
        title="Supply activity"
        empty="Actions on this company — invites, purchase orders, documents — show here as they happen."
      />
    </SuppliersPage>
  );
}
