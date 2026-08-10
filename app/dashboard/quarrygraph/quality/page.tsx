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

const TESTS = ['CS', 'ACV', 'AIV', 'PI', 'Grading', 'FI', 'Other'];

export default function QuarryQualityPage() {
  const { store, loading, saving, post, summary } = useQuarrygraph();
  const [form, setForm] = useState({
    site_id: '',
    product_id: '',
    date: new Date().toISOString().slice(0, 10),
    sample_ref: '',
    test_type: 'CS',
    result: '',
    unit: 'MPa',
    pass_fail: 'pending',
    lab: '',
  });

  const add = async () => {
    await post({
      entity: 'quality_tests',
      action: 'upsert',
      record: {
        ...form,
        site_id: form.site_id || null,
        product_id: form.product_id || null,
        result: form.result ? Number(form.result) : null,
      },
    });
    toast.success('Quality test saved');
  };

  return (
    <QuarrygraphWorkbench
      title="Quality lab"
      titleAccent="CS · grading"
      description="Record crushing strength, grading and other lab results against products and sites — pass/fail for release discipline."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="qg-trade"
            items={[
              { label: 'Tests', value: Number(summary?.qualityTests) || 0 },
              { label: 'Fails', value: Number(summary?.qualityFails) || 0 },
            ]}
          />
          <FormCard tone="qg-trade" title="Log test" onSubmit={() => void add()} saving={saving}>
            <select className={fieldClass()} value={form.site_id} onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value }))}>
              <option value="">Site…</option>
              {store.sites.map((s) => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </select>
            <select className={fieldClass()} value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}>
              <option value="">Product…</option>
              {store.products.map((p) => (
                <option key={p.id} value={p.id}>{p.code}</option>
              ))}
            </select>
            <input className={fieldClass()} type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            <input className={fieldClass()} placeholder="Sample ref" value={form.sample_ref} onChange={(e) => setForm((f) => ({ ...f, sample_ref: e.target.value }))} />
            <select className={fieldClass()} value={form.test_type} onChange={(e) => setForm((f) => ({ ...f, test_type: e.target.value }))}>
              {TESTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input className={fieldClass()} type="number" step="0.01" placeholder="Result" value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))} />
            <input className={fieldClass()} placeholder="Unit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            <select className={fieldClass()} value={form.pass_fail} onChange={(e) => setForm((f) => ({ ...f, pass_fail: e.target.value }))}>
              <option value="pending">Pending</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
            <input className={fieldClass()} placeholder="Lab" value={form.lab} onChange={(e) => setForm((f) => ({ ...f, lab: e.target.value }))} />
          </FormCard>
          <DataTable tone="qg-trade"
            headers={['Date', 'Sample', 'Site', 'Product', 'Test', 'Result', 'P/F', 'Lab']}
            rows={store.quality_tests.map((q) => {
              const site = store.sites.find((s) => s.id === q.site_id);
              const prod = store.products.find((p) => p.id === q.product_id);
              return {
                id: q.id,
                cells: [
                  q.date,
                  q.sample_ref || '—',
                  site?.code || '—',
                  prod?.code || '—',
                  q.test_type,
                  q.result != null ? `${q.result} ${q.unit || ''}` : '—',
                  q.pass_fail || '—',
                  q.lab || '—',
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'quality_tests', action: 'delete', id })}
          />
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
