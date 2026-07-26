'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type Product = {
  id: number;
  name: string;
  brand_name: string;
  brand_id?: number | null;
  category: string;
  pack_size?: string | null;
  uom?: string | null;
  sku?: string | null;
  protein_g?: number | null;
  energy_kcal?: number | null;
  active?: boolean;
  notes?: string | null;
};

type Brand = {
  id: number;
  name: string;
  manufacturer?: string | null;
  active?: boolean;
};

const emptyProduct = {
  name: '',
  brand_name: '',
  brand_id: '' as string | number,
  category: 'commodity',
  pack_size: '',
  uom: 'kg',
  sku: '',
  energy_kcal: '',
  protein_g: '',
  notes: '',
  active: true,
};

export default function ApprovedListPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...emptyProduct });
  const [brandForm, setBrandForm] = useState({ name: '', manufacturer: '' });
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      if (showInactive) params.set('all', '1');
      const res = await fetch(`/api/schools/approved?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setProducts(data.products || []);
      setBrands(data.brands || []);
      setCategories(data.categories || []);
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, q, category, showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ ...emptyProduct });
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setCreating(false);
    setForm({
      name: p.name || '',
      brand_name: p.brand_name || '',
      brand_id: p.brand_id ?? '',
      category: p.category || 'commodity',
      pack_size: p.pack_size || '',
      uom: p.uom || 'kg',
      sku: p.sku || '',
      energy_kcal: p.energy_kcal != null ? String(p.energy_kcal) : '',
      protein_g: p.protein_g != null ? String(p.protein_g) : '',
      notes: p.notes || '',
      active: p.active !== false,
    });
  };

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
  };

  const saveProduct = async () => {
    if (!form.name.trim() || !form.brand_name.trim()) {
      toast.error('Name and brand required');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        companyId,
        name: form.name.trim(),
        brand_name: form.brand_name.trim(),
        brand_id: form.brand_id ? Number(form.brand_id) : null,
        category: form.category || 'commodity',
        pack_size: form.pack_size || null,
        uom: form.uom || 'kg',
        sku: form.sku || null,
        energy_kcal: form.energy_kcal ? Number(form.energy_kcal) : null,
        protein_g: form.protein_g ? Number(form.protein_g) : null,
        notes: form.notes || null,
        active: form.active,
      };
      const res = await fetch('/api/schools/approved', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editing ? { ...payload, id: editing.id, kind: 'product' } : payload
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(editing ? 'Product updated' : 'Product added');
      closeForm();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (p: Product) => {
    if (!confirm(`Deactivate “${p.name}”? Schools can no longer order it.`)) {
      return;
    }
    try {
      const res = await fetch(
        `/api/schools/approved?companyId=${companyId}&id=${p.id}&kind=product`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Product deactivated');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const reactivate = async (p: Product) => {
    try {
      const res = await fetch('/api/schools/approved', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          id: p.id,
          kind: 'product',
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Product reactivated');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const saveBrand = async () => {
    if (!brandForm.name.trim()) return toast.error('Brand name required');
    setSaving(true);
    try {
      const res = await fetch('/api/schools/approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          kind: 'brand',
          name: brandForm.name.trim(),
          manufacturer: brandForm.manufacturer || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Brand added');
      setBrandForm({ name: '', manufacturer: '' });
      setShowBrandForm(false);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const formOpen = creating || editing;

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="NSNP approved list"
        titleAccent="Edit catalogue"
        description="Add, edit, or deactivate brands and products. Only active items may be ordered or received into school kitchens."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowBrandForm((v) => !v)}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              + Brand
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Product
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        }
      />

      <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950 flex gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>Strict mode.</strong> Changes apply immediately to school
          POs and GRN checks. Prefer deactivate over hard-delete for audit
          history.
        </div>
      </div>

      {showBrandForm ? (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap gap-2 items-end">
          <label className="text-xs">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Brand name
            </span>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={brandForm.name}
              onChange={(e) =>
                setBrandForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Ace"
            />
          </label>
          <label className="text-xs">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Manufacturer
            </span>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={brandForm.manufacturer}
              onChange={(e) =>
                setBrandForm((f) => ({ ...f, manufacturer: e.target.value }))
              }
            />
          </label>
          <button
            type="button"
            onClick={() => void saveBrand()}
            disabled={saving}
            className="btn-primary !py-2 !px-3 text-xs"
          >
            Save brand
          </button>
        </div>
      ) : null}

      {formOpen ? (
        <div className="mb-6 rounded-3xl border border-sky-100 bg-sky-50/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black">
              {editing ? `Edit #${editing.id}` : 'New approved product'}
            </h3>
            <button type="button" onClick={closeForm} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Product name *">
              <input
                className="field-input"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Brand name *">
              <input
                className="field-input"
                value={form.brand_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brand_name: e.target.value }))
                }
                list="brand-names"
              />
              <datalist id="brand-names">
                {brands.map((b) => (
                  <option key={b.id} value={b.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Link brand record">
              <select
                className="field-input"
                value={String(form.brand_id || '')}
                onChange={(e) => {
                  const id = e.target.value;
                  const b = brands.find((x) => String(x.id) === id);
                  setForm((f) => ({
                    ...f,
                    brand_id: id,
                    brand_name: b?.name || f.brand_name,
                  }));
                }}
              >
                <option value="">— optional —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <input
                className="field-input"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="maize_meal, oil, beans…"
              />
            </Field>
            <Field label="Pack size">
              <input
                className="field-input"
                value={form.pack_size}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pack_size: e.target.value }))
                }
              />
            </Field>
            <Field label="UOM">
              <input
                className="field-input"
                value={form.uom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, uom: e.target.value }))
                }
              />
            </Field>
            <Field label="SKU">
              <input
                className="field-input"
                value={form.sku}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sku: e.target.value }))
                }
              />
            </Field>
            <Field label="Energy (kcal)">
              <input
                className="field-input"
                value={form.energy_kcal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, energy_kcal: e.target.value }))
                }
              />
            </Field>
            <Field label="Protein (g)">
              <input
                className="field-input"
                value={form.protein_g}
                onChange={(e) =>
                  setForm((f) => ({ ...f, protein_g: e.target.value }))
                }
              />
            </Field>
            <Field label="Notes">
              <input
                className="field-input"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </Field>
            <label className="inline-flex items-center gap-2 text-sm font-semibold pt-5">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              Active (orderable)
            </label>
          </div>
          <button
            type="button"
            onClick={() => void saveProduct()}
            disabled={saving}
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save product
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product / brand…"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-56"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <span className="text-xs text-slate-400">
          {products.length} products · {brands.length} brands
        </span>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">Product</th>
                <th className="px-3 py-3">Brand</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Pack</th>
                <th className="px-3 py-3">Nutrition</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No products — add one or run the seed migration.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-50 hover:bg-sky-50/30 ${
                      p.active === false ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                    <td className="px-3 py-2.5 font-bold text-emerald-800">
                      {p.brand_name}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-xs">
                      {(p.category || '').replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {p.pack_size || '—'} {p.uom || ''}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {p.energy_kcal != null ? `${p.energy_kcal} kcal` : ''}
                      {p.protein_g != null ? ` · ${p.protein_g}g P` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-[10px] font-bold uppercase">
                      {p.active === false ? 'Inactive' : 'Active'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="rounded-lg border border-slate-200 p-1.5 hover:bg-white"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {p.active === false ? (
                          <button
                            type="button"
                            onClick={() => void reactivate(p)}
                            className="rounded-lg border border-emerald-200 px-2 py-1 text-[10px] font-bold text-emerald-800"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void deactivate(p)}
                            className="rounded-lg border border-rose-200 p-1.5 hover:bg-rose-50"
                            title="Deactivate"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <style jsx global>{`
        .field-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: white;
        }
      `}</style>
    </SchoolsPage>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
