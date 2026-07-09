'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Link2,
  Copy,
  Package,
  Upload,
  FileText,
  ImageIcon,
  ExternalLink,
  FolderPlus,
  Tags,
  Pencil,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  COMMON_CURRENCIES,
  formatMoney,
  normalizeProductPrices,
  onchainStatusClass,
  type ProductRecord,
} from '@/lib/inventory/types';
import {
  uploadProductImage,
  uploadProductSpecSheet,
} from '@/lib/inventory/uploadProductAssets';
import { InventoryProcessNav } from '@/components/inventory/InventoryShell';

type CategoryRow = {
  id: number;
  name: string;
  profile_id?: number | null;
  is_global?: boolean;
  description?: string | null;
};

type PriceFormRow = { currency: string; cost_price: string; sell_price: string };

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  gtin: '',
  category: 'General',
  product_type: 'finished_good',
  uom: 'unit',
  reorder_level: '0',
  short_description: '',
  status: 'active',
};

const defaultPrices = (): PriceFormRow[] => [
  { currency: 'ZAR', cost_price: '', sell_price: '' },
];

const PRODUCT_TYPE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'raw_material', label: 'Raw materials' },
  { value: 'finished_good', label: 'Finished goods' },
  { value: 'consumable', label: 'Consumables' },
  { value: 'kit', label: 'Kits' },
] as const;

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <ProductsInner />
    </Suspense>
  );
}

