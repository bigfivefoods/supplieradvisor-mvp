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
    site_type: 'pit_face',
    material: 'Dolerite',
    face: '',
    hectares: '',
    mining_right_ref: '',
    district: '',
    province: '',
    project_code: '',
    start_date: '',
    end_date: '',
    lat: '',
    lng: '',
    address: '',
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
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      },
    });
    toast.success('Site saved under quarry (with GPS if set)');
    setForm((f) => ({
      ...f,
      code: '',
      name: '',
      face: '',
      hectares: '',
      lat: '',
      lng: '',
      project_code: '',
    }));
  };

  return (
    <QuarrygraphWorkbench
      title="Sites & faces"
      titleAccent="shared master"
      description="Pits, temporary borrow pads and batch plant yards with GPS. Master for reserves, production, plant, dispatch and compliance."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="qg-office"
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
          <FormCard tone="qg-office" title="Add pit / face / pad" onSubmit={() => void add()} saving={saving}>
            <select className={fieldClass()} value={form.quarry_id} onChange={(e) => setForm((f) => ({ ...f, quarry_id: e.target.value }))}>
              <option value="">Parent quarry / plant…</option>
              {(store.quarries || []).map((q) => (
                <option key={q.id} value={q.id}>{q.code} · {q.name} ({q.kind || 'permanent'})</option>
              ))}
            </select>
            <select className={fieldClass()} value={form.site_type} onChange={(e) => setForm((f) => ({ ...f, site_type: e.target.value }))}>
              <option value="pit_face">Pit / face</option>
              <option value="temporary_quarry">Temporary quarry pad</option>
              <option value="batching_plant">Batching plant pad</option>
              <option value="stockyard">Stockyard</option>
              <option value="depot">Depot</option>
              <option value="project_pad">Project pad</option>
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
            <input className={fieldClass()} placeholder="Project code" value={form.project_code} onChange={(e) => setForm((f) => ({ ...f, project_code: e.target.value }))} />
            <input className={fieldClass()} type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            <input className={fieldClass()} type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            <input className={fieldClass()} placeholder="Mining right ref" value={form.mining_right_ref} onChange={(e) => setForm((f) => ({ ...f, mining_right_ref: e.target.value }))} />
            <input className={fieldClass()} placeholder="District" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
            <input className={fieldClass()} placeholder="Province" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
            <input className={fieldClass()} placeholder="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            <input className={fieldClass()} type="number" step="0.000001" placeholder="Latitude" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} />
            <input className={fieldClass()} type="number" step="0.000001" placeholder="Longitude" value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} />
          </FormCard>
          <DataTable tone="qg-office"
            headers={['Code', 'Name', 'Type', 'Quarry', 'Material', 'Temp', 'GPS', 'Project']}
            rows={store.sites.map((s) => {
              const q = (store.quarries || []).find((x) => x.id === s.quarry_id);
              return {
                id: s.id,
                cells: [
                  s.code,
                  s.name,
                  s.site_type || 'pit_face',
                  q?.code || s.quarry_name || '—',
                  s.material,
                  s.is_temporary ? 'Yes' : 'No',
                  s.lat != null && s.lng != null
                    ? `${Number(s.lat).toFixed(3)}, ${Number(s.lng).toFixed(3)}`
                    : '—',
                  s.project_code || '—',
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
