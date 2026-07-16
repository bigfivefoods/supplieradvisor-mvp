'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShoppingCart, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId, extractEmailFromPrivyUser } from '@/lib/auth/identity';
import {
  clearOfflineDraft,
  isBrowserOnline,
  loadOfflineDraft,
  saveOfflineDraft,
} from '@/lib/pwa/offline-draft';

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

type SaleDraft = {
  qty: Record<number, string>;
  price: Record<number, string>;
  payment: string;
  lines?: Array<{
    product_id?: number | null;
    product_name: string;
    sku?: string | null;
    quantity: number;
    unit_price: number;
    unit?: string | null;
  }>;
};

const DRAFT_KEY = 'reseller_sale_draft';
const STOCK_KEY = 'reseller_stock_snapshot';

export default function ResellerSellPage() {
  const { user } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resellerId, setResellerId] = useState<number | null>(null);
  const [items, setItems] = useState<Inv[]>([]);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [price, setPrice] = useState<Record<number, string>>({});
  const [payment, setPayment] = useState('cash');
  const [online, setOnline] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    setOnline(isBrowserOnline());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (!isBrowserOnline()) {
        const stock = loadOfflineDraft<{ items: Inv[] }>(STOCK_KEY);
        if (stock?.value?.items) setItems(stock.value.items);
        const draft = loadOfflineDraft<SaleDraft>(DRAFT_KEY);
        if (draft?.value) {
          setQty(draft.value.qty || {});
          setPrice(draft.value.price || {});
          setPayment(draft.value.payment || 'cash');
          setHasDraft(true);
        }
        return;
      }

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
      saveOfflineDraft(STOCK_KEY, { items: inv, savedAt: Date.now() });

      const p: Record<number, string> = {};
      for (const i of inv) {
        p[i.id] = String(i.unit_sell_price || i.unit_cost || '');
      }
      // Prefer restored draft prices/qty if present
      const draft = loadOfflineDraft<SaleDraft>(DRAFT_KEY);
      if (draft?.value) {
        setQty(draft.value.qty || {});
        setPrice({ ...p, ...(draft.value.price || {}) });
        setPayment(draft.value.payment || 'cash');
        setHasDraft(true);
        toast.message('Restored offline sale draft');
      } else {
        setPrice(p);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Persist draft as user types (field-safe)
  useEffect(() => {
    if (!items.length) return;
    const hasQty = Object.values(qty).some((v) => Number(v) > 0);
    if (!hasQty) return;
    saveOfflineDraft(DRAFT_KEY, { qty, price, payment });
    setHasDraft(true);
  }, [qty, price, payment, items.length]);

  const buildLines = () =>
    items
      .map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        sku: i.sku,
        quantity: Number(qty[i.id] || 0),
        unit_price: Number(price[i.id] || 0),
        unit: i.unit,
      }))
      .filter((l) => l.quantity > 0 && l.unit_price > 0);

  const submit = async () => {
    if (!user || !resellerId) return;
    const lines = buildLines();

    if (!lines.length) {
      toast.error('Enter qty and price for at least one product');
      return;
    }

    if (!isBrowserOnline()) {
      saveOfflineDraft(DRAFT_KEY, { qty, price, payment, lines });
      setHasDraft(true);
      toast.message('Sale saved offline', {
        description: 'Submit again when you are back online to sync commission.',
      });
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
      clearOfflineDraft(DRAFT_KEY);
      setHasDraft(false);
      void load();
    } catch (e: unknown) {
      if (!isBrowserOnline() || e instanceof TypeError) {
        saveOfflineDraft(DRAFT_KEY, { qty, price, payment, lines });
        setHasDraft(true);
        toast.message('Saved offline', {
          description: 'Could not reach server. Retry Submit when online.',
        });
      } else {
        toast.error(e instanceof Error ? e.message : 'Sale failed');
      }
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

  if (!resellerId && online) {
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
      <p className="text-sm text-slate-500 mb-4">
        Commission is calculated per item from network rates (percent or fixed R
        per unit).
      </p>

      {(!online || hasDraft) && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm flex items-start gap-2 ${
            online
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-slate-300 bg-slate-100 text-slate-800'
          }`}
        >
          <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            {!online ? (
              <>
                <strong>Offline</strong> — enter the sale now; it stays on this device
                until you submit online.
              </>
            ) : (
              <>
                <strong>Draft on device</strong> — a sale is saved locally. Tap
                Record sale to sync, or clear the form.
              </>
            )}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-3xl border bg-white p-10 text-center text-slate-500">
          No stock to sell.
          {!online
            ? ' Open Sell while online once so inventory can be cached for the field.'
            : ' Ask the operator to transfer stock to you.'}
        </div>
      ) : (
        <>
          <div className="rounded-3xl border bg-white overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-400">
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-right px-4 py-3">On hand</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-right px-4 py-3">Unit price</th>
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
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {i.qty_on_hand} {i.unit}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="w-20 rounded-xl border border-slate-200 px-2 py-1.5 text-right text-sm font-semibold"
                        value={qty[i.id] || ''}
                        onChange={(e) =>
                          setQty((q) => ({ ...q, [i.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="w-24 rounded-xl border border-slate-200 px-2 py-1.5 text-right text-sm font-semibold"
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

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-xs font-bold text-slate-600">
              Payment
              <select
                className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="eft">EFT</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : online ? (
                'Record sale'
              ) : (
                'Save offline'
              )}
            </button>
            {hasDraft && (
              <button
                type="button"
                onClick={() => {
                  setQty({});
                  clearOfflineDraft(DRAFT_KEY);
                  setHasDraft(false);
                  toast.message('Draft cleared');
                }}
                className="btn-secondary !py-2.5 !px-4 text-sm"
              >
                Clear draft
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
