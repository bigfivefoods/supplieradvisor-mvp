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
import {
  COST_KINDS,
  allocateCostPatch,
  newConstructionId,
  projectReport,
} from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphCostsPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [siteId, setSiteId] = useState('');
  const [boqId, setBoqId] = useState('');
  const [kind, setKind] = useState('material');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const add = async () => {
    if (!store) return;
    const nextDesc = description.trim();
    const nextAmt = Number(amount);
    if (!siteId || !nextDesc || !Number.isFinite(nextAmt)) {
      toast.error('Project, description and amount are required');
      return;
    }
    const cost = {
      id: newConstructionId('cost'),
      site_id: siteId,
      boq_id: boqId || null,
      kind,
      description: nextDesc,
      amount: nextAmt,
      date: new Date().toISOString().slice(0, 10),
    };
    await post({
      action: 'merge',
      store: allocateCostPatch(store, cost),
    });
    setDescription('');
    setAmount('');
    toast.success(
      boqId
        ? 'Actual cost allocated — BOQ actuals updated'
        : 'Actual cost allocated to the project'
    );
  };

  return (
    <ConstructiongraphWorkbench
      title="Costs"
      description="Allocate actuals against the project and BOQ line. Posted costs update BOQ actuals and roll into the programme report."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-6 gap-2">
            <ConstructionProjectSelect
              store={store}
              value={siteId}
              onChange={(id) => {
                setSiteId(id);
                setBoqId('');
              }}
            />
            <select
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={boqId}
              onChange={(e) => setBoqId(e.target.value)}
            >
              <option value="">BOQ item</option>
              {store.boq
                .filter((b) => !siteId || b.site_id === siteId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.item_no} · {b.description}
                  </option>
                ))}
            </select>
            <select
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {COST_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
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
                Post
              </button>
            </div>
          </div>
          {store.sites.length === 0 ? (
            <ConstructionEmptyHint>Add a project before posting actuals.</ConstructionEmptyHint>
          ) : (
            store.sites.map((s) => {
              const report = projectReport(store, s.id);
              const rows = store.costs.filter((c) => c.site_id === s.id);
              if (!report) return null;
              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-stone-300 bg-white p-4 text-sm"
                >
                  <div className="font-black">
                    {s.code} · {s.name}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    BOQ {zar(report.boqPlanned)} · BOQ actual {zar(report.boqActual)} ·
                    posted {zar(report.costs)} · remaining {zar(report.variance)}
                  </div>
                  {report.boqLines.length ? (
                    <div className="mt-2 space-y-1 text-xs">
                      {report.boqLines.map((row) => (
                        <div key={row.id}>
                          {row.item_no} · {row.description} · planned {zar(row.planned)} ·
                          actual {zar(row.actual)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {rows.length === 0 ? (
                    <p className="mt-2 text-xs text-stone-500">
                      No actuals posted on this project.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1 text-xs border-t pt-2">
                      {rows.map((row) => (
                        <div key={row.id}>
                          {row.date || '—'} · {row.kind} · {row.description} ·{' '}
                          {zar(row.amount)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
