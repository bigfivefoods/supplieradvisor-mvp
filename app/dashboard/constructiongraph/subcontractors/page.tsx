'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

export default function ConstructiongraphSubcontractorsPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');

  const add = async () => {
    const nextName = name.trim();
    const nextTrade = trade.trim();
    if (!nextName || !nextTrade) {
      toast.error('Name and trade are required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        subcontractors: [
          {
            id: `sub_${Date.now()}`,
            name: nextName,
            trade: nextTrade,
            status: 'appointed',
            site_id: store?.sites[0]?.id || null,
          },
        ],
      },
    });
    setName('');
    setTrade('');
    toast.success('Subcontractor saved');
  };

  return (
    <ConstructiongraphWorkbench
      title="Subcontractors"
      description="Appointed trades on each site. Supplier book and POs stay on Core Suppliers."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-3 gap-2">
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Company name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Trade (e.g. electrical)"
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Add subcontractor
            </button>
          </div>
          {store.subcontractors.length === 0 ? (
            <ConstructionEmptyHint>No subcontractors appointed yet.</ConstructionEmptyHint>
          ) : (
            <div className="rounded-2xl border border-stone-300 bg-white p-4 text-sm space-y-2">
              {store.subcontractors.map((s) => (
                <div key={s.id} className="border-t first:border-t-0 pt-2 first:pt-0">
                  <b>{s.name}</b> · {s.trade} · {s.status || '—'}
                  {s.contract_value != null
                    ? ` · R ${Number(s.contract_value).toLocaleString('en-ZA')}`
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
