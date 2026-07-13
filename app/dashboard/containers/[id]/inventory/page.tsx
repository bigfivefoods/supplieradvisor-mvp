'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Plus,
  PackagePlus,
  Truck,
  AlertTriangle,
  Trash2,
  Search,
  Boxes,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type {
  CatalogueProductOption,
  ContainerInventoryItem,
  ContainerOrder,
} from '@/lib/containers/types';

type OrderLine = {
  product_id: string;
  product_name: string;
  quantity: string;
  unit: string;
  sku: string;
};

function InventoryContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const containerId = Number(params?.id);
  const tabParam = searchParams.get('tab');
  const companyId = getSelectedCompanyId();

  const [tab, setTab] = useState<'stock' | 'orders'>(
    tabParam === 'orders' ? 'orders' : 'stock'
  );
  const [items, setItems] = useState<ContainerInventoryItem[]>([]);
  const [orders, setOrders] = useState<ContainerOrder[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [catalogueWarning, setCatalogueWarning] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('unit');
  const [reorder, setReorder] = useState('5');
  const [unitCost, setUnitCost] = useState('');
  const [saving, setSaving] = useState(false);

  const [orderLines, setOrderLines] = useState<OrderLine[]>([
    { product_id: '', product_name: '', quantity: '1', unit: 'unit', sku: '' },
  ]);
  const [orderNotes, setOrderNotes] = useState('');

  const load = useCallback(async () => {
    if (!companyId || !containerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [invRes, ordRes, prodRes] = await Promise.all([
        fetch(
          `/api/containers/inventory?companyId=${companyId}&containerId=${containerId}`,
          { cache: 'no-store' }
        ).then((r) => r.json()),
        fetch(
          `/api/containers/orders?companyId=${companyId}&containerId=${containerId}`,
          { cache: 'no-store' }
        ).then((r) => r.json()),
        // Prefer finished goods; fall back to full catalogue
        fetch(
          `/api/inventory/products?companyId=${companyId}&type=finished_good`,
          { cache: 'no-store' }
        ).then((r) => r.json()),
      ]);

      setItems(invRes.items || []);
      setOrders(ordRes.orders || []);
      setWarning(invRes.warning || ordRes.warning || null);

      let products = (prodRes.products || []) as CatalogueProductOption[];
      if ((!products.length && !prodRes.error) || prodRes.warning) {
        const allRes = await fetch(
          `/api/inventory/products?companyId=${companyId}`,
          { cache: 'no-store' }
        ).then((r) => r.json());
        products = (allRes.products || []) as CatalogueProductOption[];
        if (allRes.warning) setCatalogueWarning(allRes.warning);
      } else if (prodRes.warning) {
        setCatalogueWarning(prodRes.warning);
      } else {
        setCatalogueWarning(null);
      }

      // Active / sellable first; include finished goods + anything without type
      const usable = products.filter((p) => {
        const st = String(p.status || 'active').toLowerCase();
        return !st || ['active', 'published', 'available'].includes(st);
      });
      usable.sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''))
      );
      setCatalogue(usable);
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [companyId, containerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCatalogue = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return catalogue;
    return catalogue.filter((p) => {
      const hay = [p.name, p.sku, p.category, p.product_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [catalogue, productFilter]);

  const applyProduct = (id: string) => {
    setSelectedProductId(id);
    if (!id) {
      setProductName('');
      setSku('');
      setUnit('unit');
      setReorder('5');
      setUnitCost('');
      return;
    }
    const p = catalogue.find((x) => String(x.id) === id);
    if (!p) return;
    setCustomMode(false);
    setProductName(p.name || '');
    setSku(p.sku || '');
    setUnit(p.uom || p.unit || 'unit');
    setReorder(
      p.reorder_level != null && Number(p.reorder_level) > 0
        ? String(p.reorder_level)
        : '5'
    );
    setUnitCost(
      p.cost_price != null && Number(p.cost_price) > 0
        ? String(p.cost_price)
        : ''
    );
  };

  const addStock = async (action: 'upsert' | 'receive') => {
    if (!companyId) return;
    if (!productName.trim() && !selectedProductId) {
      toast.error('Select a finished good from inventory');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/containers/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          containerId,
          action,
          product_id: selectedProductId
            ? Number(selectedProductId)
            : undefined,
          product_name: productName.trim(),
          sku: sku || undefined,
          quantity: Number(qty),
          unit,
          reorder_level: Number(reorder),
          unit_cost: unitCost !== '' ? Number(unitCost) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      toast.success(action === 'receive' ? 'Stock received' : 'Item saved');
      setSelectedProductId('');
      setProductName('');
      setSku('');
      setQty('1');
      setUnit('unit');
      setReorder('5');
      setUnitCost('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const placeOrder = async () => {
    if (!companyId) return;
    const itemsPayload = orderLines
      .filter((l) => l.product_name && Number(l.quantity) > 0)
      .map((l) => ({
        product_id: l.product_id ? Number(l.product_id) : undefined,
        product_name: l.product_name,
        quantity: Number(l.quantity),
        unit: l.unit,
        sku: l.sku || undefined,
      }));
    if (!itemsPayload.length) {
      toast.error('Select at least one product from inventory');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/containers/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          containerId,
          items: itemsPayload,
          notes: orderNotes,
          status: 'ordered',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      toast.success('Order placed');
      setOrderLines([
        { product_id: '', product_name: '', quantity: '1', unit: 'unit', sku: '' },
      ]);
      setOrderNotes('');
      setTab('orders');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const markReceived = async (orderId: number) => {
    setSaving(true);
    const res = await fetch('/api/containers/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, status: 'received' }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || 'Failed');
      return;
    }
    toast.success('Order received into inventory');
    void load();
  };

  const removeItem = async (id: number) => {
    if (!confirm('Remove this inventory line?')) return;
    await fetch(`/api/containers/inventory?id=${id}`, { method: 'DELETE' });
    void load();
  };

  const setOrderProduct = (idx: number, productId: string) => {
    const next = [...orderLines];
    if (!productId) {
      next[idx] = {
        product_id: '',
        product_name: '',
        quantity: next[idx].quantity,
        unit: 'unit',
        sku: '',
      };
      setOrderLines(next);
      return;
    }
    const p = catalogue.find((x) => String(x.id) === productId);
    if (!p) return;
    next[idx] = {
      product_id: productId,
      product_name: p.name || '',
      quantity: next[idx].quantity || '1',
      unit: p.uom || p.unit || 'unit',
      sku: p.sku || '',
    };
    setOrderLines(next);
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto">
      <Link
        href={`/dashboard/containers/${containerId}`}
        className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Container
      </Link>
      <h1 className="text-3xl font-black tracking-[-2px] text-[#00b4d8] mb-2">
        Outlet inventory
      </h1>
      <p className="text-neutral-600 mb-6">
        Order stock, receive deliveries, and track on-hand quantities. Select
        finished goods from your inventory catalogue.
      </p>

      {warning && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-900 text-sm">
          <strong>Setup:</strong> {warning}. Run{' '}
          <code className="text-xs bg-white px-1 rounded">
            supabase/migrations/20260709_container_ops.sql
          </code>{' '}
          in the SQL Editor if inventory tables are missing.
        </div>
      )}

      {catalogueWarning && (
        <div className="mb-4 p-3 rounded-2xl bg-sky-50 border border-sky-100 text-sky-900 text-sm">
          Product catalogue note: {catalogueWarning}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('stock')}
          className={`px-5 py-2.5 rounded-2xl text-sm font-semibold border ${
            tab === 'stock'
              ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
              : 'bg-white'
          }`}
        >
          Stock on hand
        </button>
        <button
          type="button"
          onClick={() => setTab('orders')}
          className={`px-5 py-2.5 rounded-2xl text-sm font-semibold border ${
            tab === 'orders'
              ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
              : 'bg-white'
          }`}
        >
          Orders
        </button>
        <Link
          href="/dashboard/inventory/products?type=finished_good"
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:border-[#00b4d8]"
        >
          <Boxes className="w-4 h-4 text-[#00b4d8]" />
          Manage finished goods
        </Link>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : tab === 'stock' ? (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white border rounded-3xl p-6 space-y-4 h-fit">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-[#00b4d8]" /> Add / receive
              stock
            </h2>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input w-full !p-3 !pl-9 !text-sm"
                placeholder="Search finished goods…"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              />
            </div>

            <label className="block text-xs font-bold text-slate-600">
              Product from inventory *
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
                value={selectedProductId}
                onChange={(e) => applyProduct(e.target.value)}
                disabled={customMode}
              >
                <option value="">
                  {catalogue.length
                    ? `Select finished good (${filteredCatalogue.length})…`
                    : 'No products in catalogue yet'}
                </option>
                {filteredCatalogue.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                    {p.sku ? ` · ${p.sku}` : ''}
                    {p.qty_on_hand != null
                      ? ` · warehouse ${Number(p.qty_on_hand)}`
                      : ''}
                    {p.product_type && p.product_type !== 'finished_good'
                      ? ` · ${String(p.product_type).replace(/_/g, ' ')}`
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            {catalogue.length === 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                No finished goods found. Add products under{' '}
                <Link
                  href="/dashboard/inventory/products"
                  className="font-bold underline"
                >
                  Inventory → Products
                </Link>{' '}
                (type: finished good), or use a custom line below.
              </p>
            )}

            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={customMode}
                onChange={(e) => {
                  setCustomMode(e.target.checked);
                  if (e.target.checked) {
                    setSelectedProductId('');
                  }
                }}
                className="rounded border-slate-300 text-[#00b4d8]"
              />
              Custom product (not in catalogue)
            </label>

            {customMode && (
              <input
                className="input w-full !p-3 !text-base"
                placeholder="Product name *"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            )}

            {!customMode && selectedProductId && (
              <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2 text-xs text-teal-900">
                <div className="font-bold">{productName}</div>
                <div className="text-teal-800/80">
                  SKU: {sku || '—'} · Unit: {unit}
                  {unitCost !== '' ? ` · Cost R${unitCost}` : ''}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {customMode && (
                <>
                  <input
                    className="input !p-3 !text-base"
                    placeholder="SKU"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                  <input
                    className="input !p-3 !text-base"
                    placeholder="Unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </>
              )}
              <input
                className="input !p-3 !text-base"
                type="number"
                min={0}
                step="any"
                placeholder="Qty"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <input
                className="input !p-3 !text-base"
                type="number"
                min={0}
                step="any"
                placeholder="Reorder level"
                value={reorder}
                onChange={(e) => setReorder(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void addStock('upsert')}
                className="btn-secondary flex-1 !py-3 text-sm"
              >
                Set / create line
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void addStock('receive')}
                className="btn-primary flex-1 !py-3 text-sm"
              >
                Receive +
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white border rounded-3xl overflow-hidden">
            {items.length === 0 ? (
              <div className="p-12 text-center text-neutral-500">
                No stock lines yet. Select a finished good and receive stock.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-right px-4 py-3">On hand</th>
                    <th className="text-right px-4 py-3">Reorder</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => {
                    const low =
                      Number(item.qty_on_hand) <=
                      Number(item.reorder_level || 0);
                    return (
                      <tr key={item.id} className={low ? 'bg-amber-50/50' : ''}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-xs text-neutral-500">
                            {item.sku || '—'}
                            {item.product_id
                              ? ` · cat #${item.product_id}`
                              : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {item.qty_on_hand} {item.unit}
                          {low && (
                            <div className="text-xs text-amber-700 flex items-center justify-end gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" /> Low
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-500">
                          {item.reorder_level}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void removeItem(item.id)}
                            className="text-red-500 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white border rounded-3xl p-6 space-y-4 h-fit">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#00b4d8]" /> New replenishment
              order
            </h2>
            <p className="text-xs text-slate-500">
              Lines pull from finished goods in your inventory catalogue.
            </p>
            {orderLines.map((line, idx) => (
              <div
                key={idx}
                className="space-y-2 rounded-2xl border border-slate-100 p-3 bg-slate-50/50"
              >
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={line.product_id}
                  onChange={(e) => setOrderProduct(idx, e.target.value)}
                >
                  <option value="">Select product…</option>
                  {catalogue.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                      {p.sku ? ` · ${p.sku}` : ''}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    className="input !p-2 !text-sm col-span-2"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => {
                      const next = [...orderLines];
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      setOrderLines(next);
                    }}
                  />
                  <input
                    className="input !p-2 !text-sm"
                    placeholder="uom"
                    value={line.unit}
                    onChange={(e) => {
                      const next = [...orderLines];
                      next[idx] = { ...next[idx], unit: e.target.value };
                      setOrderLines(next);
                    }}
                  />
                </div>
                {line.product_name && (
                  <div className="text-[11px] text-slate-500">
                    {line.product_name}
                    {line.sku ? ` · ${line.sku}` : ''}
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-[#00b4d8] font-medium inline-flex items-center gap-1"
              onClick={() =>
                setOrderLines([
                  ...orderLines,
                  {
                    product_id: '',
                    product_name: '',
                    quantity: '1',
                    unit: 'unit',
                    sku: '',
                  },
                ])
              }
            >
              <Plus className="w-4 h-4" /> Add line
            </button>
            <textarea
              className="input w-full !p-3 !text-base min-h-[70px]"
              placeholder="Notes"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void placeOrder()}
              className="btn-primary w-full !py-3"
            >
              Place order
            </button>
          </div>

          <div className="lg:col-span-3 space-y-3">
            {orders.length === 0 ? (
              <div className="bg-white border rounded-3xl p-12 text-center text-neutral-500">
                No orders yet.
              </div>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="bg-white border rounded-3xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="font-semibold">
                        {o.order_number || `Order #${o.id}`}
                      </div>
                      <div className="text-xs text-neutral-500 capitalize">
                        {o.status}
                      </div>
                    </div>
                    {o.status !== 'received' && o.status !== 'cancelled' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void markReceived(o.id)}
                        className="btn-primary !py-2 !px-4 text-sm"
                      >
                        Mark received
                      </button>
                    )}
                  </div>
                  <ul className="text-sm text-neutral-700 space-y-1">
                    {(o.items || []).map((it, i) => (
                      <li key={i}>
                        {it.product_name} × {it.quantity} {it.unit || ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContainerInventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-neutral-500">
          Loading inventory…
        </div>
      }
    >
      <InventoryContent />
    </Suspense>
  );
}
