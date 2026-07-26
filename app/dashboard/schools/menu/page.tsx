'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Utensils,
  Landmark,
  School,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

const DAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 7, label: 'Sun' },
];

type MenuItem = {
  day: number;
  meal_type: string;
  dish: string;
  approved_product_ids?: number[];
};

type Menu = {
  id: number;
  name: string;
  cycle_days?: number;
  items?: MenuItem[];
  active?: boolean;
  description?: string | null;
  is_agency_menu?: boolean;
  agency_name?: string | null;
};

type Product = { id: number; name: string; brand_name: string };

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
  const [role, setRole] = useState<string>('school');
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
  const [name, setName] = useState('NSNP weekly menu');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<MenuItem[]>(
    DAYS.slice(0, 5).map((d) => ({
      day: d.day,
      meal_type: 'lunch',
      dish: '',
      approved_product_ids: [],
    }))
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([
        fetch(`/api/schools/menu?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/approved?companyId=${companyId}`, {
          cache: 'no-store',
        }),
      ]);
      const m = await mRes.json();
      const p = await pRes.json();
      if (!mRes.ok) throw new Error(m.error || 'Failed');
      setCanEdit(Boolean(m.canEdit));
      setRole(String(m.role || 'school'));
      setMenus(m.menus || []);
      setMandated(m.mandated || null);
      setAdherence(m.adherence || null);
      setAgencyName(m.agencyName || m.mandated?.agency_name || null);
      setPolicy(String(m.policy || ''));
      setProducts(p.products || []);
      if (m.warning) toast.message(m.warning);
      // Prefill editor with active mandated for agency
      if (m.canEdit && m.mandated) {
        loadMenuIntoEditor(m.mandated as Menu);
      } else if (!m.canEdit && m.mandated) {
        loadMenuIntoEditor(m.mandated as Menu);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMenuIntoEditor = (m: Menu) => {
    setEditingId(m.id);
    setName(m.name);
    setDescription(m.description || '');
    const base = DAYS.slice(0, m.cycle_days || 5).map((d) => {
      const found = (m.items || []).find((it) => Number(it.day) === d.day);
      return {
        day: d.day,
        meal_type: found?.meal_type || 'lunch',
        dish: found?.dish || '',
        approved_product_ids: found?.approved_product_ids || [],
      };
    });
    setItems(base.length ? base : items);
  };

  const setItem = (day: number, patch: Partial<MenuItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.day === day ? { ...it, ...patch } : it))
    );
  };

  const toggleProduct = (day: number, productId: number) => {
    if (!canEdit) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.day !== day) return it;
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
    setSaving(true);
    try {
      const payload = {
        companyId,
        name: name.trim(),
        description: description || null,
        cycle_days: items.length,
        items: items.filter((it) => it.dish.trim()),
        active: true,
        mandatory: true,
        meal_types: ['lunch'],
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
          (editingId
            ? 'Menu updated — schools & SPs see it live'
            : 'Menu published — schools & SPs must follow')
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
    if (!confirm('Delete this department menu cycle?')) return;
    try {
      const res = await fetch(
        `/api/schools/menu?companyId=${companyId}&id=${id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Menu deleted');
      setEditingId(null);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const newMenu = () => {
    if (!canEdit) return;
    setEditingId(null);
    setName('NSNP weekly menu');
    setDescription('');
    setItems(
      DAYS.slice(0, 5).map((d) => ({
        day: d.day,
        meal_type: 'lunch',
        dish: '',
        approved_product_ids: [],
      }))
    );
  };

  const productLabel = (id: number) => {
    const p = products.find((x) => x.id === id);
    return p ? `${p.brand_name} · ${p.name}` : `Product ${id}`;
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title={canEdit ? 'Department menu' : 'Programme menu'}
        titleAccent={
          canEdit
            ? 'DBE / DoH sets'
            : agencyName || 'Follow department'
        }
        description={
          canEdit
            ? 'Set the weekly cycle schools and SPs must follow. Link dishes to approved products. Schools are rated on % menu adherence.'
            : policy ||
              'Your department sets this menu. Log the dish on serve day to score adherence.'
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
              {adherence.matched} of {adherence.total} serve days matched the
              department menu · feeds prize score (15%)
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
                  <Landmark className="w-3 h-3" /> Department menu
                </p>
                <p className="font-black text-sm mt-1">{mandated.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {agencyName || 'DBE'} ·{' '}
                  {(mandated.items || []).length} dishes · mandatory
                </p>
                {mandated.description ? (
                  <p className="text-xs text-slate-600 mt-2">
                    {mandated.description}
                  </p>
                ) : null}
              </div>
            ) : null}

            {canEdit ? (
              <>
                <h3 className="text-xs font-bold uppercase text-slate-400">
                  Published menus
                </h3>
                {menus.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No department menu yet — create the weekly cycle schools
                    must follow.
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
                          onClick={() => loadMenuIntoEditor(m)}
                        >
                          <span className="font-semibold">{m.name}</span>
                          {m.active ? (
                            <span className="ml-2 text-[9px] font-bold uppercase text-emerald-700">
                              Active
                            </span>
                          ) : null}
                          <span className="block text-[10px] text-slate-400">
                            {(m.items || []).length} dishes
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
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">
                  How adherence is scored
                </h3>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                  <li>
                    On serve day, log the dish name from this menu (or issue
                    the linked approved products).
                  </li>
                  <li>
                    Each weekday is checked against Mon–Fri dishes set by{' '}
                    {agencyName || 'the department'}.
                  </li>
                  <li>
                    Adherence is 15% of the headmaster prize scorecard.
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-sm font-black">
              <Utensils className="w-4 h-4 text-[#00b4d8]" />
              {canEdit
                ? editingId
                  ? `Edit department menu #${editingId}`
                  : 'Publish department menu'
                : mandated
                  ? mandated.name
                  : 'No menu published yet'}
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
                    Description
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Term 2 winter cycle — mandatory"
                  />
                </label>
              </div>
            ) : null}

            <div className="space-y-3">
              {items.map((it) => {
                const dayLabel =
                  DAYS.find((d) => d.day === it.day)?.label || `D${it.day}`;
                return (
                  <div
                    key={it.day}
                    className="rounded-2xl border border-slate-100 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-black w-10 text-slate-500">
                        {dayLabel}
                      </span>
                      {canEdit ? (
                        <input
                          className="flex-1 min-w-[10rem] rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
                          value={it.dish}
                          onChange={(e) =>
                            setItem(it.day, { dish: e.target.value })
                          }
                          placeholder="Dish name (e.g. Samp & beans)"
                        />
                      ) : (
                        <span className="font-semibold text-sm">
                          {it.dish || '—'}
                        </span>
                      )}
                    </div>
                    {(canEdit || (it.approved_product_ids || []).length > 0) && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Approved products for this dish
                        </p>
                        {canEdit ? (
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                            {products.length === 0 ? (
                              <span className="text-[11px] text-slate-400">
                                Add products on the approved foods catalogue
                                first.
                              </span>
                            ) : (
                              products.map((p) => {
                                const on = (it.approved_product_ids || []).includes(
                                  p.id
                                );
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => toggleProduct(it.day, p.id)}
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                      on
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                                        : 'border-slate-200 text-slate-500'
                                    }`}
                                  >
                                    {p.brand_name} · {p.name}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        ) : (
                          <ul className="text-xs text-slate-600 space-y-0.5">
                            {(it.approved_product_ids || []).map((id) => (
                              <li key={id}>· {productLabel(id)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                {editingId ? 'Update & publish live' : 'Publish for schools & SPs'}
              </button>
            ) : !mandated ? (
              <p className="text-sm text-slate-500">
                Your department has not published a menu yet. Ask DBE/DoH to
                set it under Schools → Menu.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
