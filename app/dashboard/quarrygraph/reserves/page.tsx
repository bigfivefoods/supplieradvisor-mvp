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

export default function QuarryReservesPage() {
  const year = String(new Date().getFullYear());
  const { store, loading, saving, post, summary } = useQuarrygraph();
  const [form, setForm] = useState({
    site_id: '',
    product_id: '',
    season: year,
    tonnes: '',
    quality_metric: '',
    quality_label: 'CS MPa',
    status: 'surveyed',
  });

  const add = async () => {
    if (!form.site_id) {
      toast.error('Select a site');
      return;
    }
    await post({
      entity: 'reserves',
      action: 'upsert',
      record: {
        ...form,
        product_id: form.product_id || null,
        tonnes: Number(form.tonnes) || 0,
        quality_metric: form.quality_metric
          ? Number(form.quality_metric)
          : null,
      },
    });
    toast.success('Reserve estimate saved');
  };

  return (
    <QuarrygraphWorkbench
      title="Reserves"
      titleAccent="resource book"
      description="Surveyed and approved recoverable tonnes by site, product and season — feeds production planning."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="qg-office"
            items={[
              {
                label: 'Reserve tonnes',
                value: Number(summary?.reserveTonnes) || 0,
              },
              { label: 'Rows', value: store.reserves.length },
            ]}
          />
          <FormCard tone="qg-office" title="Add / revise reserve" onSubmit={() => void add()} saving={saving}>
            <select className={fieldClass()} value={form.site_id} onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value }))}>
              <option value="">Site…</option>
              {store.sites.map((s) => (
                <option key={s.id} value={s.id}>{s.code} · {s.name}</option>
              ))}
            </select>
            <select className={fieldClass()} value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}>
              <option value="">Product (optional)…</option>
              {store.products.map((p) => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
              ))}
            </select>
            <input className={fieldClass()} placeholder="Season" value={form.season} onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))} />
            <input className={fieldClass()} placeholder="Tonnes" type="number" value={form.tonnes} onChange={(e) => setForm((f) => ({ ...f, tonnes: e.target.value }))} />
            <input className={fieldClass()} placeholder="Quality metric" type="number" value={form.quality_metric} onChange={(e) => setForm((f) => ({ ...f, quality_metric: e.target.value }))} />
            <input className={fieldClass()} placeholder="Quality label" value={form.quality_label} onChange={(e) => setForm((f) => ({ ...f, quality_label: e.target.value }))} />
            <select className={fieldClass()} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="draft">Draft</option>
              <option value="surveyed">Surveyed</option>
              <option value="approved">Approved</option>
              <option value="revised">Revised</option>
              <option value="depleted">Depleted</option>
            </select>
          </FormCard>
          <DataTable tone="qg-office"
            headers={['Site', 'Product', 'Season', 'Tonnes', 'Quality', 'Status', 'Rev']}
            rows={store.reserves.map((r) => {
              const site = store.sites.find((s) => s.id === r.site_id);
              const prod = store.products.find((p) => p.id === r.product_id);
              return {
                id: r.id,
                cells: [
                  site?.code || r.site_id,
                  prod?.code || '—',
                  r.season,
                  r.tonnes,
                  r.quality_metric != null
                    ? `${r.quality_metric} ${r.quality_label || ''}`
                    : '—',
                  r.status,
                  r.revision || 1,
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'reserves', action: 'delete', id })}
          />
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
