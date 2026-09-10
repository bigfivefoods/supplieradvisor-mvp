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
  clientById,
  newConstructionId,
  projectReport,
} from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphSitesPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [contractValue, setContractValue] = useState('');

  const add = async () => {
    const nextCode = code.trim();
    const nextName = name.trim();
    if (!nextCode || !nextName) {
      toast.error('Project code and name are required');
      return;
    }
    const client = store?.clients.find((c) => c.id === clientId);
    await post({
      action: 'merge',
      store: {
        sites: [
          {
            id: newConstructionId('site'),
            code: nextCode,
            name: nextName,
            client_id: clientId || null,
            client: client?.name,
            status: 'tender',
            contract_type: 'JBCC',
            contract_value: contractValue ? Number(contractValue) : null,
          },
        ],
      },
    });
    setCode('');
    setName('');
    setContractValue('');
    toast.success('Project saved');
  };

  return (
    <ConstructiongraphWorkbench
      title="Projects"
      description="Building contracts under a client — not Core Projects. One customer can have many projects. Each project is the master for BOQ, programme, costs, certificates and snags."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-5 gap-2">
            <select
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Client</option>
              {store.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="PRJ-04"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Contract value"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Add project
            </button>
          </div>
          {store.sites.length === 0 ? (
            <ConstructionEmptyHint>
              No projects yet. Add a client first, then hang contracts under them.
            </ConstructionEmptyHint>
          ) : (
            <div className="rounded-2xl border border-stone-300 bg-white p-4 text-sm space-y-2">
              {store.sites.map((s) => {
                const report = projectReport(store, s.id);
                const client = clientById(store, s.client_id);
                return (
                  <div key={s.id} className="border-t first:border-t-0 pt-2 first:pt-0">
                    <b>{s.code}</b> · {s.name} · {client?.name || s.client || 'no client'} ·{' '}
                    {s.status || '—'} · {s.contract_type || '—'}
                    {report
                      ? ` · BOQ ${zar(report.boqPlanned)} · actuals ${zar(report.costs)} · plan ${Math.round(report.plannedPct)}% / actual ${Math.round(report.actualPct)}%`
                      : ''}
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
