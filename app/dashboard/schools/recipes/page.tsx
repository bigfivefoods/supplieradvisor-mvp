'use client';

/**
 * DBE Recipes (BOM) + MPS/MRP planning for schools & SPs.
 * Recipe qty/learner × NSNP learners × feeding days → product requirements.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Calculator,
  Coffee,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sun,
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
import {
  SCHOOL_WEEK_DAYS,
  productsForMealHint,
  type MealTypeKey,
} from '@/lib/schools/meal-guide';

type Product = {
  id: number;
  name: string;
  brand_name: string;
  category?: string | null;
  uom?: string | null;
  for_breakfast?: boolean;
  for_lunch?: boolean;
};

const WEEKDAY_LABEL: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

type BomLine = {
  /** Reference product id (UOM); null when pure category line until save */
  approved_product_id: number | null;
  product_name: string;
  brand_name: string;
  category: string;
  /** DBE selects category; schools pick brand within category */
  category_only?: boolean;
  qty_per_portion: string;
  uom: string;
  wastage_pct: string;
};

type Recipe = {
  id: number;
  name: string;
  meal_type: string;
  /** 1=Mon … 5=Fri */
  weekday?: number | null;
  portion_learners: number;
  active?: boolean;
  description?: string | null;
  lines: Array<{
    id?: number;
    approved_product_id: number | null;
    product_name: string;
    brand_name?: string | null;
    category?: string | null;
    qty_per_portion: number;
    uom: string;
    wastage_pct?: number;
    notes?: string | null;
    chosen_product_id?: number | null;
    chosen_product_name?: string | null;
    chosen_brand_name?: string | null;
    brand_options?: Array<{
      id: number;
      name: string;
      brand_name: string;
      category?: string | null;
      uom?: string | null;
    }>;
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
  feeding_days_from_calendar?: boolean;
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
    service_days?: number;
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
  const [canChooseBrand, setCanChooseBrand] = useState(false);
  const [tab, setTab] = useState<'recipes' | 'plan' | 'budgets'>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [brandBusy, setBrandBusy] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month', 4)
  );
  const [saving, setSaving] = useState(false);
  /** DBE BOM: pick category first (preferred) vs single product */
  const [bomMode, setBomMode] = useState<'category' | 'product'>('category');
  const [bomCategory, setBomCategory] = useState('');

  // Recipe editor
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState('lunch');
  const [weekday, setWeekday] = useState<string>('1'); // 1–5 Mon–Fri
  const [description, setDescription] = useState('');
  const [bomLines, setBomLines] = useState<BomLine[]>([]);
  const [productId, setProductId] = useState('');
  const [qtyPer, setQtyPer] = useState('0.05');
  const [wastage, setWastage] = useState('5');
  const editorRef = useRef<HTMLDivElement>(null);

  // Budget editor
  const [bEditId, setBEditId] = useState<number | null>(null);
  const [bCategory, setBCategory] = useState('');
  const [bAmount, setBAmount] = useState('');
  const [bPrice, setBPrice] = useState('');
  const [bUom, setBUom] = useState('kg');

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
      setCanChooseBrand(Boolean(r.canChooseBrand));
      setRecipes(r.recipes || pl.recipes || []);
      setProducts(p.products || []);
      setBudgets(pl.budgets || []);
      setPlan(pl.plan || null);
      if (r.message && !(r.recipes || []).length) toast.message(r.message);
      if (r.brand_choice_help && r.canChooseBrand) {
        /* soft — UI shows help */
      }
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

  const openNew = (slot?: { weekday: number; meal: MealTypeKey }) => {
    setEditId(null);
    setName('');
    setMealType(slot?.meal || 'lunch');
    setWeekday(slot?.weekday != null ? String(slot.weekday) : '1');
    setDescription('');
    setBomLines([]);
    setProductId('');
    setBomCategory('');
    setBomMode('category');
    if (slot) {
      const dayName = WEEKDAY_LABEL[slot.weekday] || `Day ${slot.weekday}`;
      setName(`${dayName} ${slot.meal === 'breakfast' ? 'Breakfast' : 'Lunch'}`);
    }
  };

  const openEdit = (r: Recipe) => {
    setEditId(r.id);
    setName(r.name);
    setMealType(r.meal_type || 'lunch');
    setWeekday(
      r.weekday != null && r.weekday >= 1 && r.weekday <= 5
        ? String(r.weekday)
        : ''
    );
    setDescription(r.description || '');
    setBomLines(
      (r.lines || []).map((l) => {
        const categoryOnly =
          !l.brand_name ||
          String(l.notes || '').includes('category_line:') ||
          (l.brand_options && l.brand_options.length > 1 && !l.brand_name);
        return {
          approved_product_id:
            l.approved_product_id != null
              ? Number(l.approved_product_id)
              : null,
          product_name: l.product_name,
          brand_name: l.brand_name || '',
          category: l.category || 'other',
          category_only: Boolean(categoryOnly),
          qty_per_portion: String(l.qty_per_portion),
          uom: l.uom || 'kg',
          wastage_pct: String(l.wastage_pct ?? 0),
        };
      })
    );
    setProductId('');
    setBomCategory('');
    setBomMode('category');
    setTab('recipes');
    // Bring editor into view so Edit is obvious
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const updateBomLine = (
    index: number,
    patch: Partial<Pick<BomLine, 'qty_per_portion' | 'wastage_pct'>>
  ) => {
    setBomLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
  };

  /** Click a week-grid cell: edit first recipe there, or start a new one for that slot */
  const selectWeekSlot = (day: number, meal: MealTypeKey) => {
    setWeekday(String(day));
    setMealType(meal);
    const hit = recipes.find(
      (r) =>
        Number(r.weekday) === day &&
        String(r.meal_type || '').toLowerCase() === meal
    );
    if (hit) openEdit(hit);
    else openNew({ weekday: day, meal });
  };

  const slotRecipes = (day: number, meal: MealTypeKey) =>
    recipes.filter(
      (r) =>
        Number(r.weekday) === day &&
        String(r.meal_type || '').toLowerCase() === meal
    );

  const selectedSlotLabel = useMemo(() => {
    const d = weekday === '' ? null : Number(weekday);
    const dayName =
      d != null && WEEKDAY_LABEL[d] ? WEEKDAY_LABEL[d] : 'No day selected';
    const meal =
      mealType === 'breakfast'
        ? 'Breakfast'
        : mealType === 'lunch'
          ? 'Lunch'
          : mealType;
    return { dayName, meal, day: d };
  }, [weekday, mealType]);

  /** Catalogue products for the selected meal only (breakfast/lunch tags) */
  const mealProducts = useMemo(() => {
    const meal = (
      mealType === 'breakfast' ? 'breakfast' : 'lunch'
    ) as MealTypeKey;
    return productsForMealHint(products, meal) as Product[];
  }, [products, mealType]);

  /** Group recipes Mon→Fri, breakfast then lunch within each day */
  const recipesByWeekday = useMemo(() => {
    const mealRank = (mt: string) =>
      String(mt || '').toLowerCase() === 'breakfast' ? 0 : 1;
    const sortInDay = (a: Recipe, b: Recipe) => {
      const mr = mealRank(a.meal_type) - mealRank(b.meal_type);
      if (mr !== 0) return mr;
      return String(a.name).localeCompare(String(b.name));
    };

    const days = SCHOOL_WEEK_DAYS.map((d) => ({
      day: d.day as number,
      label: d.label,
      short: d.short,
      breakfast: [] as Recipe[],
      lunch: [] as Recipe[],
      other: [] as Recipe[],
    }));
    const unassigned: Recipe[] = [];

    for (const r of recipes) {
      const wd = r.weekday != null ? Number(r.weekday) : NaN;
      const bucket = days.find((d) => d.day === wd);
      if (!bucket) {
        unassigned.push(r);
        continue;
      }
      const mt = String(r.meal_type || '').toLowerCase();
      if (mt === 'breakfast') bucket.breakfast.push(r);
      else if (mt === 'lunch') bucket.lunch.push(r);
      else bucket.other.push(r);
    }
    for (const d of days) {
      d.breakfast.sort(sortInDay);
      d.lunch.sort(sortInDay);
      d.other.sort(sortInDay);
    }
    unassigned.sort((a, b) => {
      const mr = mealRank(a.meal_type) - mealRank(b.meal_type);
      if (mr !== 0) return mr;
      return String(a.name).localeCompare(String(b.name));
    });
    return { days, unassigned };
  }, [recipes]);

  const addBomLine = () => {
    const qty = Number(qtyPer);
    if (!(qty > 0)) return toast.error('Qty per learner portion must be > 0');

    // Preferred: category line — schools pick brand later
    if (bomMode === 'category') {
      const cat = bomCategory.trim();
      if (!cat) return toast.error('Select a product category for the BOM line');
      const inCat = products.filter(
        (p) =>
          String(p.category || '')
            .toLowerCase()
            .trim() === cat.toLowerCase()
      );
      if (!inCat.length) {
        return toast.error(
          `No approved products in “${cat}” — add brands on Approved foods first`
        );
      }
      const uom = inCat[0].uom || 'kg';
      setBomLines((prev) => {
        if (
          prev.some(
            (l) =>
              l.category_only &&
              l.category.toLowerCase() === cat.toLowerCase()
          )
        ) {
          return prev.map((l) =>
            l.category_only && l.category.toLowerCase() === cat.toLowerCase()
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
            approved_product_id: inCat[0].id,
            product_name: `${cat} (school chooses brand)`,
            brand_name: '',
            category: cat,
            category_only: true,
            qty_per_portion: String(qty),
            uom,
            wastage_pct: wastage,
          },
        ];
      });
      setBomCategory('');
      toast.message(
        `${inCat.length} approved brand(s) in “${cat}” — schools pick which one`
      );
      return;
    }

    const prod =
      mealProducts.find((p) => p.id === Number(productId)) ||
      products.find((p) => p.id === Number(productId));
    if (!prod) return toast.error('Select an approved catalogue product');
    setBomLines((prev) => {
      if (prev.some((l) => l.approved_product_id === prod.id && !l.category_only)) {
        return prev.map((l) =>
          l.approved_product_id === prod.id && !l.category_only
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
          category_only: false,
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
    if (weekday === '' || !Number(weekday)) {
      return toast.error('Pick a weekday on the week planner (Mon–Fri)');
    }
    if (mealType !== 'breakfast' && mealType !== 'lunch') {
      return toast.error('Pick Breakfast or Lunch');
    }
    if (!bomLines.length) return toast.error('Add at least one BOM product line');
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
          weekday: Number(weekday),
          description: description || null,
          portion_learners: 1,
          lines: bomLines.map((l) => ({
            approved_product_id: l.category_only
              ? null
              : l.approved_product_id,
            product_name: l.product_name,
            qty_per_portion: Number(l.qty_per_portion),
            uom: l.uom,
            wastage_pct: Number(l.wastage_pct || 0),
            category: l.category,
            category_only: Boolean(l.category_only),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const dayName = WEEKDAY_LABEL[Number(weekday)] || weekday;
      toast.success(
        data.message ||
          (editId
            ? `BOM updated · ${dayName} ${mealType === 'breakfast' ? 'Breakfast' : 'Lunch'}`
            : `BOM saved · ${dayName} ${mealType === 'breakfast' ? 'Breakfast' : 'Lunch'}`)
      );
      await load();
      if (data.recipe) {
        openEdit(data.recipe as Recipe);
      } else if (data.recipe?.id || editId) {
        setEditId(Number(data.recipe?.id || editId));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveSchoolBrand = async (
    recipeId: number,
    lineId: number,
    chosenProductId: number
  ) => {
    const key = `${recipeId}:${lineId}`;
    setBrandBusy(key);
    try {
      const res = await fetch('/api/schools/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'save_school_brand_choice',
          recipe_id: recipeId,
          recipe_line_id: lineId,
          chosen_product_id: chosenProductId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save brand');
      toast.success(data.message || 'Brand selected');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBrandBusy(null);
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

  const clearBudgetForm = () => {
    setBEditId(null);
    setBCategory('');
    setBAmount('');
    setBPrice('');
    setBUom('kg');
  };

  const openEditBudget = (b: Budget) => {
    setBEditId(b.id ?? null);
    setBCategory(b.category || '');
    setBAmount(String(b.budget_amount_zar ?? ''));
    setBPrice(
      b.unit_price_zar != null && b.unit_price_zar !== undefined
        ? String(b.unit_price_zar)
        : ''
    );
    setBUom(b.uom || 'kg');
    // Keep the row’s period so Update does not rewrite dates to the slicer range
    if (b.period_from && b.period_to) {
      setPeriod((prev) => ({
        ...prev,
        from: b.period_from,
        to: b.period_to,
        label: `${b.period_from} → ${b.period_to}`,
        preset: 'custom',
      }));
    }
    setTab('budgets');
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
          id: bEditId || undefined,
          category: bCategory.trim(),
          period_from: period.from,
          period_to: period.to,
          budget_amount_zar: Number(bAmount) || 0,
          unit_price_zar: bPrice === '' ? null : Number(bPrice),
          uom: bUom.trim() || 'kg',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(bEditId ? 'Category budget updated' : 'Category budget saved');
      clearBudgetForm();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteBudget = async (id: number) => {
    if (!confirm('Delete this category budget?')) return;
    try {
      const res = await fetch('/api/schools/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'delete_budget',
          id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success('Budget deleted');
      if (bEditId === id) clearBudgetForm();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
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
              : 'Pick the brand for each BOM ingredient (e.g. which soya), then use MPS/MRP quantities to order from your SP. Qty per learner is set by DBE.'
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
          : canChooseBrand
            ? (['recipes', 'plan'] as const)
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
              ? canEdit
                ? 'Recipe BOM'
                : 'Choose brands'
              : t === 'plan'
                ? 'MPS / MRP plan'
                : 'Category budgets'}
          </button>
        ))}
      </div>

      {tab === 'plan' ? (
        <div className="mb-4">
          <PeriodSlicer value={period} onChange={setPeriod} />
        </div>
      ) : null}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : tab === 'recipes' && canChooseBrand && !canEdit ? (
        /* School: pick brand/product for each DBE BOM line */
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
            <strong>Choose brands for your kitchen.</strong> DBE sets the{' '}
            <em>category</em> and quantity per learner. You select the approved
            brand within each category. Your SP must buy that brand; if it is
            out of stock they may use another approved brand in the same
            category only (half SP score). Unapproved brands are not allowed.
          </div>
          {recipes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
              No programme recipes yet — wait for DBE to publish BOMs.
            </div>
          ) : (
            <div className="space-y-3">
              {recipesByWeekday.days.map((day) => {
                const dayRecipes = [
                  ...day.breakfast,
                  ...day.lunch,
                  ...day.other,
                ];
                if (!dayRecipes.length) return null;
                return (
                  <section
                    key={day.day}
                    className="rounded-3xl border border-slate-200 bg-white overflow-hidden"
                  >
                    <div className="px-4 py-2.5 bg-slate-50 border-b text-sm font-black">
                      {day.label}
                    </div>
                    {dayRecipes.map((r) => (
                      <div
                        key={r.id}
                        className="px-4 py-3 border-b border-slate-50 last:border-0 space-y-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-sm">{r.name}</p>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                              String(r.meal_type).toLowerCase() === 'breakfast'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-sky-100 text-sky-900'
                            }`}
                          >
                            {r.meal_type}
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {(r.lines || []).map((l, li) => {
                            const lineId = l.id != null ? Number(l.id) : null;
                            const options = l.brand_options || [];
                            // School must explicitly pick brand — do not default to DBE reference product
                            const selected =
                              l.chosen_product_id != null
                                ? Number(l.chosen_product_id)
                                : '';
                            const busyKey =
                              lineId != null ? `${r.id}:${lineId}` : null;
                            return (
                              <li
                                key={lineId ?? `${r.id}-${li}`}
                                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase text-slate-400">
                                      Category ·{' '}
                                      {(l.category || 'product').replace(
                                        /_/g,
                                        ' '
                                      )}{' '}
                                      · {l.qty_per_portion} {l.uom}/learner
                                      {l.wastage_pct
                                        ? ` · +${l.wastage_pct}% waste`
                                        : ''}
                                    </p>
                                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                                      DBE: {l.category || l.product_name}
                                      {l.brand_name
                                        ? ` · default ref ${l.brand_name}`
                                        : ' · school chooses brand'}
                                    </p>
                                  </div>
                                </div>
                                {lineId != null && options.length > 1 ? (
                                  <label className="block mt-2 text-xs">
                                    <span className="text-[10px] font-bold uppercase text-emerald-800">
                                      Your brand (within category)
                                    </span>
                                    <select
                                      className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-semibold"
                                      value={selected === '' ? '' : String(selected)}
                                      disabled={brandBusy === busyKey}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (!Number.isFinite(v)) return;
                                        void saveSchoolBrand(r.id, lineId, v);
                                      }}
                                    >
                                      <option value="">
                                        Select approved brand…
                                      </option>
                                      {options.map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.brand_name
                                            ? `${o.brand_name} — ${o.name}`
                                            : o.name}
                                        </option>
                                      ))}
                                    </select>
                                    {brandBusy === busyKey ? (
                                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                                        <Loader2 className="w-3 h-3 animate-spin" />{' '}
                                        Saving…
                                      </span>
                                    ) : (
                                      <span className="block mt-1 text-[10px] text-slate-500">
                                        {options.length} approved option
                                        {options.length === 1 ? '' : 's'} in this
                                        range
                                      </span>
                                    )}
                                  </label>
                                ) : (
                                  <p className="mt-2 text-xs text-slate-600">
                                    Using{' '}
                                    <strong>
                                      {l.chosen_brand_name ||
                                        l.brand_name ||
                                        '—'}{' '}
                                      ·{' '}
                                      {l.chosen_product_name || l.product_name}
                                    </strong>
                                    {options.length <= 1
                                      ? ' (only approved option in this range)'
                                      : ''}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </section>
                );
              })}
              {recipesByWeekday.unassigned.length > 0 ? (
                <section className="rounded-3xl border border-amber-100 bg-amber-50/40 p-4">
                  <p className="text-sm font-black text-amber-950 mb-2">
                    Other recipes
                  </p>
                  {recipesByWeekday.unassigned.map((r) => (
                    <div key={r.id} className="mb-3 last:mb-0">
                      <p className="font-bold text-sm">{r.name}</p>
                      <ul className="mt-1 space-y-2">
                        {(r.lines || []).map((l, li) => {
                          const lineId = l.id != null ? Number(l.id) : null;
                          const options = l.brand_options || [];
                          const selected =
                            l.chosen_product_id != null
                              ? Number(l.chosen_product_id)
                              : '';
                          return (
                            <li
                              key={lineId ?? li}
                              className="rounded-xl border border-amber-100 bg-white p-2"
                            >
                              <p className="text-xs font-semibold">
                                {l.category} · {l.qty_per_portion}
                                {l.uom}/learner
                              </p>
                              {lineId != null && options.length > 1 ? (
                                <select
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold"
                                  value={
                                    selected === '' ? '' : String(selected)
                                  }
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    if (!Number.isFinite(v)) return;
                                    void saveSchoolBrand(r.id, lineId, v);
                                  }}
                                >
                                  <option value="">Select brand…</option>
                                  {options.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.brand_name
                                        ? `${o.brand_name} — ${o.name}`
                                        : o.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className="text-[11px] text-slate-600">
                                  {l.chosen_brand_name || l.brand_name} ·{' '}
                                  {l.chosen_product_name || l.product_name}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </section>
              ) : null}
            </div>
          )}
        </div>
      ) : tab === 'recipes' && canEdit ? (
        <div className="space-y-4">
          {/* ── Week planner: click a cell to set day + meal ─────────── */}
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-black inline-flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-[#0077b6]" />
                  Week planner · assign BOM to a day &amp; meal
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click a cell (e.g. <strong>Tue · Breakfast</strong>) to create
                  or edit that recipe. Filled cells already have a BOM.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {recipes.length} recipe{recipes.length === 1 ? '' : 's'} ·{' '}
                {recipesByWeekday.unassigned.length} unassigned
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 text-left w-28">Meal</th>
                    {SCHOOL_WEEK_DAYS.map((d) => (
                      <th key={d.day} className="px-2 py-2 text-center">
                        <span className="inline-flex flex-col items-center">
                          <span className="text-slate-900 font-black text-xs">
                            {d.short}
                          </span>
                          <span className="font-semibold normal-case tracking-normal text-slate-400">
                            {d.label}
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(['breakfast', 'lunch'] as MealTypeKey[]).map((meal) => {
                    const isB = meal === 'breakfast';
                    return (
                      <tr key={meal} className="border-t border-slate-100">
                        <td
                          className={`px-3 py-2 font-black text-xs uppercase ${
                            isB ? 'text-amber-800' : 'text-sky-800'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {isB ? (
                              <Coffee className="w-3.5 h-3.5" />
                            ) : (
                              <Sun className="w-3.5 h-3.5" />
                            )}
                            {isB ? 'Breakfast' : 'Lunch'}
                          </span>
                        </td>
                        {SCHOOL_WEEK_DAYS.map((d) => {
                          const list = slotRecipes(d.day, meal);
                          const selected =
                            String(weekday) === String(d.day) &&
                            mealType === meal;
                          const has = list.length > 0;
                          return (
                            <td key={`${d.day}-${meal}`} className="p-1.5 align-top">
                              <button
                                type="button"
                                onClick={() => selectWeekSlot(d.day, meal)}
                                className={`w-full min-h-[4.5rem] rounded-2xl border-2 px-2 py-2 text-left transition-all ${
                                  selected
                                    ? isB
                                      ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                                      : 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
                                    : has
                                      ? isB
                                        ? 'border-amber-200 bg-amber-50/60 hover:border-amber-400'
                                        : 'border-sky-200 bg-sky-50/60 hover:border-sky-400'
                                      : 'border-dashed border-slate-200 bg-slate-50/50 hover:border-[#00b4d8] hover:bg-sky-50/40'
                                }`}
                              >
                                {has ? (
                                  <div className="space-y-1.5">
                                    {list.map((r) => (
                                      <div
                                        key={r.id}
                                        className={
                                          editId === r.id
                                            ? 'rounded-lg bg-white/80 px-1 py-0.5 ring-1 ring-[#00b4d8]/40'
                                            : ''
                                        }
                                      >
                                        <p className="text-[11px] font-bold text-slate-900 leading-snug line-clamp-2">
                                          {r.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          {(r.lines || []).length} product
                                          {(r.lines || []).length === 1
                                            ? ''
                                            : 's'}
                                          {editId === r.id ? ' · editing' : ''}
                                        </p>
                                        {list.length > 1 ? (
                                          <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openEdit(r);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.stopPropagation();
                                                openEdit(r);
                                              }
                                            }}
                                            className="text-[10px] font-bold text-[#0077b6] underline"
                                          >
                                            Edit this
                                          </span>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[11px] font-semibold text-slate-400 text-center py-2">
                                    + Add
                                  </p>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {recipesByWeekday.unassigned.length > 0 ? (
              <div className="px-4 py-3 border-t border-amber-100 bg-amber-50/50">
                <p className="text-[11px] font-bold text-amber-950 mb-2">
                  Unassigned recipes — open one and pick a week cell, then save
                </p>
                <div className="flex flex-wrap gap-2">
                  {recipesByWeekday.unassigned.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => openEdit(r)}
                      className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-bold text-amber-950 hover:bg-amber-100"
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* ── Recipe editor for the selected slot ─────────────────── */}
          <div className="grid lg:grid-cols-5 gap-4">
            <div
              ref={editorRef}
              className={`lg:col-span-3 rounded-3xl border bg-white p-4 sm:p-5 space-y-4 ${
                editId
                  ? 'border-[#00b4d8] ring-2 ring-[#00b4d8]/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black inline-flex items-center gap-2">
                    {editId ? (
                      <>
                        <Pencil className="w-4 h-4 text-[#0077b6]" />
                        Editing BOM #{editId}
                      </>
                    ) : (
                      'New recipe BOM'
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {editId
                      ? 'Change day, meal, name, or edit ingredient qty / wastage below — then Update BOM.'
                      : 'Pick a week cell (or day + meal), add ingredients, then Save.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${
                      mealType === 'breakfast'
                        ? 'bg-amber-100 border-amber-300 text-amber-950'
                        : 'bg-sky-100 border-sky-300 text-sky-950'
                    }`}
                  >
                    {selectedSlotLabel.dayName} · {selectedSlotLabel.meal}
                  </span>
                  {editId ? (
                    <button
                      type="button"
                      onClick={() =>
                        openNew({
                          weekday: Number(weekday) || 1,
                          meal: (mealType === 'breakfast'
                            ? 'breakfast'
                            : 'lunch') as MealTypeKey,
                        })
                      }
                      className="text-[11px] font-bold text-slate-500 px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
                    >
                      Cancel edit · new
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Big day + meal buttons (in case user wants to change without grid) */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  1 · When is this meal served?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SCHOOL_WEEK_DAYS.map((d) => {
                    const on = String(weekday) === String(d.day);
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => setWeekday(String(d.day))}
                        className={`min-w-[3.25rem] rounded-xl border px-2.5 py-2 text-xs font-black transition-colors ${
                          on
                            ? 'border-[#0077b6] bg-[#0077b6] text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMealType('breakfast')}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black ${
                      mealType === 'breakfast'
                        ? 'border-amber-500 bg-amber-100 text-amber-950'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
                    }`}
                  >
                    <Coffee className="w-3.5 h-3.5" /> Breakfast
                  </button>
                  <button
                    type="button"
                    onClick={() => setMealType('lunch')}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black ${
                      mealType === 'lunch'
                        ? 'border-sky-500 bg-sky-100 text-sky-950'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" /> Lunch
                  </button>
                </div>
              </div>

              <label className="block text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  2 · Recipe name *
                </span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fortified maize porridge"
                />
              </label>
              <label className="block text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Description (optional)
                </span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Prep notes for schools / kitchens"
                />
              </label>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    3 · BOM ingredients (qty per 1 learner)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    <strong>DBE selects the category</strong> (e.g. soya).
                    Schools then pick the brand within that category. SPs must
                    buy the school brand (or an approved same-category
                    substitute if OOS — half score).
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setBomMode('category')}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold border ${
                      bomMode === 'category'
                        ? 'bg-[#0077b6] text-white border-[#0077b6]'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    By category (recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBomMode('product')}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold border ${
                      bomMode === 'product'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Specific product
                  </button>
                </div>

                {bomMode === 'category' ? (
                  <label className="block text-xs">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Product category *
                    </span>
                    <select
                      className="w-full rounded-xl border border-sky-200 bg-sky-50/40 px-3 py-2.5 text-sm font-semibold"
                      value={bomCategory}
                      onChange={(e) => setBomCategory(e.target.value)}
                    >
                      <option value="">Select category…</option>
                      {categories.map((c) => {
                        const n = products.filter(
                          (p) =>
                            String(p.category || '').toLowerCase() ===
                            c.toLowerCase()
                        ).length;
                        return (
                          <option key={c} value={c}>
                            {c} · {n} brand{n === 1 ? '' : 's'}
                          </option>
                        );
                      })}
                    </select>
                    {bomCategory ? (
                      <span className="block mt-1 text-[10px] text-sky-800 font-semibold">
                        Schools will choose among{' '}
                        {
                          products.filter(
                            (p) =>
                              String(p.category || '').toLowerCase() ===
                              bomCategory.toLowerCase()
                          ).length
                        }{' '}
                        approved brand(s) in this category
                      </span>
                    ) : null}
                  </label>
                ) : (
                  <label className="block text-xs">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Specific approved product
                    </span>
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                    >
                      <option value="">
                        {mealProducts.length
                          ? `Select ${selectedSlotLabel.meal.toLowerCase()} product…`
                          : 'Select product from catalogue…'}
                      </option>
                      {(mealProducts.length ? mealProducts : products).map(
                        (p) => (
                          <option key={p.id} value={p.id}>
                            {p.brand_name} — {p.name}
                            {p.category ? ` · ${p.category}` : ''}
                            {p.uom ? ` (${p.uom})` : ''}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Qty per 1 learner
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold tabular-nums"
                      value={qtyPer}
                      onChange={(e) => setQtyPer(e.target.value)}
                      placeholder="e.g. 0.08"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Wastage %
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm tabular-nums"
                      value={wastage}
                      onChange={(e) => setWastage(e.target.value)}
                      placeholder="e.g. 5"
                      inputMode="decimal"
                    />
                  </label>
                </div>

                {(() => {
                  const q = Number(qtyPer);
                  const w = Number(wastage) || 0;
                  if (!(q > 0)) return null;
                  const prod =
                    bomMode === 'product'
                      ? mealProducts.find((p) => p.id === Number(productId)) ||
                        products.find((p) => p.id === Number(productId))
                      : products.find(
                          (p) =>
                            String(p.category || '').toLowerCase() ===
                            bomCategory.toLowerCase()
                        );
                  if (!prod && bomMode === 'product') return null;
                  if (bomMode === 'category' && !bomCategory) return null;
                  const total = Math.round(q * (1 + w / 100) * 1e6) / 1e6;
                  const uom = prod?.uom || 'uom';
                  return (
                    <p className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                      Total per 1 learner (incl. wastage):{' '}
                      <span className="font-black tabular-nums">
                        {total} {uom}
                      </span>
                    </p>
                  );
                })()}

                <button
                  type="button"
                  onClick={addBomLine}
                  className="btn-secondary !py-2.5 !px-3 text-xs w-full"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  {bomMode === 'category'
                    ? 'Add category to BOM'
                    : 'Add product to BOM'}
                </button>
              </div>

              {bomLines.length > 0 ? (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      BOM lines · edit qty / wastage inline
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      {bomLines.length} ingredient
                      {bomLines.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {bomLines.map((l, i) => {
                      const q = Number(l.qty_per_portion) || 0;
                      const w = Number(l.wastage_pct) || 0;
                      const total =
                        Math.round(q * (1 + w / 100) * 1e6) / 1e6;
                      return (
                        <li
                          key={`${l.approved_product_id}-${i}`}
                          className="px-3 py-2.5 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center"
                        >
                          <div className="sm:col-span-5 min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {l.category_only || !l.brand_name
                                ? `Category · ${l.category}`
                                : `${l.brand_name} · ${l.product_name}`}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {l.category_only || !l.brand_name
                                ? 'Schools pick brand · '
                                : ''}
                              {l.category} · UOM {l.uom}
                            </p>
                          </div>
                          <label className="sm:col-span-2 block text-[10px]">
                            <span className="font-bold uppercase text-slate-400">
                              Qty / learner
                            </span>
                            <input
                              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold tabular-nums text-right"
                              value={l.qty_per_portion}
                              inputMode="decimal"
                              onChange={(e) =>
                                updateBomLine(i, {
                                  qty_per_portion: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="sm:col-span-2 block text-[10px]">
                            <span className="font-bold uppercase text-slate-400">
                              Wastage %
                            </span>
                            <input
                              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm tabular-nums text-right"
                              value={l.wastage_pct}
                              inputMode="decimal"
                              onChange={(e) =>
                                updateBomLine(i, {
                                  wastage_pct: e.target.value,
                                })
                              }
                            />
                          </label>
                          <div className="sm:col-span-2 text-right">
                            <p className="text-[9px] font-bold uppercase text-slate-400">
                              Total
                            </p>
                            <p className="text-sm font-black tabular-nums text-emerald-800">
                              {total}{' '}
                              <span className="text-[10px] font-semibold text-slate-500">
                                {l.uom}
                              </span>
                            </p>
                          </div>
                          <div className="sm:col-span-1 flex sm:justify-end">
                            <button
                              type="button"
                              className="text-rose-600 font-bold text-xs px-2 py-1 rounded-lg border border-rose-100 hover:bg-rose-50"
                              title="Remove from BOM"
                              onClick={() =>
                                setBomLines((prev) =>
                                  prev.filter((_, j) => j !== i)
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">
                  No ingredients yet — add catalogue products above.
                </p>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveRecipe()}
                className="btn-primary !py-3 !px-4 text-sm w-full inline-flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editId ? 'Update BOM' : 'Save BOM'} ·{' '}
                {selectedSlotLabel.dayName} {selectedSlotLabel.meal}
              </button>
            </div>

            {/* Side list of all recipes for this week */}
            <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white overflow-hidden max-h-[40rem] overflow-y-auto">
              <div className="px-4 py-3 border-b text-sm font-black sticky top-0 bg-white z-10">
                All recipes ({recipes.length})
              </div>
              {recipes.length === 0 ? (
                <p className="px-4 py-10 text-center text-slate-500 text-sm">
                  Click a week cell to start your first BOM.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recipesByWeekday.days.map((day) => {
                    const dayRecipes = [
                      ...day.breakfast,
                      ...day.lunch,
                      ...day.other,
                    ];
                    if (!dayRecipes.length) return null;
                    return (
                      <section key={day.day}>
                        <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                          {day.label}
                        </div>
                        {day.breakfast.length > 0 ? (
                          <MealGroup
                            label="Breakfast"
                            icon="breakfast"
                            recipes={day.breakfast}
                            editId={editId}
                            onEdit={openEdit}
                            onDelete={deleteRecipe}
                          />
                        ) : null}
                        {day.lunch.length > 0 ? (
                          <MealGroup
                            label="Lunch"
                            icon="lunch"
                            recipes={day.lunch}
                            editId={editId}
                            onEdit={openEdit}
                            onDelete={deleteRecipe}
                          />
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : tab === 'budgets' && canEdit ? (
        <div className="space-y-4">
          <div className="mb-2">
            <PeriodSlicer value={period} onChange={setPeriod} />
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black">
                {bEditId
                  ? `Edit category budget #${bEditId}`
                  : 'New category budget'}
              </p>
              {bEditId ? (
                <button
                  type="button"
                  onClick={clearBudgetForm}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                >
                  Cancel edit · new
                </button>
              ) : null}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
              <label className="text-xs lg:col-span-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Category
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  list="cat-list"
                  value={bCategory}
                  onChange={(e) => setBCategory(e.target.value)}
                  placeholder="e.g. maize_meal, cereal"
                />
                <datalist id="cat-list">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="text-xs">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Budget amount (R)
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold tabular-nums"
                  value={bAmount}
                  onChange={(e) => setBAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  inputMode="decimal"
                />
                <span className="block mt-0.5 text-[10px] text-slate-400">
                  Total R for this category in the period
                </span>
              </label>
              <label className="text-xs">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Est. unit price
                </span>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-sky-200">
                  <span className="px-2.5 py-2 text-xs font-black text-slate-500 bg-slate-50 border-r border-slate-200">
                    R
                  </span>
                  <input
                    className="min-w-0 flex-1 px-2 py-2 text-sm tabular-nums outline-none"
                    value={bPrice}
                    onChange={(e) => setBPrice(e.target.value)}
                    placeholder="e.g. 90"
                    inputMode="decimal"
                  />
                  <span className="px-2.5 py-2 text-xs font-black text-sky-800 bg-sky-50 border-l border-slate-200 whitespace-nowrap">
                    / {bUom || 'kg'}
                  </span>
                </div>
                <span className="block mt-0.5 text-[10px] text-slate-400">
                  Rand per unit · MRP cost = qty × this price
                </span>
              </label>
              <label className="text-xs">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Price unit (per …)
                </span>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                  value={bUom}
                  onChange={(e) => setBUom(e.target.value)}
                >
                  <option value="kg">per kg (R / kg)</option>
                  <option value="g">per g (R / g)</option>
                  <option value="L">per L (R / L)</option>
                  <option value="ml">per ml (R / ml)</option>
                  <option value="unit">per unit (R / unit)</option>
                  <option value="tin">per tin (R / tin)</option>
                  <option value="bag">per bag (R / bag)</option>
                  <option value="pack">per pack (R / pack)</option>
                </select>
                <span className="block mt-0.5 text-[10px] text-slate-400">
                  Must match BOM line UOM for costing
                </span>
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveBudget()}
                className="btn-primary !py-2.5 !px-3 text-xs inline-flex items-center justify-center gap-1"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {bEditId ? 'Update budget' : 'Save budget'}
              </button>
            </div>
            {bPrice !== '' && Number(bPrice) > 0 ? (
              <p className="text-[11px] font-semibold text-sky-900 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
                Preview — estimated unit price:{' '}
                <span className="font-black tabular-nums">
                  {formatMoney(Number(bPrice))}/{bUom || 'kg'}
                </span>
                {bCategory ? (
                  <>
                    {' '}
                    for category <span className="font-black">“{bCategory}”</span>
                  </>
                ) : null}
                <span className="block mt-0.5 font-normal text-sky-800/80">
                  Example: 100 {bUom || 'kg'} × {formatMoney(Number(bPrice))}/
                  {bUom || 'kg'} = {formatMoney(100 * Number(bPrice))}
                </span>
              </p>
            ) : null}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                  <th className="px-4 py-2">Category</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Budget (R)</th>
                  <th className="px-3 py-2">Est. unit price (R / UOM)</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {budgets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No category budgets for this period.
                    </td>
                  </tr>
                ) : (
                  budgets.map((b) => (
                    <tr
                      key={b.id}
                      className={`border-b border-slate-50 ${
                        bEditId === b.id ? 'bg-sky-50/60' : ''
                      }`}
                    >
                      <td className="px-4 py-2 font-semibold">{b.category}</td>
                      <td className="px-3 py-2 text-xs">
                        {b.period_from} → {b.period_to}
                      </td>
                      <td className="px-3 py-2 tabular-nums font-bold">
                        {formatMoney(b.budget_amount_zar)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs">
                        {b.unit_price_zar != null ? (
                          <span className="font-semibold">
                            {formatMoney(b.unit_price_zar)}
                            <span className="text-slate-500 font-bold">
                              /{b.uom || 'kg'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">— (no unit price)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => openEditBudget(b)}
                            className="text-[11px] font-bold text-[#0077b6] px-2 py-1 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              b.id != null && void deleteBudget(b.id)
                            }
                            className="text-[11px] font-bold text-rose-600 px-2 py-1 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
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
                  label={
                    plan.feeding_days_from_calendar
                      ? 'Feeding days (calendar)'
                      : 'Feeding days (weekdays)'
                  }
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

              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-sky-950 flex flex-wrap items-center justify-between gap-2">
                <p>
                  <strong>How it works:</strong> Meals = learners × whole service
                  days (weekday-assigned recipes count only those weekdays in
                  the period
                  {plan.feeding_days_from_calendar
                    ? ' from the DBE feeding calendar'
                    : ''}
                  ). Product MRP = BOM qty per learner × those meals. No
                  fractional week splits.
                </p>
                <Link
                  href="/dashboard/schools/feeding-calendar"
                  className="text-xs font-bold text-[#0077b6] hover:underline shrink-0"
                >
                  Feeding calendar →
                </Link>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black mb-2">MPS · meals by recipe</p>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Whole learner-meals = learners × service days (days this
                    recipe is served in the period).
                  </p>
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
                          {m.service_days != null ? (
                            <span className="block text-[10px] font-normal text-slate-400">
                              {m.service_days} service day
                              {m.service_days === 1 ? '' : 's'} in period
                            </span>
                          ) : null}
                        </span>
                        <span className="font-black tabular-nums text-right">
                          {Number.isInteger(m.meals)
                            ? m.meals.toLocaleString()
                            : Math.round(m.meals).toLocaleString()}{' '}
                          meals
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

function MealGroup({
  label,
  icon,
  recipes,
  editId,
  onEdit,
  onDelete,
  bare,
}: {
  label: string;
  icon: 'breakfast' | 'lunch';
  recipes: Recipe[];
  editId: number | null;
  onEdit: (r: Recipe) => void;
  onDelete: (id: number) => void;
  bare?: boolean;
}) {
  const Icon = icon === 'breakfast' ? Coffee : Sun;
  const tone =
    icon === 'breakfast'
      ? 'text-amber-800 bg-amber-50 border-amber-100'
      : 'text-sky-800 bg-sky-50 border-sky-100';

  return (
    <div className={bare ? '' : ''}>
      {!bare ? (
        <div
          className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider border-b flex items-center gap-1.5 ${tone}`}
        >
          <Icon className="w-3 h-3" />
          {label}
        </div>
      ) : null}
      <ul>
        {recipes.map((r) => (
          <li
            key={r.id}
            className={`px-4 py-3 flex flex-wrap items-start justify-between gap-2 ${
              editId === r.id ? 'bg-sky-50/70' : 'hover:bg-slate-50/80'
            }`}
          >
            <div className="min-w-0">
              <p className="font-bold text-sm">
                {r.name}{' '}
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                    String(r.meal_type).toLowerCase() === 'breakfast'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-sky-100 text-sky-900'
                  }`}
                >
                  {r.meal_type || 'meal'}
                </span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {(r.lines || [])
                  .map(
                    (l) =>
                      `${l.product_name} ${l.qty_per_portion}${l.uom}`
                  )
                  .join(' · ') || 'No lines'}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(r)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1 ${
                  editId === r.id
                    ? 'bg-[#0077b6] text-white border-[#0077b6]'
                    : 'text-[#0077b6] border-sky-200 bg-sky-50 hover:bg-sky-100'
                }`}
              >
                <Pencil className="w-3 h-3" />
                {editId === r.id ? 'Editing' : 'Edit BOM'}
              </button>
              <button
                type="button"
                onClick={() => void onDelete(r.id)}
                className="text-[11px] font-bold text-rose-600 px-2 py-1.5 rounded-lg border border-rose-100"
                aria-label={`Delete ${r.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
