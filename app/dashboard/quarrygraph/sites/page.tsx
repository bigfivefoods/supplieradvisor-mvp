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
import { MATERIAL_TYPES } from '@/lib/quarry/quarrygraph';

export default function QuarrySitesPage() {
  const { store, loading, saving, post, summary } = useQuarrygraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    quarry_id: '',
    quarry_name: '',
    material: 'Dolerite',
    face: '',
    hectares: '',
    mining_right_ref: '',
    district: '',
    province: '',
  });

  const add = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Code and name required');
      return;
    }
    await post({
      entity: 'sites',
      action: 'upsert',
      record: {
        ...form,
        quarry_id: form.quarry_id || null,
        hectares: form.hectares ? Number(form.hectares) : null,
      },
    });
    toast.success('Pit/face saved under quarry');
    setForm((f) => ({ ...f, code: '', name: '', face: '', hectares: '' }));
  };

  return (
    <QuarrygraphWorkbench
      title="Sites & faces"
      titleAccent="shared master"
      description="Pit and face register is the single source of truth for reserves, production, plant, dispatch, fleet and compliance."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Quarries',
                value: Number(summary?.quarryCount) || (store.quarries || []).length,
              },
              { label: 'Pits / faces', value: Number(summary?.siteCount) || store.sites.length },
              {
                label: 'Materials',
                value: new Set(store.sites.map((s) => s.material)).size,
              },
            ]}
          />
          {(store.quarries || []).length === 0 ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              Tip: register quarries first under{' '}
              <a href="/dashboard/quarrygraph/quarries" className="font-bold underline">
                Quarries
              </a>{' '}
              so pits roll up correctly across multi-site fleets and reports.
            </p>
          ) : null}
          <FormCard title="Add pit / face" onSubmit={() => void add()} saving={saving}>
            <select className={fieldClass()} value={form.quarry_id} onChange={(e) => setForm((f) => ({ ...f, quarry_id: e.target.value }))}>
              <option value="">Parent quarry…</option>
              {(store.quarries || []).map((q) => (
                <option key={q.id} value={q.id}>{q.code} · {q.name}</option>
              ))}
            </select>
            <input className={fieldClass()} placeholder="Code (e.g. PIT-A)" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <input className={fieldClass()} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <select className={fieldClass()} value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}>
              {MATERIAL_TYPES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input className={fieldClass()} placeholder="Face" value={form.face} onChange={(e) => setForm((f) => ({ ...f, face: e.target.value }))} />
            <input className={fieldClass()} placeholder="Hectares" type="number" value={form.hectares} onChange={(e) => setForm((f) => ({ ...f, hectares: e.target.value }))} />
            <input className={fieldClass()} placeholder="Mining right ref" value={form.mining_right_ref} onChange={(e) => setForm((f) => ({ ...f, mining_right_ref: e.target.value }))} />
            <input className={fieldClass()} placeholder="District" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
            <input className={fieldClass()} placeholder="Province" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
          </FormCard>
          <DataTable
            headers={['Code', 'Name', 'Quarry', 'Material', 'Face', 'Ha', 'Mining right']}
            rows={store.sites.map((s) => {
              const q = (store.quarries || []).find((x) => x.id === s.quarry_id);
              return {
                id: s.id,
                cells: [
                  s.code,
                  s.name,
                  q?.code || s.quarry_name || '—',
                  s.material,
                  s.face || '—',
                  s.hectares ?? '—',
                  s.mining_right_ref || '—',
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'sites', action: 'delete', id })}
          />
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
