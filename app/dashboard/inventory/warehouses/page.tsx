'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  Trash2,
  Warehouse,
  Package,
  Building2,
  Truck,
  Users,
  Pencil,
  X,
  MapPin,
  ArrowLeftRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  WAREHOUSE_OWNER_TYPES,
  WAREHOUSE_TYPES,
  ownerTypeClass,
  ownerTypeLabel,
  type WarehouseOwnerType,
  type WarehouseRecord,
} from '@/lib/inventory/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

type Ctr = {
  id: number;
  name: string;
  container_code?: string;
  city?: string | null;
  status?: string | null;
};

type FormState = {
  name: string;
  code: string;
  owner_type: WarehouseOwnerType;
  warehouse_type: string;
  partner_name: string;
  partner_ref: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  city: string;
  country: string;
  postal_code: string;
  region: string;
  notes: string;
  is_default: boolean;
  allow_stock: boolean;
  status: string;
};

const emptyForm = (): FormState => ({
  name: '',
  code: '',
  owner_type: 'own',
  warehouse_type: 'warehouse',
  partner_name: '',
  partner_ref: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  city: '',
  country: '',
  postal_code: '',
  region: '',
  notes: '',
  is_default: false,
  allow_stock: true,
  status: 'active',
});

export default function WarehousesPage() {
  return (
    <CompanyRequired>
      <WarehousesInner />
    </CompanyRequired>
  );
}

