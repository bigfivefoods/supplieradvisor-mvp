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

const TYPES = [
  'Mining right',
  'Water use licence',
  'EMP / EA',
  'Air quality',
  'Explosives permit',
  'Municipal by-law',
  'Other',
];

export default function QuarryCompliancePage() {
  const { store, loading, saving, post, summary } = useQuarrygraph();
  const [form, setForm] = useState({
    site_id: '',
    type: 'Mining right',
    ref_no: '',
    issued_at: '',
    expires_at: '',
    status: 'valid',
  });

  const add = async () => {
    if (!form.ref_no.trim()) {
      toast.error('Reference number required');
      return;
    }
    await post({
      entity: 'permits',
      action: 'upsert',
      record: {
        ...form,
        site_id: form.site_id || null,
        issued_at: form.issued_at || null,
        expires_at: form.expires_at || null,
      },
    });
    toast.success('Permit saved (expiry auto-flagged)');
  };

  return (
    <QuarrygraphWorkbench
      title="Compliance"
      titleAccent="permits"
      description="Mining rights, water use licences, EMP/EA and other permits — expiring and expired status from dates."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="qg-office"
            items={[
              { label: 'Permits', value: Number(summary?.permits) || 0 },
              {
                label: 'Expiring / expired',
                value: Number(summary?.permitsExpiring) || 0,
              },
            ]}
          />
          <FormCard tone="qg-office" title="Add permit" onSubmit={() => void add()} saving={saving}>
            <select className={fieldClass()} value={form.site_id} onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value }))}>
              <option value="">Site…</option>
              {store.sites.map((s) => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </select>
            <select className={fieldClass()} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input className={fieldClass()} placeholder="Reference no." value={form.ref_no} onChange={(e) => setForm((f) => ({ ...f, ref_no: e.target.value }))} />
            <input className={fieldClass()} type="date" value={form.issued_at} onChange={(e) => setForm((f) => ({ ...f, issued_at: e.target.value }))} />
            <input className={fieldClass()} type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
            <select className={fieldClass()} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="valid">Valid</option>
              <option value="pending">Pending</option>
              <option value="expiring">Expiring</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
          </FormCard>
          <DataTable tone="qg-office"
            headers={['Type', 'Ref', 'Site', 'Issued', 'Expires', 'Status']}
            rows={store.permits.map((p) => {
              const site = store.sites.find((s) => s.id === p.site_id);
              return {
                id: p.id,
                cells: [
                  p.type,
                  p.ref_no,
                  site?.code || '—',
                  p.issued_at || '—',
                  p.expires_at || '—',
                  p.status,
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'permits', action: 'delete', id })}
          />
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
