'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  RetailgraphPage,
  RetailgraphRequired,
} from '@/components/retail/RetailgraphShell';
import { TillPresentPay } from '@/components/till/TillPresentPay';
import { formatZar } from '@/lib/b2c/member-account-types';
import type { RetailSku } from '@/lib/retail/retailgraph';
import type { TillLine } from '@/lib/till/types';

type BasketLine = TillLine & { key: string };

export default function RetailTillPage() {
  const { companyId, withAuthJson } = useApiAuth();
  const [skus, setSkus] = useState<RetailSku[]>([]);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [present, setPresent] = useState<'sale' | 'wallet' | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ store?: { skus?: RetailSku[] } }>(
      `/api/retail/retailgraph?companyId=${companyId}`
    );
    setSkus((data.store?.skus || []).filter((s) => s.active !== false));
  }, [companyId, withAuthJson]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const total = useMemo(
    () => basket.reduce((n, l) => n + l.qty * l.unit_zar, 0),
    [basket]
  );

  const addSku = (sku: RetailSku) => {
    setBasket((rows) => {
      const hit = rows.find((r) => r.key === sku.id);
      if (hit) {
        return rows.map((r) =>
          r.key === sku.id ? { ...r, qty: r.qty + 1 } : r
        );
      }
      return [
        ...rows,
        {
          key: sku.id,
          sku: sku.sku || sku.id,
          name: sku.name,
          qty: 1,
          unit_zar: sku.price_zar,
        },
      ];
    });
  };

  const setQty = (key: string, qty: number) => {
    setBasket((rows) =>
      qty <= 0 ? rows.filter((r) => r.key !== key) : rows.map((r) => (r.key === key ? { ...r, qty } : r))
    );
  };

  const cashSale = async () => {
    if (!companyId || total <= 0) return;
    try {
      await withAuthJson('/api/retail/retailgraph', {
        method: 'POST',
        jsonBody: {
          companyId,
          action: 'record_cash_sale',
          lines: basket.map((l) => ({
            name: l.name,
            qty: l.qty,
            unit_zar: l.unit_zar,
          })),
        },
      });
      toast.success('Cash sale recorded');
      setBasket([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record sale');
    }
  };

  return (
    <RetailgraphRequired>
      <RetailgraphPage
        title="Till"
        description="Add SKUs, then take cash or present a QR / NFC for the customer to pay on SA Member. “Pay my bills” opens their open gym, clinic and hire charges on the phone."
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-black">Catalogue</h2>
              {skus.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  Add SKUs under Catalogue first.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {skus.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{s.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatZar(s.price_zar)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addSku(s)}
                        className="rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-black text-white"
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
              <h2 className="text-sm font-black">Basket</h2>
              {basket.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Empty — tap a SKU.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {basket.map((l) => (
                    <li
                      key={l.key}
                      className="flex items-center gap-2 rounded-xl bg-white px-2 py-2"
                    >
                      <div className="min-w-0 flex-1 text-sm font-semibold">
                        {l.name}
                      </div>
                      <button
                        type="button"
                        onClick={() => setQty(l.key, l.qty - 1)}
                        className="rounded-md border p-1"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-black">
                        {l.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(l.key, l.qty + 1)}
                        className="rounded-md border p-1"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setQty(l.key, 0)}
                        className="rounded-md p-1 text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-2xl font-black tabular-nums">
                {formatZar(total)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={total <= 0}
                  onClick={() => setPresent('sale')}
                  className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  Present QR / NFC
                </button>
                <button
                  type="button"
                  disabled={total <= 0}
                  onClick={() => void cashSale()}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPresent('wallet')}
                  className="rounded-xl border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-orange-900"
                >
                  Pay my SA bills
                </button>
              </div>
            </section>
          </div>
        )}

        {present === 'sale' ? (
          <TillPresentPay
            module="retailgraph"
            kind="sale"
            amountZar={total}
            label="Retail sale"
            lines={basket}
            onPaid={(session) => {
              if (session.paid_via === 'cash') void cashSale();
              else setBasket([]);
              setPresent(null);
            }}
            onClose={() => setPresent(null)}
          />
        ) : null}
        {present === 'wallet' ? (
          <TillPresentPay
            module="retailgraph"
            kind="wallet"
            amountZar={0}
            label="Pay my SA Member bills"
            onPaid={() => setPresent(null)}
            onClose={() => setPresent(null)}
          />
        ) : null}
      </RetailgraphPage>
    </RetailgraphRequired>
  );
}
