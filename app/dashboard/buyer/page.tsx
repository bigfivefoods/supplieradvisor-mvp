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
  ArrowRight,
  AlertTriangle,
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

const HUB_MODULES = [
  {
    href: '/dashboard/buyer/suppliers',
    icon: Truck,
    title: 'Connected suppliers',
    desc: 'Suppliers that invited you — raise POs when not suspended',
  },
  {
    href: '/dashboard/buyer/pos',
    icon: ShoppingCart,
    title: 'Purchase orders',
    desc: 'Raise and track POs against connected suppliers',
  },
  {
    href: '/dashboard/buyer/documents',
    icon: FileText,
    title: 'Shared documents',
    desc: 'Quotes, orders, invoices, and contracts shared with you',
  },
] as const;

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

  return (
    <>
      <BuyerNav />

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
          Buyer workspace
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">
          Your suppliers
        </h1>
        <p className="text-neutral-600 mt-2 max-w-2xl text-sm">
          Company-scoped portal for connected suppliers. Raise POs, read shared commercial
          documents, and track open purchase orders. Suspended connections stay visible but
          block new collaboration.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-xs text-neutral-500 font-medium">Suppliers</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {loading ? '—' : counts.total}
          </div>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-xs text-neutral-500 font-medium">Active</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {loading ? '—' : counts.active}
          </div>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-xs text-neutral-500 font-medium">Suspended</div>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {loading ? '—' : counts.suspended}
          </div>
        </div>
        <Link
          href="/dashboard/buyer/pos"
          className="bg-white border rounded-2xl p-4 hover:border-[#00b4d8] transition-all group"
        >
          <div className="text-xs text-neutral-500 font-medium">Open POs</div>
          <div className="text-sm font-semibold text-[#00b4d8] mt-2 flex items-center gap-1 group-hover:gap-2 transition-all">
            View purchase orders <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      {/* Module cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {HUB_MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="bg-white border rounded-3xl p-6 hover:border-[#00b4d8] transition-all"
          >
            <m.icon className="w-7 h-7 text-[#00b4d8] mb-3" />
            <div className="font-bold text-lg">{m.title}</div>
            <div className="text-sm text-neutral-500 mt-1">{m.desc}</div>
          </Link>
        ))}
      </div>

      {/* Connected suppliers preview */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Connected suppliers</h2>
        <Link
          href="/dashboard/buyer/suppliers"
          className="text-sm font-semibold text-[#00b4d8] hover:underline inline-flex items-center gap-1"
        >
          View all <ArrowRight className="w-4 h-4" />
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
        <div className="bg-white border rounded-3xl p-10 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
          <p className="text-neutral-600 text-sm max-w-md mx-auto">
            No connected suppliers yet. When a seller invites your company as a customer and
            you accept, they appear here.
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
                className="bg-white border rounded-2xl p-4 flex flex-col gap-3"
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
    </>
  );
}
