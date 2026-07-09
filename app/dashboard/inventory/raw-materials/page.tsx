'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Package, Pencil } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney, type ProductRecord } from '@/lib/inventory/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

export default function RawMaterialsPage() {
  return (
    <CompanyRequired>
      <RawMaterialsInner />
    </CompanyRequired>
  );
}

function RawMaterialsInner() {
  const companyId = getSelectedCompanyId()!;
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/inventory/products?companyId=${companyId}&type=raw_material`
    );
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <InventoryHeader
        title="Raw materials"
        description="Live from Supabase products where type = raw_material, with stock from stock_levels."
        action={
          <Link href="/dashboard/inventory/products" className="btn-primary !py-2.5 !px-5 text-sm">
            Manage products
          </Link>
        }
      />

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center text-neutral-500">
            <Package className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
            <p className="mb-4">No raw materials yet. Create a product with type “Raw material”.</p>
            <Link href="/dashboard/inventory/products" className="btn-primary !py-2.5 !px-5 text-sm">
              Add product
            </Link>
          </div>
        ) : (
          <ul className="divide-y">
            {products.map((p) => (
              <li key={p.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{p.name}</div>
                  <div className="text-xs text-neutral-500 font-mono">
                    {p.sku || '—'} · {p.category || 'General'}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <div className="font-bold">{Number(p.qty_on_hand ?? 0)} {p.uom || ''}</div>
                    <div className="text-xs text-neutral-500">
                      {formatMoney(p.cost_price, p.base_currency || 'ZAR')} cost
                    </div>
                  </div>
                  <Link
                    href="/dashboard/inventory/products"
                    className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-600"
                    title="Edit in products"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
