'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fieldClass,
} from '@/components/hire/SimpleEntityForm';
import {
  HIRE_CATEGORIES,
  ITEM_STATUSES,
  getHireCategory,
  type HireItem,
} from '@/lib/hire/hiregraph';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ProductRecord } from '@/lib/inventory/types';

const BLANK_ITEM_FORM = {
  code: '',
  title: '',
  category_id: 'kids_party',
  srm_supplier_id: '',
  rate_zar: '',
  rate_unit: 'day',
  qty_available: '1',
  deposit_zar: '',
  location: '',
  status: 'listed',
  description: '',
  includes: '',
  excludes: '',
  specs: '',
  condition_notes: '',
  min_units: '1',
  fulfillment: 'collect',
  delivery_fee_zar: '',
  delivery_radius_km: '',
  collect_hours: '',
  replacement_value_zar: '',
  fuel_or_power: '',
  age_or_weight_limit: '',
  operator_included: false,
  cancellation_note: '',
};

export default function HireCataloguePage() {
  const { store, coreSuppliers, loading, saving, post, summary } =
    useHiregraph();
  const companyId = getSelectedCompanyId();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [invForm, setInvForm] = useState({
    productId: '',
    category_id: 'tools_equipment',
    rate_zar: '',
    rate_unit: 'day',
    deposit_zar: '',
    srm_supplier_id: '',
    location: '',
  });
  const [form, setForm] = useState(BLANK_ITEM_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedCat = getHireCategory(form.category_id);
  const invCat = getHireCategory(invForm.category_id);
  const listedProductIds = useMemo(() => {
    const ids = new Set<number>();
    for (const i of store?.items || []) {
      const n = Number(i.inventory_product_id);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
    return ids;
  }, [store]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void fetch(`/api/inventory/products?companyId=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data.products || []) as ProductRecord[];
        setProducts(
          list.filter((p) => !p.status || p.status === 'active')
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const selectedProduct = products.find(
    (p) => String(p.id) === invForm.productId
  );

  const hireFromInventory = async () => {
    if (!invForm.productId) {
      toast.error('Select an inventory product');
      return;
    }
    const cat = getHireCategory(invForm.category_id);
    await post({
      action: 'list_from_inventory',
      productId: Number(invForm.productId),
      category_id: invForm.category_id,
      rate_zar: Number(invForm.rate_zar) || Number(selectedProduct?.sell_price) || 0,
      rate_unit: invForm.rate_unit || cat?.unit || 'day',
      deposit_zar: invForm.deposit_zar ? Number(invForm.deposit_zar) : null,
      srm_supplier_id: invForm.srm_supplier_id
        ? Number(invForm.srm_supplier_id)
        : null,
      location: invForm.location || null,
    });
    toast.success('Listed for hire on the marketplace');
    setInvForm((f) => ({ ...f, productId: '', rate_zar: '', deposit_zar: '' }));
  };

  const loadItem = (item: HireItem) => {
    setEditingId(item.id);
    setForm({
      code: item.code || '',
      title: item.title || '',
      category_id: item.category_id || 'kids_party',
      srm_supplier_id: item.srm_supplier_id ? String(item.srm_supplier_id) : '',
      rate_zar: item.rate_zar != null ? String(item.rate_zar) : '',
      rate_unit: item.rate_unit || 'day',
      qty_available:
        item.qty_available != null ? String(item.qty_available) : '1',
      deposit_zar: item.deposit_zar != null ? String(item.deposit_zar) : '',
      location: item.location || '',
      status: String(item.status || 'listed'),
      description: item.description || '',
      includes: item.includes || '',
      excludes: item.excludes || '',
      specs: item.specs || '',
      condition_notes: item.condition_notes || '',
      min_units: item.min_units != null ? String(item.min_units) : '1',
      fulfillment: item.fulfillment || 'collect',
      delivery_fee_zar:
        item.delivery_fee_zar != null ? String(item.delivery_fee_zar) : '',
      delivery_radius_km:
        item.delivery_radius_km != null ? String(item.delivery_radius_km) : '',
      collect_hours: item.collect_hours || '',
      replacement_value_zar:
        item.replacement_value_zar != null
          ? String(item.replacement_value_zar)
          : '',
      fuel_or_power: item.fuel_or_power || '',
      age_or_weight_limit: item.age_or_weight_limit || '',
      operator_included: item.operator_included === true,
      cancellation_note: item.cancellation_note || '',
    });
  };

  const add = async () => {
    if (!form.code.trim() || !form.title.trim()) {
      toast.error('Code and title required');
      return;
    }
    const srmId = Number(form.srm_supplier_id);
    if (!Number.isFinite(srmId) || srmId <= 0) {
      toast.error('Select a supplier from Core Suppliers');
      return;
    }
    const supplier = coreSuppliers.find((s) => s.id === srmId);
    const cat = HIRE_CATEGORIES.find((c) => c.id === form.category_id);
    await post({
      entity: 'items',
      action: 'upsert',
      record: {
        ...(editingId ? { id: editingId } : {}),
        code: form.code,
        title: form.title,
        category_id: form.category_id,
        srm_supplier_id: srmId,
        supplier_name: supplier?.name || '',
        category_name: cat?.name || '',
        rate_zar: Number(form.rate_zar) || 0,
        rate_unit: form.rate_unit,
        qty_available: form.qty_available ? Number(form.qty_available) : 1,
        deposit_zar: form.deposit_zar ? Number(form.deposit_zar) : null,
        location: form.location,
        status: form.status,
        description: form.description,
        includes: form.includes,
        excludes: form.excludes,
        specs: form.specs,
        condition_notes: form.condition_notes,
        min_units: Number(form.min_units) || 1,
        fulfillment: form.fulfillment,
        delivery_fee_zar: form.delivery_fee_zar
          ? Number(form.delivery_fee_zar)
          : null,
        delivery_radius_km: form.delivery_radius_km
          ? Number(form.delivery_radius_km)
          : null,
        collect_hours: form.collect_hours,
        replacement_value_zar: form.replacement_value_zar
          ? Number(form.replacement_value_zar)
          : null,
        fuel_or_power: form.fuel_or_power,
        age_or_weight_limit: form.age_or_weight_limit,
        operator_included: form.operator_included,
        cancellation_note: form.cancellation_note,
        active: true,
      },
    });
    toast.success(
      editingId ? 'Hire listing updated' : 'Item listed against core supplier'
    );
    setEditingId(null);
    setForm(BLANK_ITEM_FORM);
  };

  return (
    <HiregraphWorkbench
      title="Catalogue"
      titleAccent="items for hire"
      description="List gear against a Core Suppliers (SRM) row. Category rules (licence, deposit, castle safety…) apply automatically when a person from Core Customers books."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 dark:border-sky-500/30 dark:bg-sky-950/40">
            <p className="text-sm text-sky-950 dark:text-sky-50">
              <strong>Owner of gear:</strong> pick from Core Suppliers — manage
              the book under Suppliers module.
            </p>
            <Link
              href="/dashboard/suppliers"
              className="inline-flex items-center gap-1 rounded-full bg-sky-700 px-3 py-1.5 text-xs font-bold text-white"
            >
              Open Suppliers <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <StatRow
            tone="hg-client"
            items={[
              {
                label: 'Items',
                value: Number(summary?.itemCount) || store.items.length,
              },
              { label: 'Listed', value: Number(summary?.listedItems) || 0 },
              {
                label: 'From inventory',
                value: listedProductIds.size,
              },
              {
                label: 'Core suppliers',
                value: coreSuppliers.length,
              },
            ]}
          />

          <FormCard
            title="Hire out inventory"
            tone="hg-client"
            saving={saving}
            submitLabel="List for hire"
            onSubmit={() => void hireFromInventory()}
          >
            <p className="mb-3 text-[12px] text-slate-600 dark:text-slate-300">
              Pick a product from Core Inventory. It is added to this hire
              catalogue and published on the marketplace as <strong>for hire</strong>
              {' '}
              (rate per {invCat?.unit || 'day'}). Own stock does not need a
              supplier row.
            </p>
            {products.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                No inventory products yet.{' '}
                <Link
                  href="/dashboard/inventory/products"
                  className="font-bold underline"
                >
                  Add products
                </Link>{' '}
                then come back to hire them out.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold sm:col-span-2">
                  Inventory product
                  <select
                    className={fieldClass()}
                    value={invForm.productId}
                    onChange={(e) => {
                      const p = products.find(
                        (x) => String(x.id) === e.target.value
                      );
                      const cat = getHireCategory(invForm.category_id);
                      setInvForm({
                        ...invForm,
                        productId: e.target.value,
                        rate_zar:
                          invForm.rate_zar ||
                          (p?.sell_price != null ? String(p.sell_price) : ''),
                        rate_unit: invForm.rate_unit || cat?.unit || 'day',
                      });
                    }}
                  >
                    <option value="">— select product —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.sku ? ` · ${p.sku}` : ''}
                        {p.qty_on_hand != null
                          ? ` · ${p.qty_on_hand} on hand`
                          : ''}
                        {listedProductIds.has(Number(p.id)) ? ' · listed' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold">
                  Hire category
                  <select
                    className={fieldClass()}
                    value={invForm.category_id}
                    onChange={(e) => {
                      const cat = getHireCategory(e.target.value);
                      setInvForm({
                        ...invForm,
                        category_id: e.target.value,
                        rate_unit: cat?.unit || invForm.rate_unit,
                      });
                    }}
                  >
                    {HIRE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold">
                  Supplier (optional)
                  <select
                    className={fieldClass()}
                    value={invForm.srm_supplier_id}
                    onChange={(e) =>
                      setInvForm({ ...invForm, srm_supplier_id: e.target.value })
                    }
                  >
                    <option value="">Own inventory</option>
                    {coreSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold">
                  Hire rate (R)
                  <input
                    className={fieldClass()}
                    value={invForm.rate_zar}
                    onChange={(e) =>
                      setInvForm({ ...invForm, rate_zar: e.target.value })
                    }
                    placeholder="Per day / hour"
                  />
                </label>
                <label className="text-xs font-bold">
                  Rate unit
                  <select
                    className={fieldClass()}
                    value={invForm.rate_unit}
                    onChange={(e) =>
                      setInvForm({ ...invForm, rate_unit: e.target.value })
                    }
                  >
                    {['hour', 'day', 'week', 'weekend'].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold">
                  Deposit (R)
                  <input
                    className={fieldClass()}
                    value={invForm.deposit_zar}
                    onChange={(e) =>
                      setInvForm({ ...invForm, deposit_zar: e.target.value })
                    }
                  />
                </label>
                <label className="text-xs font-bold">
                  Location
                  <input
                    className={fieldClass()}
                    value={invForm.location}
                    onChange={(e) =>
                      setInvForm({ ...invForm, location: e.target.value })
                    }
                  />
                </label>
              </div>
            )}
          </FormCard>

          <FormCard
            title={
              editingId
                ? 'Edit hire listing — what the hirer needs to know'
                : 'List hire item — include everything the hirer needs'
            }
            tone="hg-client"
            saving={saving}
            submitLabel={editingId ? 'Save listing' : 'List item'}
            onSubmit={() => void add()}
          >
            {editingId ? (
              <button
                type="button"
                className="mb-2 text-[11px] font-bold text-slate-500 underline"
                onClick={() => {
                  setEditingId(null);
                  setForm(BLANK_ITEM_FORM);
                }}
              >
                Cancel edit — list a new item
              </button>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Code
                <input
                  className={fieldClass()}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold">
                Title
                <input
                  className={fieldClass()}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold">
                Category
                <select
                  className={fieldClass()}
                  value={form.category_id}
                  onChange={(e) => {
                    const cat = HIRE_CATEGORIES.find(
                      (c) => c.id === e.target.value
                    );
                    setForm({
                      ...form,
                      category_id: e.target.value,
                      rate_unit: cat?.unit || form.rate_unit,
                    });
                  }}
                >
                  {HIRE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedCat?.examples?.length ? (
                <div className="sm:col-span-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-[11px] text-violet-950 dark:border-violet-500/25 dark:bg-violet-950/40 dark:text-violet-50">
                  <span className="font-black">
                    {selectedCat.short} examples:{' '}
                  </span>
                  {selectedCat.examples.join(' · ')}
                  {selectedCat.id === 'kids_party' ? (
                    <span className="mt-1 block font-semibold text-violet-800 dark:text-violet-200">
                      Jumping castles need flat ground, 220V power, adult
                      supervision and age/weight limits — applied
                      automatically on booking.
                    </span>
                  ) : null}
                </div>
              ) : null}
              <label className="text-xs font-bold">
                Supplier (Core SRM)
                <select
                  className={fieldClass()}
                  value={form.srm_supplier_id}
                  onChange={(e) =>
                    setForm({ ...form, srm_supplier_id: e.target.value })
                  }
                >
                  <option value="">— select from Suppliers —</option>
                  {coreSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.city ? ` · ${s.city}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {coreSuppliers.length === 0 ? (
                <p className="sm:col-span-2 text-[11px] text-amber-800 dark:text-amber-100">
                  No core suppliers yet.{' '}
                  <Link
                    href="/dashboard/suppliers"
                    className="font-bold underline"
                  >
                    Add one in Suppliers
                  </Link>{' '}
                  first.
                </p>
              ) : null}
              <label className="text-xs font-bold">
                Rate (R)
                <input
                  className={fieldClass()}
                  value={form.rate_zar}
                  onChange={(e) =>
                    setForm({ ...form, rate_zar: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Rate unit
                <select
                  className={fieldClass()}
                  value={form.rate_unit}
                  onChange={(e) =>
                    setForm({ ...form, rate_unit: e.target.value })
                  }
                >
                  {['hour', 'day', 'week', 'weekend'].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Qty available
                <input
                  className={fieldClass()}
                  value={form.qty_available}
                  onChange={(e) =>
                    setForm({ ...form, qty_available: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Deposit (R)
                <input
                  className={fieldClass()}
                  value={form.deposit_zar}
                  onChange={(e) =>
                    setForm({ ...form, deposit_zar: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Status
                <select
                  className={fieldClass()}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {ITEM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Location
                <input
                  className={fieldClass()}
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Description (what they are hiring)
                <textarea
                  className={fieldClass()}
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="What it is, size, typical use"
                />
              </label>
              <label className="text-xs font-bold">
                Included
                <input
                  className={fieldClass()}
                  value={form.includes}
                  onChange={(e) =>
                    setForm({ ...form, includes: e.target.value })
                  }
                  placeholder="Blower, pegs, safety mat…"
                />
              </label>
              <label className="text-xs font-bold">
                Not included
                <input
                  className={fieldClass()}
                  value={form.excludes}
                  onChange={(e) =>
                    setForm({ ...form, excludes: e.target.value })
                  }
                  placeholder="Extension lead, operator…"
                />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Specs / size
                <input
                  className={fieldClass()}
                  value={form.specs}
                  onChange={(e) => setForm({ ...form, specs: e.target.value })}
                  placeholder="4×5 m castle · 5 kVA · bakkie 1-ton"
                />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Condition notes
                <input
                  className={fieldClass()}
                  value={form.condition_notes}
                  onChange={(e) =>
                    setForm({ ...form, condition_notes: e.target.value })
                  }
                  placeholder="Scratches on lid · recently serviced"
                />
              </label>
              <label className="text-xs font-bold">
                Min hire
                <input
                  className={fieldClass()}
                  value={form.min_units}
                  onChange={(e) =>
                    setForm({ ...form, min_units: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Collect or deliver
                <select
                  className={fieldClass()}
                  value={form.fulfillment}
                  onChange={(e) =>
                    setForm({ ...form, fulfillment: e.target.value })
                  }
                >
                  <option value="collect">Collect</option>
                  <option value="delivery">Delivery</option>
                  <option value="both">Collect or delivery</option>
                </select>
              </label>
              <label className="text-xs font-bold">
                Delivery fee (R)
                <input
                  className={fieldClass()}
                  value={form.delivery_fee_zar}
                  onChange={(e) =>
                    setForm({ ...form, delivery_fee_zar: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Delivery radius (km)
                <input
                  className={fieldClass()}
                  value={form.delivery_radius_km}
                  onChange={(e) =>
                    setForm({ ...form, delivery_radius_km: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Collect hours
                <input
                  className={fieldClass()}
                  value={form.collect_hours}
                  onChange={(e) =>
                    setForm({ ...form, collect_hours: e.target.value })
                  }
                  placeholder="Mon–Sat 08:00–16:00"
                />
              </label>
              <label className="text-xs font-bold">
                Replacement value (R)
                <input
                  className={fieldClass()}
                  value={form.replacement_value_zar}
                  onChange={(e) =>
                    setForm({ ...form, replacement_value_zar: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Power / fuel
                <input
                  className={fieldClass()}
                  value={form.fuel_or_power}
                  onChange={(e) =>
                    setForm({ ...form, fuel_or_power: e.target.value })
                  }
                  placeholder="220V / petrol / full-to-full"
                />
              </label>
              <label className="text-xs font-bold">
                Age / weight limit
                <input
                  className={fieldClass()}
                  value={form.age_or_weight_limit}
                  onChange={(e) =>
                    setForm({ ...form, age_or_weight_limit: e.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.operator_included}
                  onChange={(e) =>
                    setForm({ ...form, operator_included: e.target.checked })
                  }
                />
                Operator included
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Cancellation
                <input
                  className={fieldClass()}
                  value={form.cancellation_note}
                  onChange={(e) =>
                    setForm({ ...form, cancellation_note: e.target.value })
                  }
                  placeholder="48h notice or deposit held"
                />
              </label>
            </div>
          </FormCard>
          <DataTable
            tone="hg-client"
            headers={[
              'Code',
              'Title',
              'Source',
              'Category',
              'Rate',
              'Status',
            ]}
            rows={store.items.map((i) => ({
              id: i.id,
              cells: [
                i.code,
                <button
                  key={`${i.id}-edit`}
                  type="button"
                  className="text-left font-semibold text-cyan-800 underline"
                  onClick={() => loadItem(i)}
                >
                  {i.title}
                </button>,
                i.inventory_product_id
                  ? `Inventory #${i.inventory_product_id}`
                  : i.supplier_name ||
                    (i.srm_supplier_id ? `SRM #${i.srm_supplier_id}` : '—'),
                i.category_name || i.category_id,
                `R${Number(i.rate_zar || 0).toLocaleString('en-ZA')}/${i.rate_unit || 'day'}`,
                i.status || 'listed',
              ],
            }))}
            onDelete={async (id) => {
              await post({ entity: 'items', action: 'delete', id });
              toast.success('Item removed');
            }}
          />
        </div>
      )}
    </HiregraphWorkbench>
  );
}
