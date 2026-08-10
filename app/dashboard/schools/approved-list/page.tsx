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
  ImageIcon,
  Download,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';
import { SA_PROVINCES } from '@/lib/schools/types';
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
  image_url?: string | null;
  /** SA province where the food supplier / producer is based */
  province?: string | null;
  /** Show under Breakfast on mandated menu */
  for_breakfast?: boolean;
  /** Show under Lunch on mandated menu */
  for_lunch?: boolean;
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
  image_url: '' as string,
  province: '' as string,
  for_breakfast: true,
  for_lunch: true,
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
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...emptyProduct });
  const [brandForm, setBrandForm] = useState({ name: '', manufacturer: '' });
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<{
    canEdit?: boolean;
    agencyName?: string | null;
    source?: string;
    message?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      if (provinceFilter) params.set('province', provinceFilter);
      if (showInactive) params.set('all', '1');
      const res = await fetch(`/api/schools/approved?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setProducts(data.products || []);
      setBrands(data.brands || []);
      setCategories(data.categories || []);
      setProvinces(data.provinces || []);
      setCatalogue(data.catalogue || null);
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, q, category, provinceFilter, showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ ...emptyProduct });
    setImageFile(null);
    setImagePreview(null);
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
      image_url: p.image_url || '',
      province: p.province || '',
      for_breakfast: p.for_breakfast !== false,
      for_lunch: p.for_lunch !== false,
    });
    setImageFile(null);
    setImagePreview(p.image_url || null);
  };

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
    setImageFile(null);
    setImagePreview(null);
  };

  const onImagePick = (file: File | null) => {
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(form.image_url || null);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setForm((f) => ({ ...f, image_url: '' }));
  };

  const saveProduct = async () => {
    if (!form.name.trim() || !form.brand_name.trim()) {
      toast.error('Name and brand required');
      return;
    }
    setSaving(true);
    try {
      let image_url: string | null = form.image_url ? form.image_url : null;
      if (imageFile) {
        if (!imageFile.type.startsWith('image/')) {
          throw new Error('Please choose an image file (JPG, PNG, WebP)');
        }
        if (imageFile.size > 8 * 1024 * 1024) {
          throw new Error('Image must be under 8MB');
        }
        const up = await uploadCompanyAssetServerFirst({
          file: imageFile,
          companyId,
          kind: 'nsnp_product',
          privyUserId: privyUserId || null,
        });
        if (!up.url) throw new Error(up.error || 'Image upload failed');
        image_url = up.url;
      }

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
        image_url,
        province: form.province.trim() || null,
        for_breakfast: form.for_breakfast,
        for_lunch: form.for_lunch,
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
  const canEdit = Boolean(catalogue?.canEdit);

  /** Quick toggle breakfast / lunch eligibility on catalogue */
  const toggleMeal = async (
    p: Product,
    field: 'for_breakfast' | 'for_lunch'
  ) => {
    if (!canEdit) return;
    const next = !(p[field] !== false);
    setProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, [field]: next } : x))
    );
    try {
      const res = await fetch('/api/schools/approved', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          id: p.id,
          kind: 'product',
          for_breakfast:
            field === 'for_breakfast' ? next : p.for_breakfast !== false,
          for_lunch: field === 'for_lunch' ? next : p.for_lunch !== false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.product) {
        setProducts((prev) =>
          prev.map((x) =>
            x.id === p.id
              ? {
                  ...x,
                  for_breakfast: data.product.for_breakfast !== false,
                  for_lunch: data.product.for_lunch !== false,
                }
              : x
          )
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      void load();
    }
  };

  const cloneNational = async () => {
    if (
      !confirm(
        'Import / re-sync the full NSNP approved foods list into your department catalogue? Existing items are kept; new ones are added. Schools and SPs under you use this list live.'
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/schools/approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'import_nsnp_seed',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      toast.success(data.message || `Imported ${data.imported}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  /** PDF / CSV catalogue export — same full list for DBE, schools, and SPs */
  const openApprovedExport = (opts: {
    format: 'pdf' | 'csv';
    download?: boolean;
  }) => {
    const params = new URLSearchParams({
      companyId: String(companyId),
      format: opts.format,
    });
    if (opts.download || opts.format === 'csv') params.set('download', '1');
    if (showInactive) params.set('all', '1');
    window.open(
      `/api/schools/approved/export?${params.toString()}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="NSNP approved foods"
        titleAccent={
          canEdit
            ? 'DBE publishes'
            : catalogue?.agencyName || 'Comply'
        }
        description={
          canEdit
            ? 'Department-owned NSNP catalogue with product photos. Tag each food Breakfast and/or Lunch so it appears on the mandated menu under that meal. Schools and SPs inherit this list live. Download the list as PDF or CSV for kitchen boards and SP packs.'
            : catalogue?.message ||
              'Only foods on your department’s approved list may be ordered or received. Download PDF or CSV to print for the kitchen or share with your SP.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openApprovedExport({ format: 'pdf', download: true })}
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              title="Download NSNP approved foods catalogue PDF"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
            <button
              type="button"
              onClick={() => openApprovedExport({ format: 'pdf' })}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              title="Open PDF to print"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              type="button"
              onClick={() => openApprovedExport({ format: 'csv', download: true })}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              title="Download CSV for Excel / sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
            </button>
            {canEdit ? (
              <>
                <button
                  type="button"
                  onClick={() => void cloneNational()}
                  disabled={saving}
                  className="btn-secondary !py-2 !px-3 text-xs"
                >
                  Import NSNP list
                </button>
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
              </>
            ) : null}
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
          <strong>
            {canEdit
              ? 'You own this list as government agency.'
              : catalogue?.agencyName
                ? `Set by ${catalogue.agencyName}.`
                : 'Strict compliance.'}
          </strong>{' '}
          {canEdit
            ? 'Schools and SPs are blocked from ordering or receiving anything not on this list. Quarterly prizes reward headmasters for 100% approved-brand spend.'
            : 'POs and GRNs reject non-approved brands. Buy what is listed to climb the quarterly prize leaderboard (Schools → Prizes).'}
          {!canEdit ? (
            <>
              {' '}
              <a
                href="/dashboard/schools/agency"
                className="font-bold underline"
              >
                Join DBE →
              </a>
            </>
          ) : null}
        </div>
      </div>

      {canEdit && showBrandForm ? (
        <div className="mb-4 rounded-2xl border border-sky-200 bg-white dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/40 p-4 flex flex-wrap gap-2 items-end">
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

      {canEdit && formOpen ? (
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
            <Field label="Supplier province (SA)">
              <select
                className="field-input"
                value={form.province}
                onChange={(e) =>
                  setForm((f) => ({ ...f, province: e.target.value }))
                }
              >
                <option value="">— select province —</option>
                {SA_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                Where the food supplier / producer is based in South Africa.
                Visible to schools and SPs.
              </p>
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
            <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-amber-100 bg-amber-50/50 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900/70 mb-2">
                Menu meals — show on mandated breakfast / lunch
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-amber-950">
                  <input
                    type="checkbox"
                    checked={form.for_breakfast}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        for_breakfast: e.target.checked,
                      }))
                    }
                  />
                  Breakfast
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-sky-950">
                  <input
                    type="checkbox"
                    checked={form.for_lunch}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        for_lunch: e.target.checked,
                      }))
                    }
                  />
                  Lunch
                </label>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-600">
                Only tagged, active products appear under that meal on the
                department menu.
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Product image (visible to schools &amp; SPs)
              </span>
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-24 h-24 rounded-2xl border border-sky-200 bg-white dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/40 overflow-hidden flex items-center justify-center shrink-0">
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview}
                      alt="Product"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div className="space-y-2 min-w-0">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="block text-xs w-full max-w-xs"
                    onChange={(e) =>
                      onImagePick(e.target.files?.[0] || null)
                    }
                  />
                  <p className="text-[11px] text-slate-500 max-w-md">
                    JPG, PNG or WebP under 8MB. Schools and service providers
                    see this photo on the approved catalogue and when ordering.
                  </p>
                  {(imagePreview || form.image_url) && (
                    <button
                      type="button"
                      onClick={clearImage}
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>
            </div>
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
        <select
          value={provinceFilter}
          onChange={(e) => setProvinceFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All supplier provinces</option>
          {(provinces.length
            ? provinces
            : [...SA_PROVINCES]
          ).map((p) => (
            <option key={p} value={p}>
              {p}
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
        <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3 w-16">Photo</th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3">Brand</th>
                <th className="px-3 py-3">Supplier province</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Pack</th>
                <th className="px-3 py-3">Menu meals</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
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
                    <td className="px-4 py-2">
                      <div className="w-12 h-12 rounded-xl border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{p.name}</td>
                    <td className="px-3 py-2.5 font-bold text-emerald-800">
                      {p.brand_name}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">
                      {p.province || (
                        <span className="font-normal text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-xs">
                      {(p.category || '').replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {p.pack_size || '—'} {p.uom || ''}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {canEdit ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void toggleMeal(p, 'for_breakfast')}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                p.for_breakfast !== false
                                  ? 'bg-amber-100 border-amber-300 text-amber-950'
                                  : 'bg-white border-slate-200 text-slate-400'
                              }`}
                              title="Show under Breakfast on menu"
                            >
                              Breakfast
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleMeal(p, 'for_lunch')}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                p.for_lunch !== false
                                  ? 'bg-sky-100 border-sky-300 text-sky-950'
                                  : 'bg-white border-slate-200 text-slate-400'
                              }`}
                              title="Show under Lunch on menu"
                            >
                              Lunch
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-600">
                            {[
                              p.for_breakfast !== false ? 'Breakfast' : null,
                              p.for_lunch !== false ? 'Lunch' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] font-bold uppercase">
                      {p.active === false ? 'Inactive' : 'Active'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canEdit && !(p as Product & { _national_template?: boolean })._national_template ? (
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
                      ) : (p as Product & { _national_template?: boolean })
                          ._national_template ? (
                        <span className="text-[10px] text-slate-400">
                          Template
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700">
                          Mandatory
                        </span>
                      )}
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
