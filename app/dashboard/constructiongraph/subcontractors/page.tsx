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

export default function ConstructiongraphSubcontractorsPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [siteId, setSiteId] = useState('');
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
            id: newConstructionId('sub'),
            name: nextName,
            trade: nextTrade,
            status: 'appointed',
            site_id: siteId || store?.sites[0]?.id || null,
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
      description="Appointed trades on each project. Supplier book and POs stay on Core Suppliers."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-4 gap-2">
            <ConstructionProjectSelect
              store={store}
              value={siteId}
              onChange={setSiteId}
            />
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
              {store.subcontractors.map((s) => {
                const site = store.sites.find((row) => row.id === s.site_id);
                return (
                  <div key={s.id} className="border-t first:border-t-0 pt-2 first:pt-0">
                    <b>{s.name}</b> · {s.trade} · {s.status || '—'}
                    {site ? ` · ${site.code}` : ''}
                    {s.contract_value != null ? ` · ${zar(s.contract_value)}` : ''}
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
