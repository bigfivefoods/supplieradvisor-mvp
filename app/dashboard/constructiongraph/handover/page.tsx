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

export default function ConstructiongraphHandoverPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [siteId, setSiteId] = useState('');
  const [item, setItem] = useState('');
  const [location, setLocation] = useState('');

  const add = async () => {
    const nextItem = item.trim();
    if (!nextItem) {
      toast.error('Snag item is required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        snags: [
          {
            id: newConstructionId('snag'),
            item: nextItem,
            location: location.trim() || undefined,
            status: 'open',
            site_id: siteId || store?.sites[0]?.id || null,
          },
        ],
      },
    });
    setItem('');
    setLocation('');
    toast.success('Snag saved');
  };

  const close = async (id: string) => {
    const row = store?.snags.find((s) => s.id === id);
    if (!row) return;
    await post({
      action: 'merge',
      store: { snags: [{ ...row, status: 'closed' }] },
    });
    toast.success('Snag closed');
  };

  return (
    <ConstructiongraphWorkbench
      title="Handover"
      description="Snag list through practical completion and handover, per project."
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
              placeholder="Snag item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
            />
            <input
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Add snag
            </button>
          </div>
          {store.snags.length === 0 ? (
            <ConstructionEmptyHint>No snags on the handover list.</ConstructionEmptyHint>
          ) : (
            <div className="rounded-2xl border border-stone-300 bg-white p-4 text-sm space-y-2">
              {store.snags.map((row) => {
                const site = store.sites.find((s) => s.id === row.site_id);
                return (
                  <div
                    key={row.id}
                    className="border-t first:border-t-0 pt-2 first:pt-0 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <b>{row.item}</b> · {row.location || '—'} · {row.status}
                      {site ? ` · ${site.code}` : ''}
                      {row.due_date ? ` · due ${row.due_date}` : ''}
                    </div>
                    {row.status !== 'closed' ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void close(row.id)}
                        className="btn-secondary !py-1 !px-2 text-xs"
                      >
                        Close
                      </button>
                    ) : null}
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
