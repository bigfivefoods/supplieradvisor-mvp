'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Utensils,
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
  const [menus, setMenus] = useState<Menu[]>([]);
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
      setMenus(m.menus || []);
      setProducts(p.products || []);
      if (m.warning) toast.message(m.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setItem = (day: number, patch: Partial<MenuItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.day === day ? { ...it, ...patch } : it))
    );
  };

  const toggleProduct = (day: number, productId: number) => {
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

  const loadMenu = (m: Menu) => {
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

  const save = async () => {
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
      toast.success(editingId ? 'Menu updated' : 'Menu created');
      setEditingId(data.menu?.id ?? editingId);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this menu cycle?')) return;
    try {
      const res = await fetch(
        `/api/schools/menu?companyId=${companyId}&id=${id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Menu deleted');
      if (editingId === id) {
        setEditingId(null);
        setName('NSNP weekly menu');
        setItems(
          DAYS.slice(0, 5).map((d) => ({
            day: d.day,
            meal_type: 'lunch',
            dish: '',
            approved_product_ids: [],
          }))
        );
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const newMenu = () => {
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

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="School menu"
        titleAccent="NSNP cycle"
        description="Plan weekly meals. Link dishes to approved products so kitchen orders stay on the strict brand list."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={newMenu}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>
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

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-1">
            <h3 className="text-xs font-bold uppercase text-slate-400 mb-3">
              Saved menus
            </h3>
            {menus.length === 0 ? (
              <p className="text-sm text-slate-500">No menus yet.</p>
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
                      onClick={() => loadMenu(m)}
                    >
                      <span className="font-semibold">{m.name}</span>
                      {m.active ? (
                        <span className="ml-2 text-[9px] font-bold uppercase text-emerald-700">
                          Active
                        </span>
                      ) : null}
                      <span className="block text-[10px] text-slate-400">
                        {(m.items || []).length} dishes ·{' '}
                        {m.cycle_days || 7} days
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
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-sm font-black">
              <Utensils className="w-4 h-4 text-[#00b4d8]" />
              {editingId ? `Edit menu #${editingId}` : 'Create menu cycle'}
            </div>
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
                  placeholder="e.g. Term 2 winter cycle"
                />
              </label>
            </div>

            <div className="space-y-3">
              {items.map((it) => {
                const dayLabel =
                  DAYS.find((d) => d.day === it.day)?.label || `Day ${it.day}`;
                return (
                  <div
                    key={it.day}
                    className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3"
                  >
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      <span className="text-xs font-black w-10">
                        {dayLabel}
                      </span>
                      <select
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        value={it.meal_type}
                        onChange={(e) =>
                          setItem(it.day, { meal_type: e.target.value })
                        }
                      >
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="snack">Snack</option>
                      </select>
                      <input
                        className="flex-1 min-w-[12rem] rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        placeholder="Dish name e.g. Pap & sugar beans"
                        value={it.dish}
                        onChange={(e) =>
                          setItem(it.day, { dish: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[9px] font-bold uppercase text-slate-400 w-full">
                        Approved products used
                      </span>
                      {products.slice(0, 24).map((p) => {
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
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                : 'border-slate-200 bg-white text-slate-500'
                            }`}
                          >
                            {p.brand_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

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
              Save as active menu
            </button>
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