function WarehousesInner() {
  const companyId = getSelectedCompanyId()!;
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [containers, setContainers] = useState<Ctr[]>([]);
  const [counts, setCounts] = useState({ own: 0, supplier: 0, customer: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | WarehouseOwnerType>('all');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/warehouses?companyId=${companyId}`);
      const data = await res.json();
      setWarehouses(data.warehouses || []);
      setContainers(data.containers || []);
      setCounts(data.counts || { own: 0, supplier: 0, customer: 0, total: 0 });
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return warehouses;
    return warehouses.filter((w) => (w.owner_type || 'own') === filter);
  }, [warehouses, filter]);

  const typeOptions = useMemo(() => {
    return WAREHOUSE_TYPES.filter(
      (t) => !t.owners || t.owners.includes(form.owner_type)
    );
  }, [form.owner_type]);

  const openCreate = (owner: WarehouseOwnerType = 'own') => {
    const f = emptyForm();
    f.owner_type = owner;
    f.warehouse_type =
      owner === 'supplier' ? 'supplier_dc' : owner === 'customer' ? 'customer_site' : 'warehouse';
    setForm(f);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (w: WarehouseRecord) => {
    setForm({
      name: w.name || '',
      code: w.code || '',
      owner_type: (w.owner_type as WarehouseOwnerType) || 'own',
      warehouse_type: w.warehouse_type || 'warehouse',
      partner_name: w.partner_name || '',
      partner_ref: w.partner_ref || '',
      contact_name: w.contact_name || '',
      contact_email: w.contact_email || '',
      contact_phone: w.contact_phone || '',
      address: w.address || '',
      city: w.city || '',
      country: w.country || '',
      postal_code: w.postal_code || '',
      region: w.region || '',
      notes: w.notes || '',
      is_default: !!w.is_default,
      allow_stock: w.allow_stock !== false,
      status: w.status || 'active',
    });
    setEditingId(w.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Location name required');
      return;
    }
    if (
      (form.owner_type === 'supplier' || form.owner_type === 'customer') &&
      !form.partner_name.trim()
    ) {
      toast.error(
        form.owner_type === 'supplier'
          ? 'Supplier / partner name required'
          : 'Customer / partner name required'
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        companyId,
        ...form,
        partner_name: form.partner_name || undefined,
        code: form.code || undefined,
      };
      const res = await fetch('/api/inventory/warehouses', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      toast.success(editingId ? 'Location updated' : 'Location added');
      if (data.warning) toast.message(data.warning);
      setShowForm(false);
      setForm(emptyForm());
      setEditingId(null);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this location? Stock must be zero.')) return;
    const res = await fetch(`/api/inventory/warehouses?id=${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (res.ok) {
      toast.success('Deleted');
      void load();
    } else {
      toast.error(d.error || 'Failed');
    }
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <InventoryHeader
        title="Locations"
        description="Step 2 — your DCs, supplier plants, and customer sites. One network for stock, counts, and transfers."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/inventory/stock-transfers"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-4 h-4" /> Transfers
            </Link>
            <button
              type="button"
              onClick={() => openCreate('own')}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add location
            </button>
          </div>
        }
      />

      {/* Owner KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {(
          [
            { key: 'all' as const, label: 'All locations', n: counts.total, icon: MapPin },
            { key: 'own' as const, label: 'Mine', n: counts.own, icon: Building2 },
            { key: 'supplier' as const, label: 'Supplier', n: counts.supplier, icon: Truck },
            { key: 'customer' as const, label: 'Customer', n: counts.customer, icon: Users },
          ] as const
        ).map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={`rounded-3xl border p-4 text-left transition-all ${
              filter === c.key
                ? 'border-[#00b4d8] bg-[#00b4d8]/5 shadow-sm'
                : 'border-neutral-200 bg-white hover:border-neutral-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <c.icon className="w-4 h-4 text-[#00b4d8]" />
              <span className="text-2xl font-black tracking-tighter">{c.n}</span>
            </div>
            <div className="text-xs font-medium text-neutral-600">{c.label}</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form panel */}
        <div className={`lg:col-span-2 ${showForm ? '' : 'hidden lg:block'}`}>
          <div className="bg-white border rounded-3xl p-5 space-y-3 h-fit sticky top-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2">
                {editingId ? (
                  <>
                    <Pencil className="w-4 h-4 text-[#00b4d8]" /> Edit location
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-[#00b4d8]" /> Add location
                  </>
                )}
              </h2>
              {showForm && (
                <button
                  type="button"
                  className="lg:hidden p-1.5 rounded-lg hover:bg-neutral-100"
                  onClick={() => setShowForm(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Owner type */}
            <div>
              <label className="text-xs font-medium text-neutral-500 mb-1.5 block">
                Who owns this location?
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {WAREHOUSE_OWNER_TYPES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        owner_type: o.value,
                        warehouse_type:
                          o.value === 'supplier'
                            ? 'supplier_dc'
                            : o.value === 'customer'
                              ? 'customer_site'
                              : f.warehouse_type === 'supplier_dc' || f.warehouse_type === 'customer_site'
                                ? 'warehouse'
                                : f.warehouse_type,
                      }));
                    }}
                    className={`py-2 px-1 rounded-xl text-[11px] font-semibold border transition-all ${
                      form.owner_type === o.value
                        ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                        : 'border-neutral-200 text-neutral-600'
                    }`}
                  >
                    {o.label.replace(' location', '').replace('My warehouse', 'Mine')}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1.5">
                {WAREHOUSE_OWNER_TYPES.find((o) => o.value === form.owner_type)?.description}
              </p>
            </div>

            <input
              className="input w-full !p-3 !text-sm"
              placeholder="Location name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            {(form.owner_type === 'supplier' || form.owner_type === 'customer') && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input !p-3 !text-sm col-span-2"
                  placeholder={
                    form.owner_type === 'supplier' ? 'Supplier company name *' : 'Customer company name *'
                  }
                  value={form.partner_name}
                  onChange={(e) => setForm({ ...form, partner_name: e.target.value })}
                />
                <input
                  className="input !p-3 !text-sm font-mono col-span-2"
                  placeholder="Partner ref / account code"
                  value={form.partner_ref}
                  onChange={(e) => setForm({ ...form, partner_ref: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                className="input !p-3 !text-sm font-mono"
                placeholder="Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <select
                className="input !p-3 !text-sm"
                value={form.warehouse_type}
                onChange={(e) => setForm({ ...form, warehouse_type: e.target.value })}
              >
                {typeOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              className="input w-full !p-3 !text-sm min-h-[56px]"
              placeholder="Street address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input !p-3 !text-sm"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <input
                className="input !p-3 !text-sm"
                placeholder="Country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
              <input
                className="input !p-3 !text-sm"
                placeholder="Postal code"
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
              />
              <input
                className="input !p-3 !text-sm"
                placeholder="Region / province"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-neutral-500">Site contact</p>
              <input
                className="input w-full !p-3 !text-sm"
                placeholder="Contact name"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input !p-3 !text-sm"
                  placeholder="Email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
                <input
                  className="input !p-3 !text-sm"
                  placeholder="Phone"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                />
              </div>
            </div>

            <textarea
              className="input w-full !p-3 !text-sm min-h-[48px]"
              placeholder="Notes (access hours, dock rules…)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            <div className="flex flex-wrap gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allow_stock}
                  onChange={(e) => setForm({ ...form, allow_stock: e.target.checked })}
                />
                Track stock here
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Default location
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              {editingId && (
                <button
                  type="button"
                  className="btn-secondary flex-1 !py-3"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm());
                    setShowForm(false);
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="btn-primary flex-1 !py-3"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : editingId ? (
                  'Save changes'
                ) : (
                  'Save location'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-3 space-y-4">
          {!showForm && (
            <button
              type="button"
              onClick={() => openCreate(filter === 'all' ? 'own' : filter)}
              className="lg:hidden w-full btn-primary !py-3 mb-2"
            >
              <Plus className="w-4 h-4" /> Add location
            </button>
          )}

          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold text-sm flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-[#00b4d8]" />
              {filter === 'all'
                ? 'All locations'
                : filter === 'own'
                  ? 'My warehouses'
                  : filter === 'supplier'
                    ? 'Supplier locations'
                    : 'Customer locations'}
              <span className="text-neutral-400 font-normal">({filtered.length})</span>
            </div>
            {loading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-neutral-500 text-sm">
                <p className="mb-3">No locations in this view yet.</p>
                <button
                  type="button"
                  onClick={() => openCreate(filter === 'all' ? 'own' : filter)}
                  className="btn-primary !py-2 !px-4 text-sm"
                >
                  Add first location
                </button>
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((w) => (
                  <li key={w.id} className="px-5 py-4 flex justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-semibold text-slate-900">{w.name}</span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${ownerTypeClass(w.owner_type)}`}
                        >
                          {ownerTypeLabel(w.owner_type)}
                        </span>
                        {w.is_default && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                            Default
                          </span>
                        )}
                      </div>
                      {(w.partner_name || w.owner_type !== 'own') && (
                        <div className="text-xs text-neutral-600">
                          {w.partner_name || '—'}
                          {w.partner_ref ? ` · ${w.partner_ref}` : ''}
                        </div>
                      )}
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {[
                          w.code,
                          w.warehouse_type?.replace(/_/g, ' '),
                          w.city,
                          w.country,
                          w.status,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {w.stock_lines || 0} lines · {Math.round(w.units_on_hand || 0)} units
                        {w.contact_name ? ` · ${w.contact_name}` : ''}
                      </div>
                    </div>
                    <div className="flex items-start gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(w)}
                        className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-xl"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(w.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-xl"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-[#00b4d8]" /> Retail containers (outlets)
            </div>
            {containers.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">
                No containers —{' '}
                <Link href="/dashboard/containers/manage" className="text-[#00b4d8] font-medium">
                  manage containers
                </Link>
              </div>
            ) : (
              <ul className="divide-y">
                {containers.map((c) => (
                  <li key={c.id} className="px-5 py-3 text-sm flex justify-between">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-neutral-500 font-mono">
                        {c.container_code} · {c.city || '—'}
                      </div>
                    </div>
                    <span className="text-xs capitalize text-neutral-500">{c.status || 'active'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-xs text-sky-900">
            <strong>Tip:</strong> Add supplier DCs for inbound raw materials and customer sites for
            outbound finished goods. Then use{' '}
            <Link href="/dashboard/inventory/stock-transfers" className="underline font-semibold">
              Stock transfers
            </Link>{' '}
            to draft → ship → receive between any locations.
          </div>
        </div>
      </div>
    </div>
  );
}
