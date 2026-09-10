'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';
import {
  clientReport,
  newConstructionId,
  projectsForClient,
} from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphClientsPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [contact, setContact] = useState('');

  const add = async () => {
    const nextName = name.trim();
    if (!nextName) {
      toast.error('Client name is required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        clients: [
          {
            id: newConstructionId('cli'),
            name: nextName,
            city: city.trim() || undefined,
            contact: contact.trim() || undefined,
          },
        ],
      },
    });
    setName('');
    setCity('');
    setContact('');
    toast.success('Client saved');
  };

  return (
    <ConstructiongraphWorkbench
      title="Clients"
      description="One customer, many projects. Each client is the parent for quotes, BOQs, programme and reports. CRM Customers stays the trade book."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 grid sm:grid-cols-4 gap-2">
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Client name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Add client
            </button>
          </div>
          {store.clients.length === 0 ? (
            <ConstructionEmptyHint>
              No clients yet. Add a developer or owner, then hang multiple projects under them.
            </ConstructionEmptyHint>
          ) : (
            <div className="space-y-3">
              {store.clients.map((c) => {
                const report = clientReport(store, c.id);
                const projects = projectsForClient(store, c.id);
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-stone-300 bg-white p-4 text-sm"
                  >
                    <div className="font-black text-slate-900">{c.name}</div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {c.city || '—'} · {c.contact || 'no contact'} · {projects.length} project
                      {projects.length === 1 ? '' : 's'} · contract {zar(report.contractValue)} ·
                      actuals {zar(report.costs)}
                    </div>
                    {projects.length ? (
                      <div className="mt-2 space-y-1 text-xs">
                        {projects.map((p) => (
                          <div key={p.id}>
                            <b>{p.code}</b> · {p.name} · {p.status}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-stone-500">No projects yet.</p>
                    )}
                    <Link
                      href="/dashboard/constructiongraph/sites"
                      className="inline-block mt-2 text-amber-800 underline text-xs"
                    >
                      Add a project
                    </Link>
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
