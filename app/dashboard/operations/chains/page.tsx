'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import OrderChainCard from '@/components/orders/OrderChainCard';

/**
 * Operations tower — linked multi-party order chains with commercial snapshot.
 * Requires company context from localStorage / existing workspace pattern.
 */
export default function OperationsChainsPage() {
  const { user, ready, authenticated } = usePrivy();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'linked' | 'all' | 'independent'>('linked');
  const [chains, setChains] = useState<unknown[]>([]);
  const [independent, setIndependent] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sa_active_company_id');
      if (raw) setCompanyId(Number(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        companyId: String(companyId),
        privyUserId: user.id,
        filter,
      });
      const res = await fetch(`/api/orders/chains?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load chains');
      setChains(json.chains || []);
      setIndependent(json.independentPos || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, user?.id, filter]);

  useEffect(() => {
    if (ready && authenticated) void load();
  }, [ready, authenticated, load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/operations"
            className="text-xs font-medium text-[#00b4d8] hover:underline"
          >
            ← Operations
          </Link>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
            Order chains
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Boxer sales order → Kelpac purchase order. Cost and margin stay here;
            the customer only sees production labels.
          </p>
        </div>
        <div className="flex gap-2">
          {(['linked', 'all', 'independent'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${
                filter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {!companyId && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Select an active company workspace to view chains.
        </p>
      )}

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!loading && filter !== 'independent' && chains.length === 0 && (
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-slate-500">
          No active linked chains yet. A customer portal PO auto-raises a
          manufacturer PO when a preferred supplier is set. You can also tap
          Manufacturer chain on a sales order.
        </p>
      )}

      <div className="grid gap-4">
        {(chains as Parameters<typeof OrderChainCard>[0]['chain'][]).map((c) => (
          <OrderChainCard
            key={c.linkId}
            chain={c}
            companyId={companyId || undefined}
            privyUserId={user?.id}
            onChanged={() => void load()}
          />
        ))}
      </div>

      {(filter === 'all' || filter === 'independent') && independent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Independent POs
          </h2>
          <ul className="space-y-2">
            {(independent as Array<Record<string, unknown>>).map((p) => (
              <li
                key={String(p.id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium text-slate-800">
                  PO #{String(p.id)} · {String(p.supplier_name || 'Supplier')}
                </span>
                <span className="text-slate-500">
                  {String(p.status)} · {String(p.payment_status || 'unpaid')} ·{' '}
                  {Number(p.total_amount || 0).toLocaleString()}{' '}
                  {String(p.currency || 'ZAR')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
