'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { readCustomerBrand } from '@/lib/inventory/customer-brand';
import type { OrderChainSetup } from '@/lib/orders/chain-setup';
import { isPortalFinishedGood } from '@/lib/portals/trade-portal-workspace';

type CustomerOpt = {
  id: number;
  trading_name: string;
  logo_url?: string | null;
};
type SupplierOpt = {
  id: number;
  trading_name: string;
  status?: string | null;
  logo_url?: string | null;
};
type ProductOpt = {
  id: number;
  name: string;
  sku?: string | null;
  product_type?: string | null;
  status?: string | null;
  is_sellable?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

type Draft = {
  id?: number;
  customer_id: string;
  srm_supplier_id: string;
  product_ids: number[];
};

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function OrderChainSetupBoard({
  companyId,
  privyUserId,
}: {
  companyId: number;
  privyUserId: string;
}) {
  const [setups, setSetups] = useState<OrderChainSetup[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    customer_id: '',
    srm_supplier_id: '',
    product_ids: [],
  });

  const qs = useMemo(
    () =>
      `companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId)}`,
    [companyId, privyUserId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [setupRes, custRes, srmRes, prodRes] = await Promise.all([
        fetch(`/api/orders/chain-setups?${qs}`),
        fetch(`/api/customers?${qs}`),
        fetch(`/api/suppliers?${qs}`),
        fetch(`/api/inventory/products?companyId=${companyId}`),
      ]);
      const setupJson = await setupRes.json();
      const custJson = await custRes.json();
      const srmJson = await srmRes.json();
      const prodJson = await prodRes.json();
      if (!setupRes.ok) throw new Error(setupJson.error || 'Failed to load setups');
      setSetups((setupJson.setups || []).filter(Boolean));
      if (setupJson.warning) setHint(String(setupJson.warning));
      else setHint(null);
      setCustomers(
        ((custJson.customers || []) as CustomerOpt[]).filter((c) => c.id > 0)
      );
      setSuppliers(
        ((srmJson.suppliers || []) as SupplierOpt[]).filter(
          (s) =>
            s.id > 0 && String(s.status || '').toLowerCase() !== 'blocked'
        )
      );
      setProducts(
        ((prodJson.products || []) as ProductOpt[]).filter((p) => {
          const st = String(p.status || 'active').toLowerCase();
          if (st === 'archived' || st === 'inactive' || st === 'deleted') {
            return false;
          }
          if (p.is_sellable === false) return false;
          return isPortalFinishedGood(p.product_type);
        })
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [qs, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const customerName = (id: number | null) =>
    customers.find((c) => c.id === id)?.trading_name || null;
  const supplierName = (id: number | null) =>
    suppliers.find((s) => s.id === id)?.trading_name || null;

  const save = async (row: Draft) => {
    const customer_id = Number(row.customer_id);
    const srm_supplier_id = Number(row.srm_supplier_id);
    if (!customer_id || !srm_supplier_id || !row.product_ids.length) {
      setError('Pick a customer, at least one product, and a supplier.');
      return;
    }
    const key = row.id ? String(row.id) : 'new';
    setSavingId(key);
    setError(null);
    try {
      const res = await fetch('/api/orders/chain-setups', {
        method: row.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: row.id,
          customer_id,
          customer_name: customerName(customer_id),
          srm_supplier_id,
          supplier_name: supplierName(srm_supplier_id),
          product_ids: row.product_ids,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      if (!row.id) {
        setComposer(false);
        setDraft({ customer_id: '', srm_supplier_id: '', product_ids: [] });
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Remove this order chain routing? Live orders stay in place.')) {
      return;
    }
    setSavingId(String(id));
    try {
      const res = await fetch(
        `/api/orders/chain-setups?id=${id}&${qs}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Remove failed');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-[#00b4d8]" />
        Loading chain setups…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
            Set up routing
          </p>
          <h2 className="text-lg font-black text-slate-900">Order chains</h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Each chain is three cards: the customer, which of your finished
            goods they order, and the supplier who makes those goods. You can
            have many chains — different products can go to different
            suppliers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposer((v) => !v)}
          className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {composer ? 'Cancel' : 'Add chain'}
        </button>
      </div>
      {hint ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {composer ? (
        <ChainTriple
          customers={customers}
          suppliers={suppliers}
          products={products}
          draft={draft}
          busy={savingId === 'new'}
          saveLabel="Save chain"
          onChange={setDraft}
          onSave={() => void save(draft)}
        />
      ) : null}

      {setups.map((s) => (
        <SavedChain
          key={s.id}
          setup={s}
          customers={customers}
          suppliers={suppliers}
          products={products}
          busy={savingId === String(s.id)}
          onSave={(d) => void save({ ...d, id: s.id })}
          onRemove={() => void remove(s.id)}
        />
      ))}

      {!setups.length && !composer ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500 text-center">
          No routing yet. Add a chain: pick the customer, tick the products,
          pick the supplier. The next portal purchase order for those products
          raises a linked PO to that supplier.
        </p>
      ) : null}
    </div>
  );
}

function SavedChain({
  setup,
  customers,
  suppliers,
  products,
  busy,
  onSave,
  onRemove,
}: {
  setup: OrderChainSetup;
  customers: CustomerOpt[];
  suppliers: SupplierOpt[];
  products: ProductOpt[];
  busy: boolean;
  onSave: (d: Draft) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    customer_id: setup.customer_id ? String(setup.customer_id) : '',
    srm_supplier_id: setup.srm_supplier_id ? String(setup.srm_supplier_id) : '',
    product_ids: setup.product_ids,
  });
  useEffect(() => {
    setDraft({
      customer_id: setup.customer_id ? String(setup.customer_id) : '',
      srm_supplier_id: setup.srm_supplier_id ? String(setup.srm_supplier_id) : '',
      product_ids: setup.product_ids,
    });
  }, [setup.id, setup.customer_id, setup.srm_supplier_id, setup.product_ids]);

  return (
    <ChainTriple
      customers={customers}
      suppliers={suppliers}
      products={products}
      draft={draft}
      busy={busy}
      saveLabel="Update chain"
      onChange={setDraft}
      onSave={() => onSave(draft)}
      onRemove={onRemove}
    />
  );
}

function ChainTriple({
  customers,
  suppliers,
  products,
  draft,
  busy,
  saveLabel,
  onChange,
  onSave,
  onRemove,
}: {
  customers: CustomerOpt[];
  suppliers: SupplierOpt[];
  products: ProductOpt[];
  draft: Draft;
  busy: boolean;
  saveLabel: string;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onRemove?: () => void;
}) {
  const customerId = Number(draft.customer_id) || null;
  const sorted = useMemo(() => {
    const branded: ProductOpt[] = [];
    const rest: ProductOpt[] = [];
    for (const p of products) {
      const tag = readCustomerBrand(asMeta(p.metadata));
      if (customerId && tag.customer_brand && tag.customer_id === customerId) {
        branded.push(p);
      } else {
        rest.push(p);
      }
    }
    return { branded, rest };
  }, [products, customerId]);

  const toggle = (id: number) => {
    const has = draft.product_ids.includes(id);
    onChange({
      ...draft,
      product_ids: has
        ? draft.product_ids.filter((x) => x !== id)
        : [...draft.product_ids, id],
    });
  };

  const selectCustomer = (id: string) => {
    const cid = Number(id);
    const auto: number[] = [];
    if (cid > 0) {
      for (const p of products) {
        const tag = readCustomerBrand(asMeta(p.metadata));
        if (tag.customer_brand && tag.customer_id === cid) auto.push(p.id);
      }
    }
    onChange({
      ...draft,
      customer_id: id,
      product_ids: auto.length ? auto : draft.product_ids,
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
            1 · Customer
          </p>
          <p className="mt-1 text-sm font-black text-slate-900">Who orders</p>
          <select
            className="input mt-3 w-full !p-2.5 !text-sm"
            value={draft.customer_id}
            onChange={(e) => selectCustomer(e.target.value)}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.trading_name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-slate-500">
            Their portal purchase orders for the products on this chain route
            here.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
            2 · Your products
          </p>
          <p className="mt-1 text-sm font-black text-slate-900">
            What goes on this chain
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {draft.product_ids.length} selected. Customer-brand SKUs are listed
            first when a customer is picked.
          </p>
          <div className="mt-3 max-h-56 overflow-y-auto space-y-3 pr-1">
            {sorted.branded.length ? (
              <ProductChecks
                title="Customer brand"
                products={sorted.branded}
                selected={draft.product_ids}
                onToggle={toggle}
              />
            ) : null}
            <ProductChecks
              title={sorted.branded.length ? 'Other finished goods' : 'Finished goods'}
              products={sorted.rest}
              selected={draft.product_ids}
              onToggle={toggle}
            />
            {!products.length ? (
              <p className="text-[11px] text-amber-800">
                No sellable finished goods yet — add them under Inventory.
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
            3 · Supplier
          </p>
          <p className="mt-1 text-sm font-black text-slate-900">Who makes them</p>
          <select
            className="input mt-3 w-full !p-2.5 !text-sm"
            value={draft.srm_supplier_id}
            onChange={(e) =>
              onChange({ ...draft, srm_supplier_id: e.target.value })
            }
          >
            <option value="">Select supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.trading_name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-slate-500">
            A linked purchase order is raised to this supplier. They never see
            the customer’s selling price.
          </p>
        </section>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onRemove ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5 text-rose-700 border-rose-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function ProductChecks({
  title,
  products,
  selected,
  onToggle,
}: {
  title: string;
  products: ProductOpt[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  if (!products.length) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {title}
      </p>
      <ul className="space-y-1">
        {products.map((p) => {
          const on = selected.includes(p.id);
          return (
            <li key={p.id}>
              <label className="flex items-start gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-white cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={on}
                  onChange={() => onToggle(p.id)}
                />
                <span>
                  <span className="font-semibold text-slate-800">{p.name}</span>
                  {p.sku ? (
                    <span className="block text-[11px] text-slate-500">
                      {p.sku}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
