'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Building2, FileText, Loader2, Search, ShoppingCart, AlertTriangle } from 'lucide-react';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  BuyerCompanyRequired,
  BuyerHeader,
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
  verificationStatus: string | null;
  suspended: boolean;
  suspendedAt: string | null;
  customerId: number | null;
  inviteStatus: string | null;
  connectedAt: string | null;
};

export default function BuyerSuppliersPage() {
  return (
    <BuyerCompanyRequired>
      <BuyerSuppliersInner />
    </BuyerCompanyRequired>
  );
}

function BuyerSuppliersInner() {
  const companyId = getSelectedCompanyId()!;
  const { user, ready } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<WorkspaceSupplier[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');

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
      if (!res.ok) throw new Error(data.error || 'Failed to load suppliers');
      setSuppliers(data.suppliers || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load suppliers');
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (filter === 'active' && s.suspended) return false;
      if (filter === 'suspended' && !s.suspended) return false;
      if (!q) return true;
      const name = supplierDisplayName(s).toLowerCase();
      const loc = [s.city, s.country].filter(Boolean).join(' ').toLowerCase();
      return (
        name.includes(q) ||
        loc.includes(q) ||
        String(s.supplierProfileId).includes(q)
      );
    });
  }, [suppliers, query, filter]);

  return (
    <>
      <BuyerHeader
        title="Connected suppliers"
        description="Accepted customer-type connections for this company. Suspended suppliers stay listed; Raise PO is disabled until the seller unsuspends."
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search suppliers…"
            className="w-full pl-9 pr-3 py-2.5 border border-neutral-200 rounded-2xl bg-white text-sm focus:border-[#00b4d8] outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['suspended', 'Suspended'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
                filter === value
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-red-700 text-sm">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-3xl p-10 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
          <p className="text-neutral-600 text-sm">
            {suppliers.length === 0
              ? 'No accepted supplier connections for this company yet.'
              : 'No suppliers match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const name = supplierDisplayName(s);
            const location = [s.city, s.country].filter(Boolean).join(', ');
            return (
              <div
                key={s.connectionId}
                className="bg-white border rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg truncate">{name}</h3>
                    {s.suspended ? <SuspendedBadge /> : <ConnectedBadge />}
                  </div>
                  <div className="text-sm text-neutral-500 space-y-0.5">
                    {location && <div>{location}</div>}
                    <div className="text-xs">
                      Profile #{s.supplierProfileId}
                      {s.customerId != null ? ` · CRM #${s.customerId}` : ''}
                      {s.connectedAt
                        ? ` · connected ${new Date(s.connectedAt).toLocaleDateString()}`
                        : ''}
                    </div>
                  </div>
                  {s.suspended && (
                    <div className="mt-2 inline-flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 rounded-xl px-2.5 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      Connection suspended — cannot raise new POs. Shared documents remain
                      readable.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                  {s.suspended ? (
                    <button
                      type="button"
                      disabled
                      title="Connection suspended"
                      className="inline-flex items-center justify-center gap-1.5 text-sm px-4 py-2.5 rounded-2xl border border-neutral-200 text-neutral-400 cursor-not-allowed bg-neutral-50"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Raise PO
                    </button>
                  ) : (
                    <Link
                      href={`/dashboard/buyer/pos?supplierProfileId=${s.supplierProfileId}`}
                      className="inline-flex items-center justify-center gap-1.5 text-sm px-4 py-2.5 rounded-2xl bg-[#00b4d8] text-white font-semibold hover:bg-[#0096b4] transition-colors"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Raise PO
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/buyer/documents?supplierProfileId=${s.supplierProfileId}`}
                    className="inline-flex items-center justify-center gap-1.5 text-sm px-4 py-2.5 rounded-2xl border border-neutral-200 text-neutral-700 font-medium hover:border-neutral-300 bg-white"
                  >
                    <FileText className="w-4 h-4" />
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
