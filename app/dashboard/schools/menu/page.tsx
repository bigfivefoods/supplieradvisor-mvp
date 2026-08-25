'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Coffee,
  Download,
  Landmark,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Save,
  School,
  ShoppingCart,
  Sparkles,
  Sun,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import {
  emptyTwoMealWeek,
  groupItemsByDay,
  MEAL_TYPE_META,
  normalizeTwoMealItems,
  SCHOOL_WEEK_DAYS,
  type DayMealSlot,
  type MealTypeKey,
} from '@/lib/schools/meal-guide';

type Menu = {
  id: number;
  name: string;
  cycle_days?: number;
  items?: DayMealSlot[];
  active?: boolean;
  description?: string | null;
  meal_types?: string[];
  agency_name?: string | null;
};

type Product = {
  id: number;
  name: string;
  brand_name: string;
  category?: string | null;
  for_breakfast?: boolean;
  for_lunch?: boolean;
};

type RecipeLine = {
  approved_product_id: number | null;
  product_name: string;
  brand_name?: string | null;
  category?: string | null;
  qty_per_portion: number;
  uom: string;
};

type RecipeOpt = {
  id: number;
  name: string;
  meal_type: string;
  weekday?: number | null;
  description?: string | null;
  lines: RecipeLine[];
};

function prettyCat(c: string) {
  return String(c || '')
    .replace(/_/g, ' ')
    .trim();
}

function recipeMeal(r: RecipeOpt): MealTypeKey {
  return String(r.meal_type || '').toLowerCase() === 'breakfast'
    ? 'breakfast'
    : 'lunch';
}

