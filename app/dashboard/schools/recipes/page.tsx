'use client';

/**
 * DBE Recipes (BOM) + MPS/MRP planning for schools & SPs.
 * Recipe qty/learner × NSNP learners × feeding days → product requirements.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calculator,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Utensils,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type Product = {
  id: number;
  name: string;
  brand_name: string;
  category?: string | null;
  uom?: string | null;
};

type BomLine = {
  approved_product_id: number;
  product_name: string;
  brand_name: string;
  category: string;
  qty_per_portion: string;
  uom: string;
  wastage_pct: string;
};

type Recipe = {
  id: number;
  name: string;
  meal_type: string;
  portion_learners: number;
  active?: boolean;
  description?: string | null;
  lines: Array<{
    approved_product_id: number | null;
    product_name: string;
    brand_name?: string | null;
    category?: string | null;
    qty_per_portion: number;
    uom: string;
    wastage_pct?: number;
  }>;
};

type Budget = {
  id?: number;
  category: string;
  period_from: string;
  period_to: string;
  budget_amount_zar: number;
  unit_price_zar?: number | null;
  uom?: string | null;
};

type Plan = {
  feeding_days: number;
  total_learners: number;
  total_meals: number;
  school_count: number;
  estimated_cost_zar: number;
  budget_total_zar: number;
  budget_variance_zar: number;
  mps: Array<{
    meal_type: string;
    recipe_name: string;
    meals: number;
    portions: number;
  }>;
  mrp: Array<{
    product_name: string;
    brand_name: string | null;
    category: string;
    uom: string;
    qty: number;
    estimated_cost_zar: number | null;
  }>;
  mrp_by_category: Array<{
    category: string;
    qty: number;
    estimated_cost_zar: number;
    budget_amount_zar?: number;
    variance_zar?: number;
  }>;
  schools: Array<{
    school_profile_id: number;
    school_name: string;
    learners: number;
    total_meals: number;
    estimated_cost_zar: number;
    district?: string | null;
    mrp: Array<{ product_name: string; qty: number; uom: string }>;
  }>;
  service_providers: Array<{
    isp_profile_id: number;
    isp_name: string;
    school_count: number;
    learners: number;
    total_meals: number;
    estimated_cost_zar: number;
    mrp: Array<{ product_name: string; qty: number; uom: string }>;
  }>;
};

export default function RecipesPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'agency' | 'school' | 'isp'>('agency');
  const [canEdit, setCanEdit] = useState(false);
  const [tab, setTab] = useState<'recipes' | 'plan' | 'budgets'>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month', 4)
  );
  const [saving, setSaving] = useState(false);

  // Recipe editor
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState('lunch');
  const [description, setDescription] = useState('');
  const [bomLines, setBomLines] = useState<BomLine[]>([]);
  const [productId, setProductId] = useState('');
  const [qtyPer, setQtyPer] = useState('0.05');
  const [wastage, setWastage] = useState('5');

  // Budget editor
  const [bCategory, setBCategory] = useState('');
  const [bAmount, setBAmount] = useState('');
  const [bPrice, setBPrice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, pRes, planRes] = await Promise.all([
        fetch(
          `/api/schools/recipes?companyId=${companyId}&view=recipes`,
          { cache: 'no-store', credentials: 'same-origin' }
        ),
        fetch(`/api/schools/approved?companyId=${companyId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
        fetch(
          `/api/schools/recipes?companyId=${companyId}&view=plan&from=${period.from}&to=${period.to}`,
          { cache: 'no-store', credentials: 'same-origin' }
        ),
      ]);
      const r = await rRes.json();
      const p = await pRes.json();
      const pl = await planRes.json();
      if (!rRes.ok && !pl.success) {
        throw new Error(r.error || pl.error || 'Failed');
      }
      setRole((r.role || pl.role || 'school') as 'agency' | 'school' | 'isp');
      setCanEdit(Boolean(r.canEdit || pl.canEdit));
      setRecipes(r.recipes || pl.recipes || []);
      setProducts(p.products || []);
      setBudgets(pl.budgets || []);
      setPlan(pl.plan || null);
      if (r.message && !(r.recipes || []).length) toast.message(r.message);
      if (pl.warning || r.warning) toast.message(pl.warning || r.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(String(p.category));
    }
    for (const b of budgets) set.add(b.category);
    return [...set].sort();
  }, [products, budgets]);

  const openNew = () => {
    setEditId(null);
    setName('');
    setMealType('lunch');
    setDescription('');
    setBomLines([]);
  };

  const openEdit = (r: Recipe) => {
    setEditId(r.id);
    setName(r.name);
    setMealType(r.meal_type || 'lunch');
    setDescription(r.description || '');
    setBomLines(
      (r.lines || []).map((l) => ({
        approved_product_id: Number(l.approved_product_id) || 0,
        product_name: l.product_name,
        brand_name: l.brand_name || '',
        category: l.category || 'other',
        qty_per_portion: String(l.qty_per_portion),
        uom: l.uom || 'kg',
        wastage_pct: String(l.wastage_pct ?? 0),
      }))
    );
    setTab('recipes');
  };

  const addBomLine = () => {
    const prod = products.find((p) => p.id === Number(productId));
    if (!prod) return toast.error('Select an approved catalogue product');
    const qty = Number(qtyPer);
    if (!(qty > 0)) return toast.error('Qty per learner portion must be > 0');
    setBomLines((prev) => {
      if (prev.some((l) => l.approved_product_id === prod.id)) {
        return prev.map((l) =>
          l.approved_product_id === prod.id
            ? {
                ...l,
                qty_per_portion: String(qty),
                wastage_pct: wastage,
              }
            : l
        );
      }
      return [
        ...prev,
        {
          approved_product_id: prod.id,
          product_name: prod.name,
          brand_name: prod.brand_name,
          category: String(prod.category || 'other'),
          qty_per_portion: String(qty),
          uom: prod.uom || 'kg',
          wastage_pct: wastage,
        },
      ];
    });
    setProductId('');
  };

  const saveRecipe = async () => {
    if (!canEdit) return;
    if (!name.trim()) return toast.error('Recipe name required');
    if (!bomLines.length) return toast.error('Add BOM lines from catalogue');
    setSaving(true);
    try {
      const res = await fetch('/api/schools/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'save_recipe',
          id: editId,
          name: name.trim(),
          meal_type: mealType,
          description: description || null,
          portion_learners: 1,
          lines: bomLines.map((l) => ({
            approved_product_id: l.approved_product_id,
            qty_per_portion: Number(l.qty_per_portion),
            uom: l.uom,
            wastage_pct: Number(l.wastage_pct || 0),
            category: l.category,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(data.message || 'Recipe saved');
      openNew();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecipe = async (id: number) => {
    if (!confirm('Delete this recipe BOM?')) return;
    try {
      const res = await fetch('/api/schools/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'delete_recipe',
          id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success('Recipe deleted');
      if (editId === id) openNew();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const saveBudget = async () => {
    if (!canEdit) return;
    if (!bCategory.trim()) return toast.error('Category required');
    setSaving(true);
    try {
      const res = await fetch('/api/schools/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'save_budget',
          category: bCategory.trim(),
          period_from: period.from,
          period_to: period.to,
          budget_amount_zar: Number(bAmount) || 0,
          unit_price_zar: bPrice === '' ? null : Number(bPrice),
          uom: 'kg',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Category budget saved');
      setBCategory('');
      setBAmount('');
      setBPrice('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const title =
    role === 'agency'
      ? 'Programme recipes'
      : role === 'isp'
        ? 'Supply plan (MPS/MRP)'
        : 'School meal plan (MPS/MRP)';

  return (
    <SchoolsPage>
      <SchoolsHeader
        title={title}
        titleAccent={role === 'agency' ? 'BOM · MPS · MRP' : 'From DBE'}
        mode={role === 'isp' ? 'isp' : role === 'agency' ? 'agency' : 'school'}
        description={
          role === 'agency'
            ? 'Build recipe BOMs from the approved catalogue (qty per learner). MPS = meals from learner counts × feeding days; MRP = product requirements per school and per SP. Set category budgets to track cost.'
            : role === 'isp'
              ? 'Estimated meals (MPS) and product quantities (MRP) for schools you supply — scaled by each school’s NSNP learner count and DBE recipes.'
              : 'Your school’s meal plan quantities from DBE recipes and your NSNP learner enrolment — use this to order from your SP.'
        }
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(canEdit
          ? (['recipes', 'plan', 'budgets'] as const)
          : (['plan'] as const)
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
              tab === t
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {t === 'recipes'
              ? 'Recipe BOM'
              : t === 'plan'
                ? 'MPS / MRP plan'
                : 'Category budgets'}
          </button>
        ))}
      </div>

      {(tab === 'plan' || !canEdit) && (
        <div className="mb-4">
          <PeriodSlicer value={period} onChange={setPeriod} />
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : tab === 'recipes' && canEdit ? (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black">
                  {editId ? `Edit recipe #${editId}` : 'New recipe BOM'}
                </p>
                {editId ? (
                  <button
                    type="button"
                    onClick={openNew}
                    className="text-[11px] font-bold text-slate-500"
                  >
                    New
                  </button>
                ) : null}
              </div>
              <label className="block text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Recipe name *
                </span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sample samp & beans lunch"
                />
              </label>
              <label className="block text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Meal type
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Description
                </span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <div className="border-t pt-3 space-y-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    BOM line — quantity per 1 learner portion
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Enter how much product one learner needs for one serving of
                    this recipe. Total per learner = Qty × (1 + Wastage % /
                    100).
                  </p>
                </div>

                <label className="block text-xs">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Approved product (catalogue)
                  </span>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">Select NSNP approved product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.brand_name} — {p.name}
                        {p.category ? ` · ${p.category}` : ''}
                        {p.uom ? ` (${p.uom})` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Qty per 1 learner
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold tabular-nums"
                      value={qtyPer}
                      onChange={(e) => setQtyPer(e.target.value)}
                      placeholder="e.g. 0.08"
                      inputMode="decimal"
                    />
                    <span className="block mt-0.5 text-[10px] text-slate-400">
                      Net amount in product UOM (kg, L, etc.)
                    </span>
                  </label>
                  <label className="block text-xs">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Wastage %
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums"
                      value={wastage}
                      onChange={(e) => setWastage(e.target.value)}
                      placeholder="e.g. 5"
                      inputMode="decimal"
                    />
                    <span className="block mt-0.5 text-[10px] text-slate-400">
                      Extra allowance (0 = no waste)
                    </span>
                  </label>
                </div>

                {(() => {
                  const q = Number(qtyPer);
                  const w = Number(wastage) || 0;
                  const prod = products.find(
                    (p) => p.id === Number(productId)
                  );
                  if (!(q > 0)) return null;
                  const total = Math.round(q * (1 + w / 100) * 1e6) / 1e6;
                  return (
                    <p className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                      Total per 1 learner (incl. wastage):{' '}
                      <span className="font-black tabular-nums">
                        {total} {prod?.uom || 'uom'}
                      </span>
                    </p>
                  );
                })()}

                <button
                  type="button"
                  onClick={addBomLine}
                  className="btn-secondary !py-2 !px-3 text-xs w-full"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  Add catalogue product to BOM
                </button>
              </div>

              {bomLines.length > 0 ? (
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <div className="grid grid-cols-12 gap-1 bg-slate-50 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <span className="col-span-5">Product</span>
                    <span className="col-span-2 text-right">Qty / learner</span>
                    <span className="col-span-2 text-right">Wastage %</span>
                    <span className="col-span-2 text-right">Total / learner</span>
                    <span className="col-span-1" />
                  </div>
                  <ul className="text-xs max-h-48 overflow-y-auto divide-y divide-slate-50">
                    {bomLines.map((l, i) => {
                      const q = Number(l.qty_per_portion) || 0;
                      const w = Number(l.wastage_pct) || 0;
                      const total =
                        Math.round(q * (1 + w / 100) * 1e6) / 1e6;
                      return (
                        <li
                          key={l.approved_product_id}
                          className="grid grid-cols-12 gap-1 px-2 py-1.5 items-center"
                        >
                          <span className="col-span-5 min-w-0 truncate">
                            <strong>{l.brand_name}</strong> {l.product_name}
                            <span className="block text-[10px] text-slate-400">
                              {l.category} · {l.uom}
                            </span>
                          </span>
                          <span className="col-span-2 text-right font-bold tabular-nums">
                            {l.qty_per_portion}
                          </span>
                          <span className="col-span-2 text-right tabular-nums">
                            {l.wastage_pct || '0'}
                          </span>
                          <span className="col-span-2 text-right font-black tabular-nums text-emerald-800">
                            {total}
                          </span>
                          <button
                            type="button"
                            className="col-span-1 text-rose-600 font-bold text-right"
                            title="Remove line"
                            onClick={() =>
                              setBomLines((prev) =>
                                prev.filter((_, j) => j !== i)
                              )
                            }
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveRecipe()}
                className="btn-primary !py-2.5 !px-4 text-sm w-full inline-flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save recipe BOM
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-black flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#0077b6]" />
              Saved recipes ({recipes.length})
            </div>
            {recipes.length === 0 ? (
              <p className="px-4 py-12 text-center text-slate-500 text-sm">
                No recipes yet. Create a BOM using approved catalogue products.
              </p>
            ) : (
              <ul className="divide-y">
                {recipes.map((r) => (
                  <li
                    key={r.id}
                    className="px-4 py-3 flex flex-wrap items-start justify-between gap-2"
                  >
                    <div>
                      <p className="font-bold text-sm">
                        {r.name}{' '}
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          {r.meal_type}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {(r.lines || [])
                          .map(
                            (l) =>
                              `${l.product_name} ${l.qty_per_portion}${l.uom}`
                          )
                          .join(' · ') || 'No lines'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-[11px] font-bold text-[#0077b6] px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRecipe(r.id)}
                        className="text-[11px] font-bold text-rose-600 px-2 py-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : tab === 'budgets' && canEdit ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 grid sm:grid-cols-4 gap-2 items-end">
            <label className="text-xs sm:col-span-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Category
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                list="cat-list"
                value={bCategory}
                onChange={(e) => setBCategory(e.target.value)}
                placeholder="e.g. maize_meal"
              />
              <datalist id="cat-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Budget (R)
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={bAmount}
                onChange={(e) => setBAmount(e.target.value)}
              />
            </label>
            <label className="text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Est. unit price (R)
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={bPrice}
                onChange={(e) => setBPrice(e.target.value)}
                placeholder="For MRP cost"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveBudget()}
              className="btn-primary !py-2 !px-3 text-xs"
            >
              Save budget
            </button>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                  <th className="px-4 py-2">Category</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Budget</th>
                  <th className="px-3 py-2">Unit price</th>
                </tr>
              </thead>
              <tbody>
                {budgets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No category budgets for this period.
                    </td>
                  </tr>
                ) : (
                  budgets.map((b) => (
                    <tr key={b.id} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-semibold">{b.category}</td>
                      <td className="px-3 py-2 text-xs">
                        {b.period_from} → {b.period_to}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatMoney(b.budget_amount_zar)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs">
                        {b.unit_price_zar != null
                          ? `${formatMoney(b.unit_price_zar)}/${b.uom || 'kg'}`
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* PLAN VIEW */
        <div className="space-y-4">
          {!plan || !recipes.length ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
              {canEdit
                ? 'Create at least one recipe BOM, then open MPS/MRP plan.'
                : 'DBE has not published recipe BOMs yet.'}
              {canEdit ? (
                <button
                  type="button"
                  className="btn-primary !py-2 !px-3 text-xs mt-4"
                  onClick={() => setTab('recipes')}
                >
                  Create recipe
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                <Stat
                  label="Feeding days"
                  value={String(plan.feeding_days)}
                  icon={Calculator}
                />
                <Stat
                  label="Learners"
                  value={String(plan.total_learners)}
                />
                <Stat
                  label="Total meals (MPS)"
                  value={plan.total_meals.toLocaleString()}
                />
                <Stat
                  label="Est. cost"
                  value={formatMoney(plan.estimated_cost_zar)}
                />
                <Stat
                  label="Budget variance"
                  value={formatMoney(plan.budget_variance_zar)}
                  tone={
                    plan.budget_variance_zar < 0
                      ? 'bad'
                      : plan.budget_total_zar > 0
                        ? 'good'
                        : undefined
                  }
                />
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-sky-950">
                <strong>How it works:</strong> Recipe BOM qty per learner ×
                school NSNP learners × feeding days in period = product MRP.
                SPs see the sum of schools they supply. Category budgets use
                unit prices for cost estimates.
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black mb-2">MPS · meals by recipe</p>
                  <ul className="text-sm space-y-1">
                    {(plan.mps || []).map((m, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-2 border-b border-slate-50 py-1.5"
                      >
                        <span>
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {m.meal_type}
                          </span>{' '}
                          {m.recipe_name}
                        </span>
                        <span className="font-black tabular-nums">
                          {m.meals.toLocaleString()} meals
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black mb-2 flex items-center gap-1">
                    <Wallet className="w-4 h-4" /> Category MRP vs budget
                  </p>
                  <ul className="text-sm space-y-1">
                    {(plan.mrp_by_category || []).map((c) => (
                      <li
                        key={c.category}
                        className="flex justify-between gap-2 border-b border-slate-50 py-1.5"
                      >
                        <span className="font-semibold">{c.category}</span>
                        <span className="text-right text-xs">
                          <span className="font-black tabular-nums block">
                            {c.qty} · {formatMoney(c.estimated_cost_zar)}
                          </span>
                          {c.budget_amount_zar != null ? (
                            <span
                              className={
                                (c.variance_zar || 0) < 0
                                  ? 'text-rose-600'
                                  : 'text-emerald-700'
                              }
                            >
                              budget {formatMoney(c.budget_amount_zar)} · var{' '}
                              {formatMoney(c.variance_zar || 0)}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b text-sm font-black">
                  MRP · product requirements (programme / your scope)
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                        <th className="px-3 py-2">Product</th>
                        <th className="px-2 py-2">Category</th>
                        <th className="px-2 py-2">Qty</th>
                        <th className="px-2 py-2">Est. cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(plan.mrp || []).map((l, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="px-3 py-1.5">
                            <span className="font-semibold">
                              {l.brand_name ? `${l.brand_name} · ` : ''}
                              {l.product_name}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-xs">{l.category}</td>
                          <td className="px-2 py-1.5 font-black tabular-nums">
                            {l.qty} {l.uom}
                          </td>
                          <td className="px-2 py-1.5 text-xs tabular-nums">
                            {l.estimated_cost_zar != null
                              ? formatMoney(l.estimated_cost_zar)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {role !== 'isp' && (plan.schools || []).length > 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b text-sm font-black">
                    MPS / MRP by school (learner-scaled)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                          <th className="px-4 py-2">School</th>
                          <th className="px-2 py-2">Learners</th>
                          <th className="px-2 py-2">Meals</th>
                          <th className="px-2 py-2">Est. cost</th>
                          <th className="px-2 py-2">Top products</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.schools.map((s) => (
                          <tr
                            key={s.school_profile_id}
                            className="border-b border-slate-50"
                          >
                            <td className="px-4 py-2">
                              <div className="font-semibold">
                                {s.school_name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {s.district || ''}
                              </div>
                            </td>
                            <td className="px-2 py-2 tabular-nums font-bold">
                              {s.learners}
                            </td>
                            <td className="px-2 py-2 tabular-nums">
                              {s.total_meals.toLocaleString()}
                            </td>
                            <td className="px-2 py-2 tabular-nums text-xs">
                              {formatMoney(s.estimated_cost_zar)}
                            </td>
                            <td className="px-2 py-2 text-[11px] text-slate-600 max-w-xs truncate">
                              {(s.mrp || [])
                                .slice(0, 4)
                                .map((l) => `${l.product_name} ${l.qty}${l.uom}`)
                                .join(' · ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {role === 'agency' &&
              (plan.service_providers || []).length > 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b text-sm font-black">
                    Estimated MPS / MRP by service provider
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                          <th className="px-4 py-2">SP</th>
                          <th className="px-2 py-2">Schools</th>
                          <th className="px-2 py-2">Learners</th>
                          <th className="px-2 py-2">Meals</th>
                          <th className="px-2 py-2">Est. cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.service_providers.map((sp) => (
                          <tr
                            key={sp.isp_profile_id}
                            className="border-b border-slate-50"
                          >
                            <td className="px-4 py-2 font-semibold">
                              {sp.isp_name}
                            </td>
                            <td className="px-2 py-2 tabular-nums">
                              {sp.school_count}
                            </td>
                            <td className="px-2 py-2 tabular-nums">
                              {sp.learners}
                            </td>
                            <td className="px-2 py-2 tabular-nums">
                              {sp.total_meals.toLocaleString()}
                            </td>
                            <td className="px-2 py-2 tabular-nums text-xs">
                              {formatMoney(sp.estimated_cost_zar)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {role === 'school' ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/dashboard/schools/orders"
                    className="btn-primary !py-2 !px-3 text-xs"
                  >
                    Order from SP using MRP
                  </Link>
                  <Link
                    href="/dashboard/schools/menu"
                    className="btn-secondary !py-2 !px-3 text-xs"
                  >
                    View DBE menu
                  </Link>
                </div>
              ) : null}
              {role === 'isp' ? (
                <Link
                  href="/dashboard/schools/sp-orders-report"
                  className="btn-primary !py-2 !px-3 text-xs inline-flex"
                >
                  School orders report
                </Link>
              ) : null}
            </>
          )}
        </div>
      )}
    </SchoolsPage>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: typeof Calculator;
  tone?: 'good' | 'bad';
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 ${
        tone === 'bad'
          ? 'border-rose-200 bg-rose-50'
          : tone === 'good'
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-slate-200 bg-white'
      }`}
    >
      <div className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
        {Icon ? <Icon className="w-3 h-3" /> : null}
        {label}
      </div>
      <div className="text-lg font-black tabular-nums">{value}</div>
    </div>
  );
}
