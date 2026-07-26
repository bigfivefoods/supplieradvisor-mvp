'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
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
  category: string;
  pack_size?: string | null;
  uom?: string | null;
  protein_g?: number | null;
  energy_kcal?: number | null;
  active?: boolean;
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
  const [categories, setCategories] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      const res = await fetch(`/api/schools/approved?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setProducts(data.products || []);
      setCategories(data.categories || []);
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, q, category]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="NSNP approved list"
        titleAccent="Strict"
        description="Only these brands/products may be ordered and received into school kitchens. Non-approved GRNs are rejected."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950 flex gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>Strict mode.</strong> Headmaster prize scores reward 100%
          approved-brand spend. ISPs may only deliver products on this list.
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
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
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">Product</th>
                <th className="px-3 py-3">Brand</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Pack</th>
                <th className="px-3 py-3">Nutrition</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No approved products — run migration to seed the catalogue.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-sky-50/30">
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
                      {p.protein_g != null ? ` · ${p.protein_g}g protein` : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </SchoolsPage>
  );
}
