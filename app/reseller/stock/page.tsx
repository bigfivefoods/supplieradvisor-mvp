'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Package } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId, extractEmailFromPrivyUser } from '@/lib/auth/identity';

type Inv = {
  id: number;
  product_name: string;
  sku?: string | null;
  qty_on_hand: number;
  unit?: string | null;
  unit_sell_price?: number | null;
  container_id?: number | null;
};

export default function ResellerStockPage() {
  const { user } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Inv[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reseller/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyUserId: getCanonicalUserId(user.id),
          email: extractEmailFromPrivyUser(user),
        }),
      });
      const data = await res.json();
      setItems(data.inventory || []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-1">My stock</h1>
      <p className="text-sm text-slate-500 mb-6">
        Drawn from container outlets by your network operator.
      </p>

      {items.length === 0 ? (
        <div className="rounded-3xl border bg-white p-10 text-center text-slate-500">
          <Package className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          No stock yet. Ask the operator to transfer inventory to you.
        </div>
      ) : (
        <div className="rounded-3xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-400">
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-right px-4 py-3">On hand</th>
                <th className="text-right px-4 py-3">Sell price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">
                    {i.product_name}
                    {i.sku && (
                      <div className="text-[11px] font-mono text-slate-400">
                        {i.sku}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">
                    {i.qty_on_hand} {i.unit}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {i.unit_sell_price
                      ? `R${Number(i.unit_sell_price).toLocaleString('en-ZA')}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
