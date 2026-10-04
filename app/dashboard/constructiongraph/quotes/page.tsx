'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';
import {
  acceptQuotePatch,
  boqAmount,
  newConstructionId,
  quoteBoqTotal,
} from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphQuotesPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [quoteId, setQuoteId] = useState('');
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [itemNo, setItemNo] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [uom, setUom] = useState('item');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');

  const quotesForForm =
    store?.quotes.filter((q) => {
      if (clientId && q.client_id !== clientId) return false;
      if (siteId && q.site_id !== siteId) return false;
      return true;
    }) || [];

  const addQuote = async () => {
    const nextNo = number.trim();
    const nextTitle = title.trim();
    if (!nextNo || !nextTitle) {
      toast.error('Quote number and title are required');
      return;
    }
    const id = newConstructionId('qt');
    await post({
      action: 'merge',
      store: {
        quotes: [
          {
            id,
            number: nextNo,
            title: nextTitle,
            client_id: clientId || null,
            site_id: siteId || null,
            status: 'draft',
          },
        ],
      },
    });
    setQuoteId(id);
    setNumber('');
    setTitle('');
    toast.success('Quote saved — add BOQ lines');
  };

  const addBoq = async () => {
    if (!store) return;
    const quote = store.quotes.find((q) => q.id === quoteId);
    if (!quote) {
      toast.error('Select a quote first');
      return;
    }
    const nextNo = itemNo.trim();
    const nextDesc = itemDesc.trim();
    if (!nextNo || !nextDesc) {
      toast.error('BOQ item number and description are required');
      return;
    }
    const qn = Number(qty) || 0;
    const rn = Number(rate) || 0;
    await post({
      action: 'merge',
      store: {
        boq: [
          {
            id: newConstructionId('boq'),
            quote_id: quote.id,
            site_id: quote.site_id || siteId || null,
            item_no: nextNo,
            description: nextDesc,
            uom: uom.trim() || 'item',
            qty: qn,
            rate: rn,
            amount: qn * rn,
          },
        ],
      },
    });
    setItemNo('');
    setItemDesc('');
    setQty('');
    setRate('');
    toast.success(`BOQ line added to ${quote.number}`);
  };

  const issue = async (id: string) => {
    const quote = store?.quotes.find((q) => q.id === id);
    if (!quote) return;
    await post({
      action: 'merge',
      store: {
        quotes: [
          {
            ...quote,
            status: 'issued',
            issued_at: new Date().toISOString().slice(0, 10),
          },
        ],
      },
    });
    toast.success('Quote issued from the BOQ');
  };

  const accept = async (id: string) => {
    if (!store) return;
    const patch = acceptQuotePatch(store, id);
    if (!patch.quotes?.length) return;
    await post({ action: 'merge', store: patch });
    toast.success('Quote accepted — BOQ is the contract budget');
  };

  const decline = async (id: string) => {
    const quote = store?.quotes.find((q) => q.id === id);
    if (!quote) return;
    await post({
      action: 'merge',
      store: { quotes: [{ ...quote, status: 'declined' }] },
    });
    toast.success('Quote declined');
  };

  return (
    <ConstructiongraphWorkbench
      title="Quotes"
      description="Quote from the bill of quantities. Issue the BOQ, then accept to lock it as the project contract budget. Invoices stay on Customers Trade."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-5 gap-2">
            <select
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSiteId('');
                setQuoteId('');
              }}
            >
              <option value="">Client</option>
              {store.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                setQuoteId('');
              }}
            >
              <option value="">Project</option>
              {store.sites
                .filter((s) => !clientId || s.client_id === clientId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
            </select>
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="QT-…"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Quote title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void addQuote()}
              className="btn-primary !py-2 text-sm"
            >
              New quote
            </button>
          </div>

          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-6 gap-2">
            <select
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={quoteId}
              onChange={(e) => setQuoteId(e.target.value)}
            >
              <option value="">BOQ onto quote</option>
              {quotesForForm.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.number} · {q.title}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Item no"
              value={itemNo}
              onChange={(e) => setItemNo(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
              placeholder="BOQ description"
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="UOM"
              value={uom}
              onChange={(e) => setUom(e.target.value)}
            />
            <div className="flex gap-2">
              <input
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm w-20"
                placeholder="Qty"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <input
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm flex-1"
                placeholder="Rate"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void addBoq()}
                className="btn-secondary !py-2 !px-3 text-sm"
              >
                Add line
              </button>
            </div>
          </div>

          {store.quotes.length === 0 ? (
            <ConstructionEmptyHint>
              No quotes yet. Create a quote, add BOQ lines, then issue to the client.
            </ConstructionEmptyHint>
          ) : (
            store.quotes.map((q) => {
              const lines = store.boq.filter((b) => b.quote_id === q.id);
              const total = quoteBoqTotal(store, q.id);
              const client = store.clients.find((c) => c.id === q.client_id);
              const site = store.sites.find((s) => s.id === q.site_id);
              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-stone-300 bg-white p-4 text-sm space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-black">
                        {q.number} · {q.title}
                      </div>
                      <div className="text-xs text-stone-500">
                        {client?.name || 'no client'} · {site?.code || 'no project'} ·{' '}
                        {q.status} · {zar(total)} · {lines.length} BOQ lines
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {q.status === 'draft' ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void issue(q.id)}
                          className="btn-primary !py-1.5 !px-3 text-xs"
                        >
                          Issue quote
                        </button>
                      ) : null}
                      {q.status === 'issued' ? (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void accept(q.id)}
                            className="btn-primary !py-1.5 !px-3 text-xs"
                          >
                            Mark accepted
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void decline(q.id)}
                            className="btn-secondary !py-1.5 !px-3 text-xs"
                          >
                            Decline
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {lines.map((row) => (
                    <div key={row.id} className="text-xs border-t pt-1">
                      {row.item_no} · {row.description} · {row.qty} {row.uom} @{' '}
                      {zar(row.rate)} = {zar(boqAmount(row))}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
