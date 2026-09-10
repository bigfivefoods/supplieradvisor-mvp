'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

export default function ConstructiongraphVariationsPage() {
  const { store, loading, saving, post } = useConstructiongraph();
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
            id: `var_${Date.now()}`,
            number: nextNo,
            description: nextDesc,
            amount: amount ? Number(amount) : null,
            status: 'draft',
            site_id: store?.sites[0]?.id || null,
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
      description="Site variations and claims against the building contract."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-4 gap-2">
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
              {store.variations.map((row) => (
                <div key={row.id} className="border-t first:border-t-0 pt-2 first:pt-0">
                  <b>{row.number}</b> · {row.description} · {row.status}
                  {row.amount != null
                    ? ` · R ${Number(row.amount).toLocaleString('en-ZA')}`
                    : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