function ProductsInner() {
  const companyId = getSelectedCompanyId();
  const searchParams = useSearchParams();
  const router = useRouter();
  const typeFromUrl = searchParams.get('type') || 'all';
  const [typeFilter, setTypeFilter] = useState(typeFromUrl);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [existingSpecUrl, setExistingSpecUrl] = useState<string | null>(null);
  const [existingSpecName, setExistingSpecName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [priceRows, setPriceRows] = useState<PriceFormRow[]>(defaultPrices());
  const [qrProduct, setQrProduct] = useState<ProductRecord | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!companyId) return;
    const res = await fetch(`/api/inventory/categories?companyId=${companyId}`);
    const data = await res.json();
    setCategories(data.categories || []);
    if (data.warning) {
      /* table may not exist yet — fallback list still works */
    }
  }, [companyId]);

  useEffect(() => {
    setTypeFilter(typeFromUrl);
  }, [typeFromUrl]);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ companyId: String(companyId) });
    if (q) params.set('q', q);
    if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter);
    const res = await fetch(`/api/inventory/products?${params}`);
    const data = await res.json();
    setProducts(data.products || []);
    if (data.warning) toast.message(data.warning, { description: data.hint });
    setLoading(false);
  }, [companyId, q, typeFilter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const setType = (value: string) => {
    setTypeFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('type');
    else params.set('type', value);
    const qs = params.toString();
    router.replace(qs ? `/dashboard/inventory/products?${qs}` : '/dashboard/inventory/products');
  };

  const addCategory = async () => {
    if (!companyId) return;
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Enter a category name');
      return;
    }
    setSavingCategory(true);
    try {
      const res = await fetch('/api/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed to save category');
      const catName = data.category?.name || name;
      toast.success(
        data.alreadyExists ? `Using existing category “${catName}”` : `Category “${catName}” saved`
      );
      await loadCategories();
      setForm((f) => ({ ...f, category: catName }));
      setNewCategoryName('');
      setShowNewCategory(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingCategory(false);
    }
  };

  const onImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be under 8MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const onSpecPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Spec sheet must be under 15MB');
      return;
    }
    setSpecFile(file);
  };

  const resetCreateForm = () => {
    setForm(emptyForm);
    setPriceRows(defaultPrices());
    setEditingId(null);
    setExistingImageUrl(null);
    setExistingSpecUrl(null);
    setExistingSpecName(null);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setSpecFile(null);
    setShowNewCategory(false);
    setNewCategoryName('');
  };

  const openCreate = (preferType?: string) => {
    resetCreateForm();
    setForm({
      ...emptyForm,
      product_type:
        preferType && preferType !== 'all' ? preferType : emptyForm.product_type,
    });
    setShowModal(true);
  };

  const openEdit = (p: ProductRecord) => {
    const normalized = normalizeProductPrices(
      Array.isArray(p.prices) && p.prices.length
        ? p.prices
        : [
            {
              currency: p.base_currency || 'ZAR',
              cost_price: p.cost_price ?? 0,
              sell_price: p.sell_price ?? 0,
            },
          ]
    );
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      gtin: (p as { gtin?: string }).gtin || p.barcode || '',
      category: p.category || 'General',
      product_type: p.product_type || 'finished_good',
      uom: p.uom || 'unit',
      reorder_level: String(p.reorder_level ?? 0),
      short_description: p.short_description || '',
      status: p.status || 'active',
    });
    setPriceRows(
      normalized.map((r) => ({
        currency: r.currency,
        cost_price: r.cost_price ? String(r.cost_price) : '',
        sell_price: r.sell_price ? String(r.sell_price) : '',
      }))
    );
    setExistingImageUrl(p.primary_image_url || null);
    setExistingSpecUrl(p.specs_sheet_url || null);
    setExistingSpecName(p.specs_sheet_name || null);
    setImageFile(null);
    setImagePreview(p.primary_image_url || null);
    setSpecFile(null);
    setShowModal(true);
  };

  const save = async () => {
    if (!companyId || !form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      let primary_image_url: string | null | undefined = editingId
        ? existingImageUrl
        : null;
      let specs_sheet_url: string | null | undefined = editingId
        ? existingSpecUrl
        : null;
      let specs_sheet_name: string | null | undefined = editingId
        ? existingSpecName
        : null;

      if (imageFile || specFile) {
        setUploadingAssets(true);
        if (imageFile) {
          const up = await uploadProductImage(imageFile, companyId, form.sku || form.name);
          if (!up.url) throw new Error(up.error || 'Image upload failed');
          primary_image_url = up.url;
        }
        if (specFile) {
          const up = await uploadProductSpecSheet(specFile, companyId, form.sku || form.name);
          if (!up.url) throw new Error(up.error || 'Spec sheet upload failed');
          specs_sheet_url = up.url;
          specs_sheet_name = up.fileName || specFile.name;
        }
        setUploadingAssets(false);
      }

      const prices = normalizeProductPrices(
        priceRows.map((r) => ({
          currency: r.currency,
          cost_price: r.cost_price,
          sell_price: r.sell_price,
        }))
      );

      const payload = {
        companyId,
        name: form.name,
        sku: form.sku || undefined,
        barcode: form.barcode || form.gtin || undefined,
        gtin: form.gtin || undefined,
        category: form.category?.trim() || 'General',
        product_type: form.product_type,
        uom: form.uom,
        base_currency: prices[0].currency,
        sell_price: prices[0].sell_price,
        cost_price: prices[0].cost_price,
        prices,
        reorder_level: Number(form.reorder_level) || 0,
        short_description: form.short_description || undefined,
        status: form.status,
        primary_image_url: primary_image_url || null,
        specs_sheet_url: specs_sheet_url || null,
        specs_sheet_name: specs_sheet_name || null,
      };

      const res = await fetch('/api/inventory/products', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      const wasEdit = !!editingId;
      toast.success(wasEdit ? 'Product updated' : 'Product created with QR + on-chain hash');
      setShowModal(false);
      resetCreateForm();
      if (!wasEdit && data.product) setQrProduct(data.product);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
      setUploadingAssets(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    const res = await fetch(`/api/inventory/products?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Deleted');
      void load();
    }
  };

  const anchor = async (p: ProductRecord) => {
    toast.loading('Anchoring on-chain…', { id: `anchor-${p.id}` });
    const res = await fetch('/api/inventory/products/anchor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: p.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Failed', { id: `anchor-${p.id}` });
      return;
    }
    const mode = data.chain?.mode === 'onchain' ? 'minted on-chain' : 'anchored (sim)';
    toast.success(`${mode} · ${String(data.chain?.txHash || '').slice(0, 14)}…`, {
      id: `anchor-${p.id}`,
      description: data.chain?.note,
    });
    void load();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  if (!companyId) {
    return (
      <div className="text-center py-16">
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">
          Select company
        </Link>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <InventoryProcessNav />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
            Step 1 · Master data
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">
            Products
          </h1>
          <p className="text-neutral-600 mt-1">
            Raw materials, finished goods, and more — one catalogue with QR passports. (Former
            separate raw/FG pages redirect here.)
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate(typeFilter)}
          className="btn-primary !py-3 !px-5"
        >
          <Plus className="w-4 h-4" /> Add product
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {PRODUCT_TYPE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              typeFilter === t.value
                ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                : 'border-neutral-200 text-neutral-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          className="input w-full !pl-10 !py-2.5 !text-sm"
          placeholder="Search name, SKU, barcode…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center">
            <Package className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-600 mb-4">No products yet.</p>
            <button
              type="button"
              onClick={() => openCreate(typeFilter)}
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              Create first product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b text-left">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold text-right">Price</th>
                  <th className="px-4 py-3 font-semibold text-right">On hand</th>
                  <th className="px-4 py-3 font-semibold">On-chain</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => {
                  const prices = normalizeProductPrices(
                    Array.isArray(p.prices) && p.prices.length
                      ? p.prices
                      : [
                          {
                            currency: p.base_currency || 'ZAR',
                            cost_price: p.cost_price ?? 0,
                            sell_price: p.sell_price ?? 0,
                          },
                        ]
                  );
                  return (
                  <tr
                    key={p.id}
                    className="hover:bg-neutral-50 cursor-pointer"
                    onClick={() => openEdit(p)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-neutral-100 border overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {p.primary_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.primary_image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-neutral-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                          {p.short_description && (
                            <div className="text-xs text-neutral-500 line-clamp-1">
                              {p.short_description}
                            </div>
                          )}
                          {p.specs_sheet_url && (
                            <a
                              href={p.specs_sheet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-[#00b4d8] inline-flex items-center gap-1 mt-0.5 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <FileText className="w-3 h-3" />
                              Specs
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">{p.sku || '—'}</td>
                    <td className="px-4 py-4 capitalize text-neutral-600">
                      {(p.product_type || 'finished_good').replace('_', ' ')}
                    </td>
                    <td className="px-4 py-4 text-right text-xs">
                      <div className="font-semibold text-slate-900">
                        {formatMoney(prices[0].sell_price, prices[0].currency)}
                      </div>
                      <div className="text-neutral-500">
                        cost {formatMoney(prices[0].cost_price, prices[0].currency)}
                      </div>
                      {prices.length > 1 && (
                        <div className="text-neutral-400 mt-0.5">
                          +{prices.length - 1} currency{prices.length > 2 ? 's' : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold">
                      {Number(p.qty_on_hand ?? 0)} {p.uom || ''}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${onchainStatusClass(p.onchain_status)}`}
                      >
                        {p.onchain_status || 'pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Edit product"
                          onClick={() => openEdit(p)}
                          className="p-2 rounded-xl hover:bg-neutral-100 text-slate-700"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="QR code"
                          onClick={() => setQrProduct(p)}
                          className="p-2 rounded-xl hover:bg-[#00b4d8]/10 text-[#00b4d8]"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Mark anchored"
                          onClick={() => void anchor(p)}
                          className="p-2 rounded-xl hover:bg-emerald-50 text-emerald-700"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(p.id)}
                          className="p-2 rounded-xl hover:bg-red-50 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl border shadow-xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h2 className="font-bold text-lg">
                  {editingId ? 'Edit product' : 'New product'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetCreateForm();
                  }}
                  className="p-2 rounded-xl hover:bg-neutral-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3 overflow-y-auto">
                {/* Image + specs uploads */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#00b4d8]" /> Product image
                    </label>
                    {!imagePreview ? (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-2xl p-5 cursor-pointer hover:border-[#00b4d8]/50 transition-colors min-h-[120px]">
                        <Upload className="w-6 h-6 text-neutral-400 mb-1" />
                        <span className="text-xs text-neutral-600 text-center">JPG / PNG · max 8MB</span>
                        <input type="file" accept="image/*" className="hidden" onChange={onImagePick} />
                      </label>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden border h-[120px] bg-neutral-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            if (imagePreview && imagePreview.startsWith('blob:')) {
                              URL.revokeObjectURL(imagePreview);
                            }
                            setImagePreview(null);
                            setExistingImageUrl(null);
                          }}
                          className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#00b4d8]" /> Specifications sheet
                    </label>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-2xl p-5 cursor-pointer hover:border-[#00b4d8]/50 transition-colors min-h-[120px]">
                      <FileText className="w-6 h-6 text-neutral-400 mb-1" />
                      <span className="text-xs text-neutral-600 text-center px-2">
                        {specFile
                          ? specFile.name
                          : existingSpecName || existingSpecUrl
                            ? existingSpecName || 'Current specs sheet'
                            : 'PDF / Word · max 15MB'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,image/*"
                        className="hidden"
                        onChange={onSpecPick}
                      />
                    </label>
                    {(specFile || existingSpecUrl) && (
                      <div className="flex items-center gap-3 mt-1">
                        {existingSpecUrl && !specFile && (
                          <a
                            href={existingSpecUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#00b4d8] hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> View current
                          </a>
                        )}
                        <button
                          type="button"
                          className="text-[11px] text-red-600 hover:underline"
                          onClick={() => {
                            setSpecFile(null);
                            setExistingSpecUrl(null);
                            setExistingSpecName(null);
                          }}
                        >
                          Remove spec sheet
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium">Name *</label>
                  <input
                    className="input mt-1 w-full !p-3 !text-sm"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">SKU</label>
                    <input
                      className="input mt-1 w-full !p-3 !text-sm font-mono"
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">GTIN / EAN / UPC (GS1)</label>
                    <input
                      className="input mt-1 w-full !p-3 !text-sm font-mono"
                      value={form.gtin}
                      onChange={(e) => setForm({ ...form, gtin: e.target.value, barcode: e.target.value })}
                      placeholder="8–14 digits"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Type</label>
                    <select
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.product_type}
                      onChange={(e) => setForm({ ...form, product_type: e.target.value })}
                    >
                      <option value="finished_good">Finished good</option>
                      <option value="raw_material">Raw material</option>
                      <option value="consumable">Consumable</option>
                      <option value="kit">Kit / bundle</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">UOM</label>
                    <input
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.uom}
                      onChange={(e) => setForm({ ...form, uom: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium flex items-center gap-1.5">
                    <Tags className="w-3.5 h-3.5 text-[#00b4d8]" /> Category
                  </label>
                  <div className="flex gap-2 mt-1">
                    <select
                      className="input flex-1 !p-3 !text-sm"
                      value={form.category}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setShowNewCategory(true);
                          return;
                        }
                        setForm({ ...form, category: e.target.value });
                      }}
                    >
                      {/* Ensure current value always appears */}
                      {form.category &&
                        !categories.some(
                          (c) => c.name.toLowerCase() === form.category.toLowerCase()
                        ) && <option value={form.category}>{form.category}</option>}
                      {categories.map((c) => (
                        <option key={`${c.id}-${c.name}`} value={c.name}>
                          {c.name}
                          {c.is_global ? '' : ' (yours)'}
                        </option>
                      ))}
                      <option value="__new__">+ Add new category…</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCategory((v) => !v)}
                      className="btn-secondary !px-3 !py-2 text-sm"
                      title="Add category"
                    >
                      <FolderPlus className="w-4 h-4" />
                    </button>
                  </div>
                  {showNewCategory && (
                    <div className="mt-2 p-3 rounded-2xl border border-[#00b4d8]/25 bg-[#00b4d8]/5 space-y-2">
                      <p className="text-[11px] text-neutral-600">
                        New categories are saved for your company in Supabase and appear in the list.
                      </p>
                      <input
                        className="input w-full !p-2.5 !text-sm"
                        placeholder="e.g. Ambient snacks"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void addCategory();
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewCategory(false);
                            setNewCategoryName('');
                          }}
                          className="btn-secondary flex-1 !py-2 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingCategory}
                          onClick={() => void addCategory()}
                          className="btn-primary flex-1 !py-2 text-sm"
                        >
                          {savingCategory ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          ) : (
                            'Save category'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium">Pricing (up to 3 currencies)</label>
                    {priceRows.length < 3 && (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-[#00b4d8] inline-flex items-center gap-1"
                        onClick={() =>
                          setPriceRows((rows) => [
                            ...rows,
                            {
                              currency: rows.some((r) => r.currency === 'USD') ? 'EUR' : 'USD',
                              cost_price: '',
                              sell_price: '',
                            },
                          ])
                        }
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Add currency
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {priceRows.map((row, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-end p-2.5 rounded-2xl border border-neutral-100 bg-neutral-50/80"
                      >
                        <div className="col-span-4">
                          <label className="text-[10px] font-medium text-neutral-500">
                            Currency {idx === 0 ? '(primary)' : idx + 1}
                          </label>
                          <select
                            className="input mt-0.5 w-full !p-2 !text-sm"
                            value={row.currency}
                            onChange={(e) => {
                              const next = [...priceRows];
                              next[idx] = { ...next[idx], currency: e.target.value };
                              setPriceRows(next);
                            }}
                          >
                            {COMMON_CURRENCIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] font-medium text-neutral-500">Cost</label>
                          <input
                            type="number"
                            step="0.01"
                            className="input mt-0.5 w-full !p-2 !text-sm"
                            value={row.cost_price}
                            onChange={(e) => {
                              const next = [...priceRows];
                              next[idx] = { ...next[idx], cost_price: e.target.value };
                              setPriceRows(next);
                            }}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] font-medium text-neutral-500">Sell</label>
                          <input
                            type="number"
                            step="0.01"
                            className="input mt-0.5 w-full !p-2 !text-sm"
                            value={row.sell_price}
                            onChange={(e) => {
                              const next = [...priceRows];
                              next[idx] = { ...next[idx], sell_price: e.target.value };
                              setPriceRows(next);
                            }}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-2 flex justify-end pb-0.5">
                          {priceRows.length > 1 ? (
                            <button
                              type="button"
                              className="p-2 rounded-xl text-red-600 hover:bg-red-50"
                              title="Remove currency"
                              onClick={() =>
                                setPriceRows((rows) => rows.filter((_, i) => i !== idx))
                              }
                            >
                              <MinusCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-neutral-400 pr-1">base</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1.5">
                    Primary currency is used as the main catalogue price; extra currencies store local cost/sell.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium">Reorder level</label>
                  <input
                    type="number"
                    className="input mt-1 w-full !p-3 !text-sm"
                    value={form.reorder_level}
                    onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Description</label>
                  <textarea
                    className="input mt-1 w-full !p-3 !text-sm min-h-[70px]"
                    value={form.short_description}
                    onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                  />
                </div>
                {editingId && (
                  <div>
                    <label className="text-xs font-medium">Status</label>
                    <select
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                )}
                <p className="text-[11px] text-neutral-500 flex items-start gap-1.5">
                  <Link2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  {editingId
                    ? 'Changes update catalogue pricing, images, and specs. QR / public ID stay the same.'
                    : 'Saving generates a public QR ID and SHA-256 on-chain identity hash automatically.'}
                </p>
              </div>
              <div className="flex gap-3 p-5 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetCreateForm();
                  }}
                  className="btn-secondary flex-1 !py-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || uploadingAssets}
                  onClick={() => void save()}
                  className="btn-primary flex-1 !py-3"
                >
                  {saving || uploadingAssets ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {uploadingAssets ? 'Uploading…' : 'Saving…'}
                    </span>
                  ) : editingId ? (
                    'Save changes'
                  ) : (
                    'Create product'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR modal */}
      {qrProduct && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setQrProduct(null)}>
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full text-center border shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-1">{qrProduct.name}</h3>
            <p className="text-xs text-neutral-500 font-mono mb-4">{qrProduct.sku || qrProduct.public_id}</p>
            {qrProduct.qr_payload || qrProduct.public_id ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  qrProduct.qr_payload ||
                    `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${qrProduct.public_id}`
                )}`}
                alt="Product QR"
                className="mx-auto rounded-2xl border"
                width={220}
                height={220}
              />
            ) : null}
            <p className="text-[11px] text-neutral-500 mt-3 break-all">
              {qrProduct.qr_payload || `/p/${qrProduct.public_id}`}
            </p>
            {qrProduct.onchain_hash && (
              <div className="mt-3 text-left text-[10px] font-mono bg-emerald-50 text-emerald-900 rounded-xl p-3 break-all">
                hash: {qrProduct.onchain_hash}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                className="btn-secondary flex-1 !py-2 text-sm"
                onClick={() =>
                  void copy(
                    qrProduct.qr_payload ||
                      `${window.location.origin}/p/${qrProduct.public_id}`
                  )
                }
              >
                <Copy className="w-3.5 h-3.5" /> Copy link
              </button>
              <button type="button" className="btn-primary flex-1 !py-2 text-sm" onClick={() => setQrProduct(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
