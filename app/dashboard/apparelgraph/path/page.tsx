'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ApparelLoadingBlock,
  ApparelgraphWorkbench,
  useApparelgraph,
} from '@/components/apparel/ApparelgraphWorkbench';
import { newApparelId } from '@/lib/apparel/apparelgraph';

export default function ApparelgraphPathPage() {
  const { store, loading, saving, post } = useApparelgraph();
  const [styleCode, setStyleCode] = useState('');
  const [milestone, setMilestone] = useState('');
  const [planned, setPlanned] = useState('');

  const add = async () => {
    const sc = styleCode.trim();
    const next = milestone.trim();
    if (!sc || !next) {
      toast.error('Style and milestone are required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        path: [
          {
            id: newApparelId('pth'),
            style_code: sc,
            milestone: next,
            planned_date: planned || null,
            status: 'planned',
          },
        ],
      },
    });
    setMilestone('');
    setPlanned('');
    toast.success('Critical-path date saved');
  };

  const markDone = async (id: string) => {
    const row = store?.path.find((p) => p.id === id);
    if (!row) return;
    await post({
      action: 'merge',
      store: {
        path: [
          {
            ...row,
            actual_date: new Date().toISOString().slice(0, 10),
            status: 'done',
          },
        ],
      },
    });
    toast.success('Milestone done');
  };

  return (
    <ApparelgraphWorkbench
      title="Path"
      description="Live critical path per style — proto, fit, PP, fabric, cut, sew, pack, ship — with planned vs actual dates."
    >
      {loading || !store ? (
        <ApparelLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 grid sm:grid-cols-4 gap-2">
            <select
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              value={styleCode}
              onChange={(e) => setStyleCode(e.target.value)}
            >
              <option value="">Style</option>
              {store.styleBook.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.code}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Milestone"
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              value={planned}
              onChange={(e) => setPlanned(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Date it
            </button>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm space-y-2">
            {store.path.map((row) => (
              <div
                key={row.id}
                className="border-t first:border-t-0 pt-2 first:pt-0 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <b>{row.style_code}</b> · {row.milestone} · {row.status} · plan{' '}
                  {row.planned_date || '—'}
                  {row.actual_date ? ` · actual ${row.actual_date}` : ''}
                </div>
                {row.status !== 'done' ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void markDone(row.id)}
                    className="btn-secondary !py-1 !px-2 text-xs"
                  >
                    Mark done
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
