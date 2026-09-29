'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ApparelLoadingBlock,
  ApparelgraphWorkbench,
  useApparelgraph,
} from '@/components/apparel/ApparelgraphWorkbench';
import { newApparelId, rangeReport } from '@/lib/apparel/apparelgraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ApparelgraphRangePage() {
  const { store, loading, saving, post } = useApparelgraph();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [drop, setDrop] = useState('');

  const add = async () => {
    const nextCode = code.trim();
    const nextName = name.trim();
    if (!nextCode || !nextName) {
      toast.error('Season code and name are required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        seasons: [
          {
            id: newApparelId('ssn'),
            code: nextCode,
            name: nextName,
            drop_date: drop || null,
            status: 'planning',
          },
        ],
      },
    });
    setCode('');
    setName('');
    setDrop('');
    toast.success('Season saved');
  };

  return (
    <ApparelgraphWorkbench
      title="Range"
      description="Season and line plan — the objects apparel actually plans on, not a flat SKU list."
    >
      {loading || !store ? (
        <ApparelLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 grid sm:grid-cols-4 gap-2">
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="SS26"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Season name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              value={drop}
              onChange={(e) => setDrop(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Add season
            </button>
          </div>
          {rangeReport(store).map((row) => (
            <div
              key={row.season.id}
              className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm"
            >
              <div className="font-black">
                {row.season.code} · {row.season.name}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {row.styleCount} styles · planned {row.planned} · sewn {row.sew} · landed BOM{' '}
                {zar(row.cost)} · sell-through {Math.round(row.sellThrough)}% · drop{' '}
                {row.season.drop_date || '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
