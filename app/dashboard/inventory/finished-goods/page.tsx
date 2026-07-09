'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Box, QrCode } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney, type ProductRecord } from '@/lib/inventory/types';
import { CompanyRequired, InventoryHeader } from '@/components/inventory/InventoryShell';

export default function FinishedGoodsPage() {
  return (
    <CompanyRequired>
      <FinishedGoodsInner />
    </CompanyRequired>
  );
}

function FinishedGoodsInner() {
  const companyId = getSelectedCompanyId()!;
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/inventory/products?companyId=${companyId}&type=finished_good`
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
        title="Finished goods"
        description="Sellable catalogue products from Supabase (product_type = finished_good)."
        action={
          <Link href="/dashboard/inventory/products" className="btn-primary !py-2.5 !px-5 text-sm">
            <QrCode className="w-4 h-4" /> Products &amp; QR
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
            <Box className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
            <p className="mb-4">No finished goods yet. Create products as “Finished good”.</p>
            <Link href="/dashboard/inventory/products" className="btn-primary !py-2.5 !px-5 text-sm">
              Add product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b text-left">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold text-right">Sell</th>
                  <th className="px-4 py-3 font-semibold text-right">On hand</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3 font-semibold">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.sku || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(p.sell_price, p.base_currency || 'ZAR')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {Number(p.qty_on_hand ?? 0)} {p.uom || ''}
                    </td>
                    <td className="px-4 py-3 capitalize text-xs">{p.status || 'active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
