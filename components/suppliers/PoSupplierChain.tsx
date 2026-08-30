'use client';

import { useCallback, useEffect, useState } from 'react';
import { OrderChainPath } from '@/components/orders/OrderChainPath';
import {
  supplierChainStep,
  supplierPortalCardAction,
} from '@/lib/orders/chain-path';

type LotBit = {
  batch_number?: string;
  manufactured_date?: string;
  expiry_date?: string;
  qty?: number;
};

export function PoSupplierChain({
  status,
  productionStatus,
  fulfilmentStatus,
  shippedDate,
  inventoryReceived,
  lots,
}: {
  status: string;
  productionStatus?: string | null;
  fulfilmentStatus?: string | null;
  shippedDate?: string | null;
  inventoryReceived?: boolean;
  lots?: LotBit[];
}) {
  const step = supplierChainStep({
    side: 'supplier',
    orderStatus: status,
    productionStatus,
    fulfilmentStatus,
    shippedDate,
    inventoryReceived,
  });
  const next = supplierPortalCardAction({
    orderStatus: status,
    productionStatus,
    fulfilmentStatus,
    shippedDate,
    inventoryReceived,
  });
  return (
    <div className="mt-2 space-y-1.5">
      <OrderChainPath side="supplier" current={step} compact />
      {next ? (
        <p className="text-[11px] text-neutral-500">
          Supplier next: {next.label} (on their portal)
        </p>
      ) : inventoryReceived ? (
        <p className="text-[11px] text-emerald-800">Chain complete — stock received</p>
      ) : (
        <p className="text-[11px] text-neutral-500">
          Waiting on you to receive into stock
        </p>
      )}
      {lots && lots.length > 0 ? (
        <ul className="text-[11px] text-slate-700 space-y-0.5">
          {lots.slice(0, 6).map((l, i) => (
            <li key={`${l.batch_number}-${i}`}>
              <span className="font-semibold">{l.batch_number}</span>
              {l.manufactured_date ? ` · mfg ${l.manufactured_date}` : ''}
              {l.expiry_date ? ` · exp ${l.expiry_date}` : ''}
              {l.qty != null ? ` · qty ${l.qty}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PoPortalThread({
  poId,
  withAuth,
}: {
  poId: number;
  withAuth: (
    path: string,
    opts?: { method?: string; jsonBody?: Record<string, unknown> }
  ) => Promise<Response>;
}) {
  const [items, setItems] = useState<
    Array<{ id: number; author: string; body: string }>
  >([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await withAuth(
        `/api/portals/trade/messages?purchaseOrderId=${poId}`
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.messages)) {
        setItems(data.messages);
      }
    } catch {
      /* soft */
    }
  }, [poId, withAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        PO thread
      </p>
      {items.length === 0 ? (
        <p className="text-[11px] text-neutral-500">No messages yet.</p>
      ) : (
        <ul className="space-y-1 max-h-28 overflow-y-auto">
          {items.slice(-8).map((m) => (
            <li key={m.id} className="text-[11px] text-slate-700">
              <span className="font-semibold">
                {m.author === 'host' ? 'You' : 'Supplier'}:
              </span>{' '}
              {m.body}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          className="input flex-1 !py-2 !px-2 !text-sm min-h-[44px]"
          placeholder="Message the supplier"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => {
            const t = text;
            setText('');
            setBusy(true);
            void (async () => {
              try {
                const res = await withAuth('/api/portals/trade/messages', {
                  method: 'POST',
                  jsonBody: { purchaseOrderId: poId, body: t },
                });
                if (res.ok) await load();
              } finally {
                setBusy(false);
              }
            })();
          }}
          className="btn-secondary !py-2 !px-3 text-xs min-h-[44px]"
        >
          Send
        </button>
      </div>
    </div>
  );
}
