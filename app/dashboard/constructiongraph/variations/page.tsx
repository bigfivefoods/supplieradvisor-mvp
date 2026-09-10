'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructionProjectSelect,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';
import { newConstructionId } from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphVariationsPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [siteId, setSiteId] = useState('');
  const [number, setNumber] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const add = async () => {
    const nextNo = number.trim();
    const nextDesc = description.trim();
    if (!nextNo || !nextDesc) {
      toast.error('VO number and description are required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        variations: [
          {
            id: newConstructionId('var'),
            number: nextNo,
            description: nextDesc,
            amount: amount ? Number(amount) : null,
            status: 'draft',
            site_id: siteId || store?.sites[0]?.id || null,
          },
        ],
      },
    });
    setNumber('');
    setDescription('');
    setAmount('');
    toast.success('Variation saved');
  };

  return (
    <ConstructiongraphWorkbench
      title="Variations"
      description="Site variations and claims against the building contract, keyed to the project."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-5 gap-2">
            <ConstructionProjectSelect
              store={store}
              value={siteId}
              onChange={setSiteId}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="VO-004"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <input
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm flex-1"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void add()}
                className="btn-primary !py-2 !px-3 text-sm"
              >
                Add
              </button>
            </div>
          </div>
          {store.variations.length === 0 ? (
            <ConstructionEmptyHint>No variations logged.</ConstructionEmptyHint>
          ) : (
            <div className="rounded-2xl border border-stone-300 bg-white p-4 text-sm space-y-2">
              {store.variations.map((row) => {
                const site = store.sites.find((s) => s.id === row.site_id);
                return (
                  <div key={row.id} className="border-t first:border-t-0 pt-2 first:pt-0">
                    <b>{row.number}</b> · {row.description} · {row.status}
                    {site ? ` · ${site.code}` : ''}
                    {row.amount != null ? ` · ${zar(row.amount)}` : ''}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
