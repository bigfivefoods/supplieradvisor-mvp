'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

export default function ConstructiongraphSitesPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [client, setClient] = useState('');

  const add = async () => {
    const nextCode = code.trim();
    const nextName = name.trim();
    if (!nextCode || !nextName) {
      toast.error('Site code and name are required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        sites: [
          {
            id: `site_${Date.now()}`,
            code: nextCode,
            name: nextName,
            client: client.trim() || undefined,
            status: 'on_site',
            contract_type: 'JBCC',
          },
        ],
      },
    });
    setCode('');
    setName('');
    setClient('');
    toast.success('Site saved');
  };

  return (
    <ConstructiongraphWorkbench
      title="Sites"
      description="Building sites and contracts — not Core Projects. Each site is the master for drawings, BOQ, programme, certificates and snags."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-4 gap-2">
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="SITE-02"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Site name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Add site
            </button>
          </div>
          {store.sites.length === 0 ? (
            <ConstructionEmptyHint>
              No sites yet. Add a contract or seed the ConstructionAdvisor® demo from Command.
            </ConstructionEmptyHint>
          ) : (
            <div className="rounded-2xl border border-stone-300 bg-white p-4 text-sm space-y-2">
              {store.sites.map((s) => (
                <div key={s.id} className="border-t first:border-t-0 pt-2 first:pt-0">
                  <b>{s.code}</b> · {s.name} · {s.client || 'no client'} · {s.status || '—'} ·{' '}
                  {s.contract_type || '—'}
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
