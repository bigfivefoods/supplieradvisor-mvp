'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Utensils,
  Landmark,
  School,
  Coffee,
  Sun,
  ShoppingCart,
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
  productsForMealHint,
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
};

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
  const [name, setName] = useState('NSNP 2-meal weekly cycle');
  const [description, setDescription] = useState(
    'Breakfast + lunch Mon–Fri — schools and SPs must follow'
  );
  const [items, setItems] = useState<DayMealSlot[]>(() => emptyTwoMealWeek());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [productFilter, setProductFilter] = useState('');

  /** Only active catalogue products may appear on the menu */
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
          `${stripped} inactive / off-list product(s) hidden — they cannot appear on the menu`
        );
      }
    },
    [pruneItemsToActive]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([
        fetch(`/api/schools/menu?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        // activeOnly defaults true — only active catalogue for menu chips
        fetch(`/api/schools/approved?companyId=${companyId}`, {
          cache: 'no-store',
        }),
      ]);
      const m = await mRes.json();
      const p = await pRes.json();
      if (!mRes.ok) throw new Error(m.error || 'Failed');
      const activeProducts = (p.products || []) as Product[];
      setCanEdit(Boolean(m.canEdit));
      setMenus(m.menus || []);
      setMandated(m.mandated || null);
      setAdherence(m.adherence || null);
      setAgencyName(m.agencyName || m.mandated?.agency_name || null);
      setPolicy(String(m.policy || ''));
      setProducts(activeProducts);
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

  const setSlot = (
    day: number,
    meal: MealTypeKey,
    patch: Partial<DayMealSlot>
  ) => {
    setItems((prev) =>
      prev.map((it) =>
        it.day === day && it.meal_type === meal ? { ...it, ...patch } : it
      )
    );
  };

  const toggleProduct = (
    day: number,
    meal: MealTypeKey,
    productId: number
  ) => {
    if (!canEdit) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.day !== day || it.meal_type !== meal) return it;
        const ids = new Set(it.approved_product_ids || []);
        if (ids.has(productId)) ids.delete(productId);
        else ids.add(productId);
        return { ...it, approved_product_ids: [...ids] };
      })
    );
  };

  const save = async () => {
    if (!canEdit) return toast.error('Only the department can set the menu');
    if (!name.trim()) return toast.error('Menu name required');
    // Never send inactive products — catalogue chips are active-only
    const { items: activeOnlyItems, stripped } = pruneItemsToActive(
      items,
      products
    );
    if (stripped > 0) {
      setItems(activeOnlyItems);
      toast.message(
        `Removed ${stripped} inactive product(s) before save — they cannot appear on the menu`
      );
    }
    const filled = activeOnlyItems.filter((it) => it.dish.trim());
    if (!filled.length) {
      return toast.error('Add at least one breakfast or lunch dish');
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
        data.message ||
          '2-meal menu published — schools & SPs follow breakfast + lunch'
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
    setName('NSNP 2-meal weekly cycle');
    setDescription(
      'Breakfast + lunch Mon–Fri — schools and SPs must follow'
    );
    setItems(emptyTwoMealWeek());
  };

  const productLabel = (id: number) => {
    const p = products.find((x) => x.id === id);
    // Never invent labels for inactive/off-list ids — they should already be pruned
    return p ? `${p.brand_name} · ${p.name}` : null;
  };

  const pf = productFilter.trim().toLowerCase();

  return (
    <SchoolsPage>
      <SchoolsHeader
        title={canEdit ? 'Department menu' : 'Programme menu'}
        titleAccent="Breakfast + lunch"
        description={
          canEdit
            ? 'DBE sets breakfast + lunch Mon–Fri from the approved product catalogue only. Schools inherit this menu live; SPs supply those foods from wholesalers.'
            : policy ||
              'Your DBE sets breakfast and lunch from the approved catalogue. This menu filters down to your school — order those products from your SP.'
        }
        action={
          <div className="flex gap-2">
            {canEdit ? (
              <button
                type="button"
                onClick={newMenu}
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            ) : (
              <Link
                href="/dashboard/schools/orders"
                className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <ShoppingCart className="w-3.5 h-3.5" /> Order menu products
              </Link>
            )}
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

      {!canEdit ? (
        <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-950 flex gap-2">
          <Landmark className="w-5 h-5 shrink-0 text-violet-700" />
          <div>
            <p className="font-black text-xs uppercase tracking-wide">
              Live from DBE · catalogue products only
            </p>
            <p className="text-[13px] mt-0.5">
              {agencyName || 'Your department'} publishes this menu from the
              approved foods catalogue. You cannot change it here — order the
              listed products from your service provider; they source from
              wholesalers and deliver to school.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950 flex gap-2">
          <Landmark className="w-5 h-5 shrink-0 text-sky-700" />
          <div>
            <p className="font-black text-xs uppercase tracking-wide">
              DBE sets the programme menu
            </p>
            <p className="text-[13px] mt-0.5">
              Select dishes and approved catalogue products for breakfast +
              lunch. Associated schools inherit this menu live and are scored on
              adherence; SPs supply those products from wholesalers.
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mb-4 grid sm:grid-cols-2 gap-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 flex gap-2 text-sm">
          <Coffee className="w-5 h-5 text-amber-700 shrink-0" />
          <div>
            <p className="font-black text-amber-950 text-xs uppercase">
              Breakfast
            </p>
            <p className="text-[12px] text-amber-900/80">
              {MEAL_TYPE_META.breakfast.hint}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 flex gap-2 text-sm">
          <Sun className="w-5 h-5 text-sky-700 shrink-0" />
          <div>
            <p className="font-black text-sky-950 text-xs uppercase">Lunch</p>
            <p className="text-[12px] text-sky-900/80">
              {MEAL_TYPE_META.lunch.hint}
            </p>
          </div>
        </div>
      </div>

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
              breakfast/lunch guide · prize pillar 15%
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
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-1 space-y-4">
            {!canEdit && mandated ? (
              <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-3">
                <p className="text-[10px] font-bold uppercase text-violet-700 flex items-center gap-1">
                  <Landmark className="w-3 h-3" /> Department 2-meal guide
                </p>
                <p className="font-black text-sm mt-1">{mandated.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {agencyName || 'DBE'} · breakfast + lunch · mandatory
                </p>
              </div>
            ) : null}

            {canEdit ? (
              <>
                <h3 className="text-xs font-bold uppercase text-slate-400">
                  Published menus
                </h3>
                {menus.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Create the breakfast + lunch week schools and SPs must
                    follow.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {menus.map((m) => (
                      <li
                        key={m.id}
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          editingId === m.id
                            ? 'border-[#00b4d8] bg-sky-50'
                            : 'border-slate-100'
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => loadMenuIntoEditor(m, products)}
                        >
                          <span className="font-semibold">{m.name}</span>
                          {m.active ? (
                            <span className="ml-2 text-[9px] font-bold uppercase text-emerald-700">
                              Active
                            </span>
                          ) : null}
                          <span className="block text-[10px] text-slate-400">
                            {(m.items || []).filter((i) => i.meal_type === 'breakfast').length}{' '}
                            breakfast ·{' '}
                            {(m.items || []).filter((i) => i.meal_type !== 'breakfast').length}{' '}
                            lunch slots
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(m.id)}
                          className="mt-1 text-[10px] font-bold text-rose-600 inline-flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="text-xs text-slate-600 space-y-2">
                <p className="font-bold text-slate-800">Daily feeding guide</p>
                <p>
                  Serve <strong>breakfast</strong> and <strong>lunch</strong>{' '}
                  using only the approved products listed for each meal. SPs
                  should supply those products for the week.
                </p>
                <p>
                  Log the dish on serve day to score menu adherence for prizes.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-sm font-black">
              <Utensils className="w-4 h-4 text-[#00b4d8]" />
              {canEdit
                ? editingId
                  ? `Edit 2-meal menu #${editingId}`
                  : 'Publish 2-meal weekly guide'
                : mandated?.name || 'No menu published'}
            </div>

            {canEdit ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs sm:col-span-2">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Menu name
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Guideline note
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Term 2 — 2 meals/day, fortified staples only"
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Filter products
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    placeholder="Search catalogue…"
                  />
                </label>
              </div>
            ) : null}

            {/* Week grid: each day = breakfast + lunch */}
            <div className="space-y-4">
              {dayGroups.map((dg) => (
                <div
                  key={dg.day}
                  className="rounded-2xl border border-slate-200 overflow-hidden"
                >
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-black uppercase text-slate-600">
                    {dg.label}
                  </div>
                  <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                    {dg.meals.map((slot) => {
                      const meta = MEAL_TYPE_META[slot.meal_type];
                      const isB = slot.meal_type === 'breakfast';
                      let mealProducts = productsForMealHint(
                        products,
                        slot.meal_type
                      ) as Product[];
                      if (pf) {
                        mealProducts = mealProducts.filter((p) =>
                          `${p.brand_name} ${p.name} ${p.category || ''}`
                            .toLowerCase()
                            .includes(pf)
                        );
                      }
                      return (
                        <div
                          key={`${slot.day}-${slot.meal_type}`}
                          className={`p-3 space-y-2 ${
                            isB ? 'bg-amber-50/30' : 'bg-sky-50/30'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {isB ? (
                              <Coffee className="w-3.5 h-3.5 text-amber-700" />
                            ) : (
                              <Sun className="w-3.5 h-3.5 text-sky-700" />
                            )}
                            <span
                              className={`text-[10px] font-black uppercase ${
                                isB ? 'text-amber-800' : 'text-sky-800'
                              }`}
                            >
                              {meta.label}
                            </span>
                          </div>
                          {canEdit ? (
                            <input
                              className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm bg-white"
                              value={slot.dish}
                              onChange={(e) =>
                                setSlot(slot.day, slot.meal_type, {
                                  dish: e.target.value,
                                })
                              }
                              placeholder={
                                isB
                                  ? 'e.g. Fortified maize porridge'
                                  : 'e.g. Samp & beans with veg'
                              }
                            />
                          ) : (
                            <p className="font-semibold text-sm text-slate-900">
                              {slot.dish || '—'}
                            </p>
                          )}
                          <div>
                            <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">
                              {canEdit
                                ? 'Select approved products'
                                : 'Approved products to use'}
                            </p>
                            {canEdit ? (
                              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                                {mealProducts.length === 0 ? (
                                  <span className="text-[11px] text-slate-400">
                                    No products in catalogue yet.
                                  </span>
                                ) : (
                                  mealProducts.map((p) => {
                                    const on = (
                                      slot.approved_product_ids || []
                                    ).includes(p.id);
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() =>
                                          toggleProduct(
                                            slot.day,
                                            slot.meal_type,
                                            p.id
                                          )
                                        }
                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                          on
                                            ? isB
                                              ? 'border-amber-500 bg-amber-100 text-amber-950'
                                              : 'border-sky-500 bg-sky-100 text-sky-950'
                                            : 'border-slate-200 text-slate-500 bg-white'
                                        }`}
                                        title={p.category || ''}
                                      >
                                        {p.brand_name} · {p.name}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            ) : (
                              <ul className="text-xs text-slate-700 space-y-0.5">
                                {(() => {
                                  const labels = (
                                    slot.approved_product_ids || []
                                  )
                                    .map((id) => productLabel(id))
                                    .filter(Boolean) as string[];
                                  if (!labels.length) {
                                    return (
                                      <li className="text-slate-400">
                                        No products linked
                                      </li>
                                    );
                                  }
                                  return labels.map((label, i) => (
                                    <li key={i}>· {label}</li>
                                  ));
                                })()}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {canEdit ? (
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingId
                  ? 'Update 2-meal guide (live)'
                  : 'Publish breakfast + lunch for schools & SPs'}
              </button>
            ) : !mandated ? (
              <p className="text-sm text-slate-500">
                Department has not published a 2-meal menu yet.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
