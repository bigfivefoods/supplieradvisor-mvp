'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId, extractEmailFromPrivyUser } from '@/lib/auth/identity';

type Inv = {
  id: number;
  product_name: string;
  product_id?: number | null;
  sku?: string | null;
  qty_on_hand: number;
  unit?: string | null;
  unit_sell_price?: number | null;
  unit_cost?: number | null;
};

export default function ResellerSellPage() {
  const { user } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resellerId, setResellerId] = useState<number | null>(null);
  const [items, setItems] = useState<Inv[]>([]);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [price, setPrice] = useState<Record<number, string>>({});
  const [payment, setPayment] = useState('cash');

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
      const r = data.resellers?.[0];
      setResellerId(r?.id ?? null);
      const inv: Inv[] = data.inventory || [];
      setItems(inv);
      const p: Record<number, string> = {};
      for (const i of inv) {
        p[i.id] = String(i.unit_sell_price || i.unit_cost || '');
      }
      setPrice(p);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!user || !resellerId) return;
    const lines = items
      .map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        sku: i.sku,
        quantity: Number(qty[i.id] || 0),
        unit_price: Number(price[i.id] || 0),
        unit: i.unit,
      }))
      .filter((l) => l.quantity > 0 && l.unit_price > 0);

    if (!lines.length) {
      toast.error('Enter qty and price for at least one product');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/containers/resellers/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resellerId,
          portal: true,
          privyUserId: getCanonicalUserId(user.id),
          email: extractEmailFromPrivyUser(user),
          payment_method: payment,
          lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sale failed');
      toast.success(data.message || 'Sale recorded', {
        description: 'Capture customer feedback while it is fresh → Feedback tab',
        duration: 5000,
      });
      setQty({});
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Sale failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (!resellerId) {
    return (
      <p className="text-sm text-slate-500">
        No reseller profile linked. Open your invite link first.
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-1 flex items-center gap-2">
        <ShoppingCart className="w-6 h-6 text-[#00b4d8]" /> Record sale
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Commission is calculated per item from network rates (percent or fixed R
        per unit).
      </p>

      {items.length === 0 ? (
        <div className="rounded-3xl border bg-white p-10 text-center text-slate-500">
          No stock to sell. Wait for a transfer from the container.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-3xl border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-400">
                  <th className="text-left px-3 py-2">Product</th>
                  <th className="text-right px-3 py-2">Avail</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Unit R</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2 font-semibold">{i.product_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {i.qty_on_hand}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={Number(i.qty_on_hand)}
                        className="input !p-1.5 !text-sm !w-20 text-right"
                        value={qty[i.id] || ''}
                        onChange={(e) =>
                          setQty((q) => ({ ...q, [i.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input !p-1.5 !text-sm !w-24 text-right"
                        value={price[i.id] || ''}
                        onChange={(e) =>
                          setPrice((p) => ({ ...p, [i.id]: e.target.value }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="eft">EFT</option>
            <option value="other">Other</option>
          </select>

          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="w-full btn-primary !py-3 text-sm font-bold"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              'Complete sale'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
