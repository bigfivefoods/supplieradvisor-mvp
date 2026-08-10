'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  QuarrygraphWorkbench,
  useQuarrygraph,
} from '@/components/quarry/QuarrygraphWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fieldClass,
} from '@/components/quarry/SimpleEntityForm';

export default function QuarryPlantPage() {
  const { store, loading, saving, post, summary } = useQuarrygraph();
  const [run, setRun] = useState({
    site_id: '',
    date: new Date().toISOString().slice(0, 10),
    plant_name: 'Primary jaw + cone',
    hours: '',
    feed_tonnes: '',
    product_id: '',
    output_tonnes: '',
    downtime_min: '',
  });
  const [pile, setPile] = useState({
    site_id: '',
    product_id: '',
    name: '',
    tonnes: '',
  });

  const addRun = async () => {
    await post({
      entity: 'plant_runs',
      action: 'upsert',
      record: {
        ...run,
        site_id: run.site_id || null,
        product_id: run.product_id || null,
        hours: run.hours ? Number(run.hours) : null,
        feed_tonnes: run.feed_tonnes ? Number(run.feed_tonnes) : null,
        output_tonnes: run.output_tonnes ? Number(run.output_tonnes) : null,
        downtime_min: run.downtime_min ? Number(run.downtime_min) : null,
      },
    });
    toast.success('Plant run logged');
  };

  const addPile = async () => {
    if (!pile.product_id || !pile.name.trim()) {
      toast.error('Product and name required');
      return;
    }
    await post({
      entity: 'stockpiles',
      action: 'upsert',
      record: {
        ...pile,
        site_id: pile.site_id || null,
        tonnes: Number(pile.tonnes) || 0,
        last_survey_at: new Date().toISOString().slice(0, 10),
      },
    });
    toast.success('Stockpile saved');
  };

  return (
    <QuarrygraphWorkbench
      title="Plant & stockpiles"
      titleAccent="crush · pad"
      description="Crusher and screen production runs plus stockpile book balances by product — feed for the weighbridge."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="qg-ops"
            items={[
              {
                label: 'Plant output t',
                value: Number(summary?.plantOutputTonnes) || 0,
              },
              {
                label: 'Stockpile t',
                value: Number(summary?.stockpileTonnes) || 0,
              },
            ]}
          />
          <FormCard tone="qg-ops" title="Log plant run" onSubmit={() => void addRun()} saving={saving}>
            <select className={fieldClass()} value={run.site_id} onChange={(e) => setRun((f) => ({ ...f, site_id: e.target.value }))}>
              <option value="">Site…</option>
              {store.sites.map((s) => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </select>
            <input className={fieldClass()} type="date" value={run.date} onChange={(e) => setRun((f) => ({ ...f, date: e.target.value }))} />
            <input className={fieldClass()} placeholder="Plant name" value={run.plant_name} onChange={(e) => setRun((f) => ({ ...f, plant_name: e.target.value }))} />
            <select className={fieldClass()} value={run.product_id} onChange={(e) => setRun((f) => ({ ...f, product_id: e.target.value }))}>
              <option value="">Output product…</option>
              {store.products.map((p) => (
                <option key={p.id} value={p.id}>{p.code}</option>
              ))}
            </select>
            <input className={fieldClass()} type="number" placeholder="Hours" value={run.hours} onChange={(e) => setRun((f) => ({ ...f, hours: e.target.value }))} />
            <input className={fieldClass()} type="number" placeholder="Feed t" value={run.feed_tonnes} onChange={(e) => setRun((f) => ({ ...f, feed_tonnes: e.target.value }))} />
            <input className={fieldClass()} type="number" placeholder="Output t" value={run.output_tonnes} onChange={(e) => setRun((f) => ({ ...f, output_tonnes: e.target.value }))} />
            <input className={fieldClass()} type="number" placeholder="Downtime min" value={run.downtime_min} onChange={(e) => setRun((f) => ({ ...f, downtime_min: e.target.value }))} />
          </FormCard>
          <DataTable tone="qg-ops"
            headers={['Date', 'Plant', 'Product', 'Hours', 'Feed t', 'Out t', 'DT min']}
            rows={store.plant_runs.map((r) => {
              const prod = store.products.find((p) => p.id === r.product_id);
              return {
                id: r.id,
                cells: [
                  r.date,
                  r.plant_name,
                  prod?.code || '—',
                  r.hours ?? '—',
                  r.feed_tonnes ?? '—',
                  r.output_tonnes ?? '—',
                  r.downtime_min ?? '—',
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'plant_runs', action: 'delete', id })}
          />

          <FormCard tone="qg-ops" title="Stockpile balance" onSubmit={() => void addPile()} saving={saving} submitLabel="Save stockpile">
            <select className={fieldClass()} value={pile.site_id} onChange={(e) => setPile((f) => ({ ...f, site_id: e.target.value }))}>
              <option value="">Site…</option>
              {store.sites.map((s) => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </select>
            <select className={fieldClass()} value={pile.product_id} onChange={(e) => setPile((f) => ({ ...f, product_id: e.target.value }))}>
              <option value="">Product…</option>
              {store.products.map((p) => (
                <option key={p.id} value={p.id}>{p.code}</option>
              ))}
            </select>
            <input className={fieldClass()} placeholder="Pad name" value={pile.name} onChange={(e) => setPile((f) => ({ ...f, name: e.target.value }))} />
            <input className={fieldClass()} type="number" placeholder="Tonnes" value={pile.tonnes} onChange={(e) => setPile((f) => ({ ...f, tonnes: e.target.value }))} />
          </FormCard>
          <DataTable tone="qg-ops"
            headers={['Name', 'Site', 'Product', 'Tonnes', 'Surveyed']}
            rows={store.stockpiles.map((s) => {
              const site = store.sites.find((x) => x.id === s.site_id);
              const prod = store.products.find((p) => p.id === s.product_id);
              return {
                id: s.id,
                cells: [
                  s.name,
                  site?.code || '—',
                  prod?.code || '—',
                  s.tonnes,
                  s.last_survey_at || '—',
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'stockpiles', action: 'delete', id })}
          />
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