function productIdsFromRecipe(r: RecipeOpt): number[] {
  return [
    ...new Set(
      (r.lines || [])
        .map((l) => Number(l.approved_product_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
}

function slotFromRecipe(slot: DayMealSlot, r: RecipeOpt): DayMealSlot {
  return {
    ...slot,
    recipe_id: r.id,
    dish: r.name,
    approved_product_ids: productIdsFromRecipe(r),
    notes: r.description || undefined,
  };
}

function emptySlot(slot: DayMealSlot): DayMealSlot {
  return {
    ...slot,
    recipe_id: null,
    dish: '',
    approved_product_ids: [],
    notes: undefined,
  };
}

export default function SchoolMenuPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [mandated, setMandated] = useState<Menu | null>(null);
  const [adherence, setAdherence] = useState<{
    pct: number;
    matched: number;
    total: number;
  } | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [policy, setPolicy] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<RecipeOpt[]>([]);
  const [name, setName] = useState('NSNP weekly menu');
  const [description, setDescription] = useState(
    'Breakfast + lunch Mon–Fri — schools and SPs must follow'
  );
  const [items, setItems] = useState<DayMealSlot[]>(() => emptyTwoMealWeek());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const openMenuPdf = (opts?: { download?: boolean; menuId?: number | null }) => {
    const params = new URLSearchParams({
      companyId: String(companyId),
    });
    if (opts?.download) params.set('download', '1');
    if (opts?.menuId) params.set('id', String(opts.menuId));
    else if (mandated?.id) params.set('id', String(mandated.id));
    else if (editingId) params.set('id', String(editingId));
    const url = `/api/schools/menu/pdf?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const pruneItemsToActive = useCallback(
    (raw: DayMealSlot[], active: Product[]) => {
      const allow = new Set(active.map((p) => p.id));
      let stripped = 0;
      const next = normalizeTwoMealItems(raw).map((it) => {
        const ids = (it.approved_product_ids || []).filter((id) => {
          const ok = allow.has(id);
          if (!ok) stripped += 1;
          return ok;
        });
        return { ...it, approved_product_ids: ids };
      });
      return { items: next, stripped };
    },
    []
  );

  const loadMenuIntoEditor = useCallback(
    (m: Menu, activeProducts: Product[]) => {
      setEditingId(m.id);
      setName(m.name);
      setDescription(m.description || '');
      const { items: pruned, stripped } = pruneItemsToActive(
        m.items || [],
        activeProducts
      );
      setItems(pruned);
      if (stripped > 0) {
        toast.message(
          `${stripped} inactive / off-list product(s) hidden from recipe lines`
        );
      }
    },
    [pruneItemsToActive]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes, rRes] = await Promise.all([
        fetch(`/api/schools/menu?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/approved?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(
          `/api/schools/recipes?companyId=${companyId}&view=recipes`,
          { cache: 'no-store', credentials: 'same-origin' }
        ),
      ]);
      const m = await mRes.json();
      const p = await pRes.json();
      const r = rRes.ok ? await rRes.json() : { recipes: [] };
      if (!mRes.ok) throw new Error(m.error || 'Failed');
      const activeProducts = (p.products || []) as Product[];
      setCanEdit(Boolean(m.canEdit));
      setMenus(m.menus || []);
      setMandated(m.mandated || null);
      setAdherence(m.adherence || null);
      setAgencyName(m.agencyName || m.mandated?.agency_name || null);
      setPolicy(String(m.policy || ''));
      setProducts(activeProducts);
      setRecipes((r.recipes || []) as RecipeOpt[]);
      if (m.warning) toast.message(m.warning);
      if (m.mandated) {
        loadMenuIntoEditor(m.mandated as Menu, activeProducts);
      } else if (m.canEdit) {
        setItems(emptyTwoMealWeek());
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, loadMenuIntoEditor]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayGroups = useMemo(() => groupItemsByDay(items), [items]);

  const recipeById = useMemo(() => {
    const map = new Map<number, RecipeOpt>();
    for (const r of recipes) map.set(r.id, r);
    return map;
  }, [recipes]);

  const recipesForMeal = (meal: MealTypeKey, day: number) => {
    const list = recipes.filter((r) => recipeMeal(r) === meal);
    return [...list].sort((a, b) => {
      const aHit = Number(a.weekday) === day ? 0 : 1;
      const bHit = Number(b.weekday) === day ? 0 : 1;
      if (aHit !== bHit) return aHit - bHit;
      return a.name.localeCompare(b.name);
    });
  };

  const assignedCount = useMemo(
    () =>
      items.filter(
        (it) =>
          (it.recipe_id != null && it.recipe_id > 0) ||
          Boolean(String(it.dish || '').trim())
      ).length,
    [items]
  );

  const assignRecipe = (
    day: number,
    meal: MealTypeKey,
    recipeId: number | null
  ) => {
    if (!canEdit) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.day !== day || it.meal_type !== meal) return it;
        if (!recipeId) return emptySlot(it);
        const r = recipeById.get(recipeId);
        if (!r) return it;
        return slotFromRecipe(it, r);
      })
    );
  };

  const fillEmptyFromRecipes = () => {
    if (!canEdit) return;
    let n = 0;
    const next = items.map((it) => {
      if (it.recipe_id || String(it.dish || '').trim()) return it;
      const match = recipes.find(
        (r) =>
          Number(r.weekday) === it.day && recipeMeal(r) === it.meal_type
      );
      if (!match) return it;
      n += 1;
      return slotFromRecipe(it, match);
    });
    setItems(next);
    if (n === 0) {
      toast.message(
        'No empty slots matched a recipe weekday. Assign recipes below, or set weekdays on Recipes first.'
      );
    } else {
      toast.success(`Filled ${n} empty slot${n === 1 ? '' : 's'} from recipes`);
    }
  };

  const save = async () => {
    if (!canEdit) return toast.error('Only the department can set the menu');
    if (!name.trim()) return toast.error('Menu name required');
    const { items: activeOnlyItems, stripped } = pruneItemsToActive(
      items,
      products
    );
    if (stripped > 0) {
      setItems(activeOnlyItems);
      toast.message(
        `Removed ${stripped} inactive product(s) from recipe lines before save`
      );
    }
    const filled = activeOnlyItems.filter(
      (it) =>
        Boolean(String(it.dish || '').trim()) ||
        (it.recipe_id != null && it.recipe_id > 0)
    );
    if (!filled.length) {
      return toast.error('Assign at least one recipe to a breakfast or lunch slot');
    }
    setSaving(true);
    try {
      const payload = {
        companyId,
        name: name.trim(),
        description: description || null,
        cycle_days: 5,
        items: filled,
        active: true,
        mandatory: true,
        meal_types: ['breakfast', 'lunch'],
      };
      const res = await fetch('/api/schools/menu', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId ? { ...payload, id: editingId } : payload
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(
        data.message || 'Weekly menu published — schools and SPs follow it live'
      );
      setEditingId(data.menu?.id ?? editingId);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!canEdit) return;
    if (!confirm('Delete this department menu?')) return;
    try {
      const res = await fetch(
        `/api/schools/menu?companyId=${companyId}&id=${id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Menu deleted');
      setEditingId(null);
      setItems(emptyTwoMealWeek());
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const newMenu = () => {
    if (!canEdit) return;
    setEditingId(null);
    setName('NSNP weekly menu');
    setDescription(
      'Breakfast + lunch Mon–Fri — schools and SPs must follow'
    );
    setItems(emptyTwoMealWeek());
  };

  const productLabel = (id: number) => {
    const p = products.find((x) => x.id === id);
    return p ? `${p.brand_name} · ${p.name}` : null;
  };

  const weekdayRecipes = recipes.filter(
    (r) => r.weekday != null && Number(r.weekday) >= 1 && Number(r.weekday) <= 5
  );

  return (
    <SchoolsPage>
      <SchoolsHeader
        title={canEdit ? 'Programme menu' : 'This week’s menu'}
        titleAccent="Assign recipes"
        description={
          canEdit
            ? 'Place each recipe on a weekday breakfast or lunch. Schools cook from this week; SPs supply those ingredients. Create recipes first, then assign them here.'
            : policy ||
              'Your department assigns a recipe to each breakfast and lunch. Follow this week and order the listed ingredients from your SP.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            {mandated || canEdit ? (
              <>
                <button
                  type="button"
                  disabled={pdfBusy || (!mandated && !editingId && !canEdit)}
                  onClick={() => {
                    if (!mandated && !editingId) {
                      toast.message('No published menu to print yet');
                      return;
                    }
                    setPdfBusy(true);
                    openMenuPdf({ download: true });
                    setTimeout(() => setPdfBusy(false), 800);
                  }}
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {pdfBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Download PDF
                </button>
                <button
                  type="button"
                  disabled={!mandated && !editingId}
                  onClick={() => openMenuPdf({ download: false })}
                  className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </>
            ) : null}
            {!canEdit ? (
              <Link
                href="/dashboard/schools/orders"
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <ShoppingCart className="w-3.5 h-3.5" /> Order ingredients
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {canEdit ? (
        <div className="mb-4 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm text-slate-700">
          <p className="font-bold text-slate-900">How the week is set</p>
          <ol className="mt-2 grid sm:grid-cols-3 gap-3 text-[13px] leading-snug">
            <li>
              <strong>1. Recipes.</strong> Each recipe is a meal BOM (category
              or product × qty per learner).{' '}
              <Link
                href="/dashboard/schools/recipes"
                className="font-bold text-[#0077b6] hover:underline"
              >
                Open recipes →
              </Link>
            </li>
            <li>
              <strong>2. Assign.</strong> Put a recipe on each breakfast and
              lunch cell. Suggested recipes match the weekday you set on the
              recipe.
            </li>
            <li>
              <strong>3. Publish.</strong> Schools and SPs follow this week
              live. Print it for the kitchen notice board.
            </li>
          </ol>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-950 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex gap-2 min-w-0 flex-1">
            <Landmark className="w-5 h-5 shrink-0 text-violet-700" />
            <div>
              <p className="font-black text-xs uppercase tracking-wide">
                Live from DBE
              </p>
              <p className="text-[13px] mt-0.5">
                {agencyName || 'Your department'} assigns a recipe to each
                meal. Print the week for the kitchen, then order those
                ingredients from your service provider.
              </p>
            </div>
          </div>
        </div>
      )}

      {!canEdit && adherence ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-amber-800/80">
              Menu adherence (this quarter)
            </p>
            <p className="text-2xl font-black tabular-nums text-slate-900">
              {adherence.pct}%
            </p>
            <p className="text-xs text-slate-600">
              {adherence.matched} of {adherence.total} serve days matched
              breakfast/lunch · prize pillar 15%
            </p>
          </div>
          <School className="w-8 h-8 text-amber-600 opacity-60" />
        </div>
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="space-y-4">
          {canEdit ? (
            <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 p-4 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="grid sm:grid-cols-2 gap-3 flex-1 min-w-[16rem]">
                  <label className="text-xs">
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Menu name
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="text-xs">
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Note for schools (optional)
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Term 2 — fortified staples only"
                    />
                  </label>
                </div>
                <p className="text-[11px] font-semibold text-slate-500">
                  {assignedCount}/10 slots assigned · {recipes.length} recipe
                  {recipes.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={fillEmptyFromRecipes}
                  disabled={!weekdayRecipes.length}
                  className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                  title="Fill empty cells with recipes that already have that weekday"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Fill empty from recipes
                </button>
                {menus.length > 0 && !editingId ? (
                  <span className="text-[11px] text-slate-500 self-center">
                    Editing a new week — save to publish
                  </span>
                ) : null}
                {editingId && menus.length > 1 ? (
                  <button
                    type="button"
                    onClick={newMenu}
                    className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> New week
                  </button>
                ) : null}
              </div>
            </div>
          ) : mandated ? (
            <div className="rounded-2xl border border-violet-100 bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-violet-700 flex items-center gap-1">
                <Landmark className="w-3 h-3" /> {agencyName || 'DBE'}
              </p>
              <p className="font-black text-sm mt-0.5">{mandated.name}</p>
              {mandated.description ? (
                <p className="text-[12px] text-slate-500 mt-0.5">
                  {mandated.description}
                </p>
              ) : null}
            </div>
          ) : null}

          {canEdit && recipes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-amber-300 bg-amber-50 px-6 py-10 text-center">
              <Utensils className="w-8 h-8 text-amber-700 mx-auto mb-2" />
              <p className="font-black text-slate-900">No recipes yet</p>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Create breakfast and lunch recipes first. Then come back here
                to place them on the week.
              </p>
              <Link
                href="/dashboard/schools/recipes"
                className="btn-primary !py-2 !px-4 text-sm mt-4 inline-flex items-center gap-1"
              >
                Create recipes →
              </Link>
            </div>
          ) : (
            <section className="rounded-3xl border border-sky-300 bg-white dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
              <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 bg-slate-50/80">
                <p className="text-sm font-black inline-flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-[#0077b6]" />
                  Weekly board
                </p>
                <div className="flex gap-3 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1 text-amber-800">
                    <Coffee className="w-3.5 h-3.5" /> Breakfast
                  </span>
                  <span className="inline-flex items-center gap-1 text-sky-800">
                    <Sun className="w-3.5 h-3.5" /> Lunch
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2 text-left w-28">Meal</th>
                      {SCHOOL_WEEK_DAYS.map((d) => (
                        <th key={d.day} className="px-2 py-2 text-center">
                          <span className="block text-slate-900 font-black text-xs">
                            {d.short}
                          </span>
                          <span className="normal-case tracking-normal font-semibold text-slate-400">
                            {d.label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['breakfast', 'lunch'] as MealTypeKey[]).map((meal) => {
                      const isB = meal === 'breakfast';
                      const meta = MEAL_TYPE_META[meal];
                      return (
                        <tr key={meal} className="border-t border-slate-100">
                          <td
                            className={`px-3 py-3 align-top font-black text-xs uppercase ${
                              isB ? 'text-amber-800' : 'text-sky-800'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {isB ? (
                                <Coffee className="w-4 h-4" />
                              ) : (
                                <Sun className="w-4 h-4" />
                              )}
                              {meta.label}
                            </span>
                          </td>
                          {SCHOOL_WEEK_DAYS.map((d) => {
                            const slot =
                              items.find(
                                (it) =>
                                  it.day === d.day && it.meal_type === meal
                              ) ||
                              dayGroups.find((g) => g.day === d.day)?.meals.find(
                                (m) => m.meal_type === meal
                              );
                            const recipeId = slot?.recipe_id
                              ? Number(slot.recipe_id)
                              : null;
                            const recipe =
                              recipeId && recipeById.has(recipeId)
                                ? recipeById.get(recipeId)!
                                : null;
                            const options = recipesForMeal(meal, d.day);
                            const filled = Boolean(
                              recipe || String(slot?.dish || '').trim()
                            );
                            return (
                              <td
                                key={`${d.day}-${meal}`}
                                className="p-2 align-top"
                              >
                                <div
                                  className={`rounded-2xl border min-h-[9.5rem] p-2.5 flex flex-col gap-2 ${
                                    filled
                                      ? isB
                                        ? 'border-amber-300 bg-amber-50/80'
                                        : 'border-sky-300 bg-sky-50/80'
                                      : 'border-dashed border-slate-200 bg-slate-50/50'
                                  }`}
                                >
                                  {canEdit ? (
                                    <div className="flex gap-1">
                                      <select
                                        className={`flex-1 min-w-0 rounded-xl border bg-white px-2 py-1.5 text-xs font-semibold ${
                                          filled
                                            ? isB
                                              ? 'border-amber-300'
                                              : 'border-sky-300'
                                            : 'border-slate-200'
                                        }`}
                                        value={recipeId ? String(recipeId) : ''}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          assignRecipe(
                                            d.day,
                                            meal,
                                            v ? Number(v) : null
                                          );
                                        }}
                                      >
                                        <option value="">
                                          {options.length
                                            ? 'Assign recipe…'
                                            : 'No recipes for this meal'}
                                        </option>
                                        {options.map((r) => (
                                          <option key={r.id} value={r.id}>
                                            {Number(r.weekday) === d.day
                                              ? '★ '
                                              : ''}
                                            {r.name}
                                          </option>
                                        ))}
                                      </select>
                                      {filled ? (
                                        <button
                                          type="button"
                                          className="rounded-xl border border-slate-200 bg-white px-2 text-slate-400 hover:text-rose-600 hover:border-rose-200"
                                          title="Clear slot"
                                          onClick={() =>
                                            assignRecipe(d.day, meal, null)
                                          }
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <p className="text-sm font-black text-slate-900 leading-snug">
                                      {recipe?.name || slot?.dish || '—'}
                                    </p>
                                  )}

                                  {recipe ? (
                                    <>
                                      {canEdit ? (
                                        <p className="text-[12px] font-bold text-slate-800 leading-snug">
                                          {recipe.name}
                                        </p>
                                      ) : null}
                                      <ul className="space-y-0.5">
                                        {(recipe.lines || []).slice(0, 4).map((l, i) => (
                                          <li
                                            key={i}
                                            className="text-[10px] text-slate-600 flex justify-between gap-2"
                                          >
                                            <span className="truncate">
                                              {prettyCat(
                                                l.category || l.product_name
                                              )}
                                            </span>
                                            <span className="tabular-nums font-semibold shrink-0">
                                              {l.qty_per_portion} {l.uom}
                                            </span>
                                          </li>
                                        ))}
                                        {(recipe.lines || []).length > 4 ? (
                                          <li className="text-[10px] text-slate-400">
                                            +{(recipe.lines || []).length - 4}{' '}
                                            more
                                          </li>
                                        ) : null}
                                      </ul>
                                      <p className="mt-auto text-[10px] font-semibold text-emerald-800 inline-flex items-center gap-1">
                                        <Check className="w-3 h-3" />
                                        {(recipe.lines || []).length} ingredient
                                        {(recipe.lines || []).length === 1
                                          ? ''
                                          : 's'}
                                      </p>
                                    </>
                                  ) : filled ? (
                                    <div className="space-y-1">
                                      {canEdit ? (
                                        <p className="text-[12px] font-bold text-slate-800">
                                          {slot?.dish}
                                        </p>
                                      ) : null}
                                      <ul className="text-[10px] text-slate-600 space-y-0.5">
                                        {(slot?.approved_product_ids || [])
                                          .map((id) => productLabel(id))
                                          .filter(Boolean)
                                          .slice(0, 4)
                                          .map((label, i) => (
                                            <li key={i}>· {label}</li>
                                          ))}
                                      </ul>
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-slate-400 mt-auto">
                                      {canEdit
                                        ? 'Empty — assign a recipe'
                                        : 'No recipe this slot'}
                                    </p>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {canEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || recipes.length === 0}
                className="btn-primary !py-3 !px-5 text-sm inline-flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingId
                  ? 'Publish menu (live to schools & SPs)'
                  : 'Publish this week'}
              </button>
              <p className="text-[12px] text-slate-500">
                {assignedCount === 10
                  ? 'All 10 slots filled.'
                  : `${10 - assignedCount} slot${10 - assignedCount === 1 ? '' : 's'} still empty — you can publish a partial week.`}
              </p>
            </div>
          ) : !mandated ? (
            <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
              Department has not published a weekly menu yet.
            </p>
          ) : null}

          {canEdit && menus.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">
                Published menus
              </p>
              <ul className="flex flex-wrap gap-2">
                {menus.map((m) => (
                  <li key={m.id}>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        editingId === m.id
                          ? 'border-[#00b4d8] bg-sky-50 text-sky-950'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => loadMenuIntoEditor(m, products)}
                      >
                        {m.name}
                        {m.active ? (
                          <span className="ml-1 text-[9px] font-black uppercase text-emerald-700">
                            Live
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(m.id)}
                        className="text-rose-600"
                        aria-label={`Delete ${m.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </SchoolsPage>
  );
}
