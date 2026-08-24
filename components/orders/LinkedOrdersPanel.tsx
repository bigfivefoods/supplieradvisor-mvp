'use client';

/**
 * Linked Orders panel — drop onto SO or PO detail pages.
 * Phase D: built-in SRM supplier picker + auto preferred + empty states.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  customerVisibleProductionStatus,
  type OrderLink,
  type OrderType,
} from '@/lib/orders/order-links';

type SrmOption = {
  id: number;
  trading_name: string;
  linked_profile_id?: number | null;
  status?: string | null;
};

type Props = {
  companyId: number;
  privyUserId: string;
  orderId: number;
  orderType: OrderType;
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
  const [suppliers, setSuppliers] = useState<SrmOption[]>([]);
  const [selectedSrmId, setSelectedSrmId] = useState<string>(
    defaultSrmSupplierId ? String(defaultSrmSupplierId) : ''
  );
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

  const loadSuppliers = useCallback(async () => {
    if (orderType !== 'sales_order') return;
    try {
      // Prefer existing SRM list endpoint if present; soft-fail to empty
      const res = await fetch(
        `/api/suppliers?companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId)}`
      );
      if (!res.ok) return;
      const json = await res.json();
      const rows = (json.suppliers || json.data || []) as SrmOption[];
      const cleaned = rows
        .map((s) => ({
          id: Number(s.id),
          trading_name: String(s.trading_name || `Supplier ${s.id}`),
          linked_profile_id: s.linked_profile_id
            ? Number(s.linked_profile_id)
            : null,
          status: s.status || null,
        }))
        .filter((s) => Number.isFinite(s.id) && s.id > 0);
      setSuppliers(cleaned);
      if (!selectedSrmId && defaultSrmSupplierId) {
        setSelectedSrmId(String(defaultSrmSupplierId));
      } else if (!selectedSrmId && cleaned.length === 1) {
        setSelectedSrmId(String(cleaned[0].id));
      }
    } catch {
      /* soft — picker remains manual */
    }
  }, [companyId, privyUserId, orderType, defaultSrmSupplierId, selectedSrmId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  async function raiseLinkedPo(asSent: boolean) {
    if (orderType !== 'sales_order') return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const srmId = selectedSrmId ? Number(selectedSrmId) : defaultSrmSupplierId;
      const res = await fetch('/api/orders/raise-linked-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          salesOrderId: orderId,
          supplierProfileId: defaultSupplierProfileId || undefined,
          srmSupplierId: srmId || undefined,
          status: asSent ? 'sent' : 'draft',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to raise PO');
      const pref =
        json.preferredSource && json.preferredSource !== 'none'
          ? ` · preferred via ${json.preferredSource}`
          : '';
      setMessage(
        `PO #${json.purchaseOrder?.id} created (${asSent ? 'sent' : 'draft'})${
          json.link ? ' and linked' : ''
        }${pref}`
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

  const canRaise =
    Boolean(selectedSrmId) ||
    Boolean(defaultSrmSupplierId) ||
    Boolean(defaultSupplierProfileId) ||
    true; // server may still auto-resolve preferred

  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
          Linked orders
        </h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Manufacturer
        </span>
      </div>

      {loading && (
        <p className="text-sm text-slate-500">Loading links…</p>
      )}

      {!loading && links.length === 0 && (
        <div className="mb-4 rounded-xl border border-dashed border-neutral-200 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">No active links</p>
          <p className="mt-1 text-xs text-slate-500">
            Raise a linked purchase order to your manufacturer. Customer-portal
            POs do this automatically when a preferred manufacturer is set.
          </p>
        </div>
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
                  {l.link_type} · linked{' '}
                  {new Date(l.created_at).toLocaleDateString()}
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
        <div className="mb-4 space-y-3">
          {suppliers.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Manufacturer
              </label>
              <select
                value={selectedSrmId}
                onChange={(e) => setSelectedSrmId(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
              >
                <option value="">Auto / preferred…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.trading_name}
                    {s.linked_profile_id ? '' : ' (book only)'}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !canRaise}
              onClick={() => void raiseLinkedPo(false)}
              className="rounded-xl bg-[#00b4d8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0099b8] disabled:opacity-50"
            >
              Raise linked PO (draft)
            </button>
            <button
              type="button"
              disabled={busy || !canRaise}
              onClick={() => void raiseLinkedPo(true)}
              className="rounded-xl border border-[#00b4d8] px-4 py-2.5 text-sm font-semibold text-[#00b4d8] hover:bg-sky-50 disabled:opacity-50"
            >
              Raise &amp; send
            </button>
          </div>
          <p className="text-xs text-slate-400">
            If no manufacturer is selected, the server uses SO metadata, company
            preferred settings, or the only SRM supplier in your book.
          </p>
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
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}

      <p className="mt-4 text-xs text-slate-400">
        Customer sees production as:{' '}
        <span className="font-medium text-slate-500">
          {customerVisibleProductionStatus('in_progress')}
        </span>{' '}
        (never cost or margin).
      </p>
    </div>
  );
}
