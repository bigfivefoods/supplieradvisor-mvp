'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Package, WifiOff, RefreshCw } from 'lucide-react';
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
  sku?: string | null;
  qty_on_hand: number;
  unit?: string | null;
  unit_sell_price?: number | null;
  container_id?: number | null;
};

type StockSnapshot = {
  items: Inv[];
  savedAt: number;
};

const CACHE_KEY = 'reseller_stock_snapshot';

export default function ResellerStockPage() {
  const { user } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Inv[]>([]);
  const [online, setOnline] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

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
        const snap = loadOfflineDraft<StockSnapshot>(CACHE_KEY);
        if (snap?.value?.items) {
          setItems(snap.value.items);
          setFromCache(true);
          setCachedAt(snap.value.savedAt || snap.savedAt);
          toast.message('Showing cached stock', {
            description: 'You are offline — quantities may be out of date.',
          });
        } else {
          setItems([]);
          setFromCache(false);
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
      const inv: Inv[] = data.inventory || [];
      setItems(inv);
      setFromCache(false);
      const savedAt = Date.now();
      setCachedAt(savedAt);
      saveOfflineDraft(CACHE_KEY, { items: inv, savedAt });
    } catch {
      const snap = loadOfflineDraft<StockSnapshot>(CACHE_KEY);
      if (snap?.value?.items?.length) {
        setItems(snap.value.items);
        setFromCache(true);
        setCachedAt(snap.value.savedAt || snap.savedAt);
        toast.message('Using last saved stock list');
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh when coming back online
  useEffect(() => {
    if (online && user) void load();
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  const cacheLabel =
    cachedAt && !Number.isNaN(cachedAt)
      ? new Date(cachedAt).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">My stock</h1>
          <p className="text-sm text-slate-500">
            Drawn from container outlets by your network operator.
            {cacheLabel && fromCache ? ` · Cached ${cacheLabel}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 touch-manipulation"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {(!online || fromCache) && (
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
                <strong>Offline</strong> — showing the last stock list saved on this
                device. Numbers may not match the live warehouse.
              </>
            ) : (
              <>
                <strong>Cached view</strong> — reconnect and tap Refresh for live
                quantities.
                {cacheLabel ? ` (saved ${cacheLabel})` : ''}
                <button
                  type="button"
                  className="ml-2 underline font-semibold"
                  onClick={() => {
                    clearOfflineDraft(CACHE_KEY);
                    setFromCache(false);
                    void load();
                  }}
                >
                  Clear cache
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-3xl border bg-white p-10 text-center text-slate-500">
          <Package className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          {fromCache || !online
            ? 'No cached stock on this device yet. Open Stock while online once to save a copy for offline use.'
            : 'No stock yet. Ask the operator to transfer inventory to you.'}
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
