'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import {
  Building2,
  FileText,
  Loader2,
  ShoppingCart,
  Truck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  BuyerCompanyRequired,
  BuyerNav,
  ConnectedBadge,
  SuspendedBadge,
  supplierDisplayName,
} from '@/components/buyer/BuyerShell';
import {
  RelationshipHeader,
  RelationshipPage,
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

type WorkspaceSupplier = {
  connectionId: number;
  supplierProfileId: number;
  tradingName: string | null;
  legalName: string | null;
  city: string | null;
  country: string | null;
  logoUrl: string | null;
  suspended: boolean;
  customerId: number | null;
};

type WorkspaceCounts = {
  total: number;
  active: number;
  suspended: number;
};

export default function BuyerHubPage() {
  return (
    <BuyerCompanyRequired>
      <BuyerHubInner />
    </BuyerCompanyRequired>
  );
}

function BuyerHubInner() {
  const companyId = getSelectedCompanyId()!;
  const { user, ready } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<WorkspaceSupplier[]>([]);
  const [counts, setCounts] = useState<WorkspaceCounts>({
    total: 0,
    active: 0,
    suspended: 0,
  });

  const load = useCallback(async () => {
    if (!privyUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        buyerCompanyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/buyer/workspace?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load workspace');
      setSuppliers(data.suppliers || []);
      setCounts(
        data.counts || {
          total: (data.suppliers || []).length,
          active: 0,
          suspended: 0,
        }
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load buyer workspace');
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const modules: HubModule[] = [
    {
      href: '/dashboard/buyer/suppliers',
      icon: Truck,
      code: '01',
      title: 'Connected suppliers',
      desc: 'Suppliers that invited you — raise POs when not suspended.',
      accent: 'from-violet-50 to-white border-violet-100',
      metric: counts.total,
      metricLabel: 'suppliers',
    },
    {
      href: '/dashboard/buyer/pos',
      icon: ShoppingCart,
      code: '02',
      title: 'Purchase orders',
      desc: 'Raise and track POs against connected suppliers.',
      accent: 'from-sky-50 to-white border-sky-100',
    },
    {
      href: '/dashboard/buyer/documents',
      icon: FileText,
      code: '03',
      title: 'Shared documents',
      desc: 'Quotes, orders, invoices, and contracts shared with you.',
      accent: 'from-cyan-50 to-white border-cyan-100',
    },
  ];

  return (
    <RelationshipPage>
      <BuyerNav />

      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        eyebrow="Buyer workspace"
        title="Buyer"
        titleAccent="Command"
        description="Company-scoped portal for connected suppliers. Raise POs, read shared commercial documents, and track open purchase orders."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <JourneyChecklist role="buyer" />

      {!loading ? (
        <TradeNextBanner
          action={computeHubNextAction({
            role: 'buyer',
            openOutboundPos: 0,
            pendingConnections: 0,
          })}
        />
      ) : null}

      <HubHero
        pill="Live buy · connect → settle"
        title="Buy from partners you trust."
        description="You buy from companies that invited you and you accepted. Suspended edges block new POs while historical documents remain readable."
        stats={[
          {
            label: 'Suppliers',
            value: loading ? '—' : counts.total,
            valueClass: 'text-[#00b4d8]',
          },
          {
            label: 'Active',
            value: loading ? '—' : counts.active,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Suspended',
            value: loading ? '—' : counts.suspended,
            valueClass: 'text-amber-600',
          },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="Suppliers"
          value={counts.total}
          sub="Connected edges"
          accent="violet"
          icon={Truck}
          href="/dashboard/buyer/suppliers"
        />
        <TelemetryCard
          label="Active"
          value={counts.active}
          sub="Ready to trade"
          accent="emerald"
          icon={ShoppingCart}
          href="/dashboard/buyer/suppliers"
        />
        <TelemetryCard
          label="Suspended"
          value={counts.suspended}
          sub="Collaboration paused"
          accent={counts.suspended > 0 ? 'amber' : 'slate'}
          icon={AlertTriangle}
          href="/dashboard/buyer/suppliers"
        />
        <TelemetryCard
          label="Purchase orders"
          value="Open"
          sub="Raise & track"
          accent="cyan"
          icon={FileText}
          href="/dashboard/buyer/pos"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={modules} />

      <HubPrinciples
        items={[
          {
            title: 'Connected suppliers only',
            body: 'You buy from companies that invited you and you accepted — no cold PO spam against the network.',
          },
          {
            title: 'Raise, track, settle',
            body: 'POs and shared documents stay company-scoped so finance and ops see the same commercial truth.',
          },
          {
            title: 'Suspend means pause',
            body: 'Suspended edges block new POs and shares while historical documents remain readable.',
          },
        ]}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-slate-800">Connected suppliers</h2>
        <Link
          href="/dashboard/buyer/suppliers"
          className="text-xs font-bold text-[#00b4d8]"
        >
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-red-700 text-sm">
          {error}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-cyan-200 bg-gradient-to-br from-white to-sky-50/60 px-8 py-14 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
          <p className="text-neutral-600 text-sm max-w-md mx-auto">
            No connected suppliers yet. When a seller invites your company as a customer and you
            accept, they appear here.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.slice(0, 6).map((s) => {
            const name = supplierDisplayName(s);
            const location = [s.city, s.country].filter(Boolean).join(', ');
            return (
              <div
                key={s.connectionId}
                className="rounded-2xl border border-neutral-200 bg-white p-4 flex flex-col gap-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{name}</div>
                    {location && (
                      <div className="text-xs text-neutral-500 mt-0.5">{location}</div>
                    )}
                  </div>
                  {s.suspended ? <SuspendedBadge /> : <ConnectedBadge />}
                </div>
                {s.suspended && (
                  <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-xl px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    New POs and shares blocked. Historical docs remain readable.
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-auto pt-1">
                  {s.suspended ? (
                    <button
                      type="button"
                      disabled
                      className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-400 cursor-not-allowed"
                    >
                      Raise PO
                    </button>
                  ) : (
                    <Link
                      href={`/dashboard/buyer/pos?supplierProfileId=${s.supplierProfileId}`}
                      className="text-xs px-3 py-1.5 rounded-full border border-[#00b4d8] text-[#00b4d8] font-semibold hover:bg-[#00b4d8] hover:text-white transition-colors"
                    >
                      Raise PO
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/buyer/documents?supplierProfileId=${s.supplierProfileId}`}
                    className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-700 font-medium hover:border-neutral-300"
                  >
                    Documents
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RelationshipPage>
  );
}
