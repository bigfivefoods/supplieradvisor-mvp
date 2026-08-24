'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  OperationsHeader,
  OperationsPage,
} from '@/components/operations/OperationsShell';
import OrderChainCard from '@/components/orders/OrderChainCard';
import { OrderChainPath } from '@/components/orders/OrderChainPath';
import { OrderChainSetupBoard } from '@/components/orders/OrderChainSetup';

/**
 * Operations tower — linked SO → PO chains with commercial snapshot.
 */
export default function OperationsChainsPage() {
  return (
    <CompanyRequired>
      <ChainsInner />
    </CompanyRequired>
  );
}

function ChainsInner() {
  const companyId = getSelectedCompanyId()!;
  const { user, ready, authenticated } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [filter, setFilter] = useState<'linked' | 'all' | 'independent'>(
    'linked'
  );
  const [chains, setChains] = useState<unknown[]>([]);
  const [independent, setIndependent] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !privyUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const q = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
        filter,
      });
      const res = await fetch(`/api/orders/chains?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load chains');
      setChains(json.chains || []);
      setIndependent(json.independentPos || []);
      if (json.hint) setHint(String(json.hint));
      if (json.warning) setHint(String(json.warning));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
      setChains([]);
      setIndependent([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, filter]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !privyUserId) {
      setLoading(false);
      return;
    }
    void load();
  }, [ready, authenticated, privyUserId, load]);

  return (
    <OperationsPage>
      <OperationsHeader
        title="Order"
        titleAccent="chains"
        description="Set up who orders, which of your products, and who makes them. Live sales orders then follow that path: purchase order → sales order → production → delivery → feedback."
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        }
      />

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Golden path
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">
              Customer portal
            </p>
            <OrderChainPath side="customer" compact />
            <p className="mt-1.5 text-[11px] text-slate-500">
              They raise a purchase order. It becomes your sales order, then
              production, delivery, and feedback. They see Scheduled / In
              production / Produced — never supplier cost.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">
              Supplier portal
            </p>
            <OrderChainPath side="supplier" compact />
            <p className="mt-1.5 text-[11px] text-slate-500">
              They receive your purchase order, accept, produce, and ship.
              Each step updates the linked sales order automatically.
            </p>
          </div>
        </div>
      </div>

      {privyUserId ? (
        <div className="mb-8">
          <OrderChainSetupBoard
            companyId={companyId}
            privyUserId={privyUserId}
          />
        </div>
      ) : null}

      <div className="mb-3">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Live orders
        </p>
        <h2 className="text-lg font-black text-slate-900">Linked sales orders</h2>
        <p className="text-sm text-slate-500">
          Once a customer PO lands, the matching chain raises a supplier PO.
          Track production here.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
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

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[#00b4d8]" />
          Loading chains…
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}

      {hint && !error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
          {hint}
        </p>
      ) : null}

      {!loading && !error && filter !== 'independent' && chains.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-slate-600 space-y-2">
          <p className="font-semibold text-slate-900">No linked chains yet</p>
          <p>
            A chain appears when a customer purchase order becomes a sales
            order and a supplier purchase order is linked to it. Set a
            preferred manufacturer under My Business → Settings, then raise a
            PO on the customer portal — or open a sales order and use
            Manufacturer chain.
          </p>
          <p>
            <Link
              href="/dashboard/customers/orders"
              className="font-semibold text-[#0077b6] hover:underline"
            >
              Open sales orders
            </Link>
            {' · '}
            <Link
              href="/dashboard/my-business/settings"
              className="font-semibold text-[#0077b6] hover:underline"
            >
              Preferred manufacturer
            </Link>
          </p>
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-4">
          {(chains as Parameters<typeof OrderChainCard>[0]['chain'][]).map(
            (c) => (
              <OrderChainCard
                key={c.linkId}
                chain={c}
                companyId={companyId}
                privyUserId={privyUserId || undefined}
                onChanged={() => void load()}
              />
            )
          )}
        </div>
      ) : null}

      {!loading &&
      (filter === 'all' || filter === 'independent') &&
      independent.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Independent POs
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Supplier purchase orders that are not linked to a customer sales
            order.
          </p>
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
      ) : null}
    </OperationsPage>
  );
}
