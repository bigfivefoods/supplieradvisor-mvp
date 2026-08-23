'use client';

/**
 * Linked Orders panel — drop onto SO or PO detail pages.
 * Shows active links, raise-linked-PO, link-to-existing, unlink.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  customerVisibleProductionStatus,
  type OrderLink,
  type OrderType,
} from '@/lib/orders/order-links';

type Props = {
  companyId: number;
  privyUserId: string;
  orderId: number;
  orderType: OrderType;
  /** For raise-linked-PO from an SO */
  defaultSupplierProfileId?: number | null;
  defaultSrmSupplierId?: number | null;
  className?: string;
};

export default function LinkedOrdersPanel({
  companyId,
  privyUserId,
  orderId,
  orderType,
  defaultSupplierProfileId,
  defaultSrmSupplierId,
  className = '',
}: Props) {
  const [links, setLinks] = useState<OrderLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linkTargetId, setLinkTargetId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        companyId: String(companyId),
        orderId: String(orderId),
        orderType,
        privyUserId,
      });
      const res = await fetch(`/api/orders/links?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load links');
      setLinks(json.links || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, orderId, orderType, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function raiseLinkedPo(asSent: boolean) {
    if (orderType !== 'sales_order') return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/orders/raise-linked-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          salesOrderId: orderId,
          supplierProfileId: defaultSupplierProfileId || undefined,
          srmSupplierId: defaultSrmSupplierId || undefined,
          status: asSent ? 'sent' : 'draft',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to raise PO');
      setMessage(
        `PO #${json.purchaseOrder?.id} created (${asSent ? 'sent' : 'draft'})${
          json.link ? ' and linked' : ''
        }`
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Raise failed');
    } finally {
      setBusy(false);
    }
  }

  async function linkExisting() {
    const targetId = Number(linkTargetId);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      setError('Enter a valid order ID to link');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const isSo = orderType === 'sales_order';
      const res = await fetch('/api/orders/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          sourceOrderId: isSo ? orderId : targetId,
          targetOrderId: isSo ? targetId : orderId,
          sourceOrderType: 'sales_order',
          targetOrderType: 'purchase_order',
          linkType: 'fulfillment',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Link failed');
      setMessage(json.created ? 'Linked' : 'Already linked');
      setLinkTargetId('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setBusy(false);
    }
  }

  async function unlink(linkId: number) {
    if (!confirm('Unlink these documents? This does not delete the orders.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/orders/links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, linkId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unlink failed');
      setMessage('Unlinked');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unlink failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-black tracking-tight text-slate-900">
          Linked orders
        </h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Optional
        </span>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">Loading links…</p>
      )}

      {!loading && links.length === 0 && (
        <p className="mb-4 text-sm text-slate-500">
          No active links. Raise a linked PO or attach an existing document.
        </p>
      )}

      <ul className="mb-4 space-y-2">
        {links.map((l) => {
          const otherId =
            orderType === 'sales_order' ? l.target_order_id : l.source_order_id;
          const otherType =
            orderType === 'sales_order'
              ? l.target_order_type
              : l.source_order_type;
          return (
            <li
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {otherType === 'purchase_order' ? 'PO' : 'SO'} #{otherId}
                </p>
                <p className="text-xs text-slate-500">
                  {l.link_type} · linked {new Date(l.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void unlink(l.id)}
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                Unlink
              </button>
            </li>
          );
        })}
      </ul>

      {orderType === 'sales_order' && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || (!defaultSupplierProfileId && !defaultSrmSupplierId)}
            onClick={() => void raiseLinkedPo(false)}
            className="rounded-xl bg-[#00b4d8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0099b8] disabled:opacity-50"
          >
            Raise linked PO (draft)
          </button>
          <button
            type="button"
            disabled={busy || (!defaultSupplierProfileId && !defaultSrmSupplierId)}
            onClick={() => void raiseLinkedPo(true)}
            className="rounded-xl border border-[#00b4d8] px-4 py-2.5 text-sm font-semibold text-[#00b4d8] hover:bg-sky-50 disabled:opacity-50"
          >
            Raise &amp; send to supplier
          </button>
          {!defaultSupplierProfileId && !defaultSrmSupplierId && (
            <p className="w-full text-xs text-amber-700">
              Select a manufacturer (supplierProfileId / srmSupplierId) to enable one-click raise.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-4">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {orderType === 'sales_order' ? 'Link existing PO id' : 'Link existing SO id'}
          </label>
          <input
            type="number"
            value={linkTargetId}
            onChange={(e) => setLinkTargetId(e.target.value)}
            placeholder="e.g. 42"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void linkExisting()}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Link existing
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 text-sm text-emerald-700">{message}</p>
      )}

      {/* Hint for cascade visibility */}
      <p className="mt-4 text-xs text-slate-400">
        Production status cascades as:{' '}
        <span className="font-medium text-slate-500">
          {customerVisibleProductionStatus('in_progress')}
        </span>{' '}
        (customer-safe labels only).
      </p>
    </div>
  );
}
