'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';

export default function CheckinsPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const [form, setForm] = useState({
    client_id: '',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toISOString().slice(11, 16),
    method: 'front_desk',
    session_id: '',
  });

  const add = async () => {
    if (!form.client_id) {
      toast.error('Select client');
      return;
    }
    await post({
      entity: 'check_ins',
      action: 'upsert',
      record: {
        ...form,
        session_id: form.session_id || null,
      },
    });
    toast.success('Check-in recorded');
  };

  return (
    <FitgraphWorkbench
      title="Check-ins"
      titleAccent="front desk"
      description="Log member check-ins at reception or against a class session."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="owner"
            items={[
              {
                label: 'Today',
                value: Number(summary?.checkInsToday) || 0,
              },
              {
                label: 'All time',
                value: Number(summary?.checkInsTotal) || store.check_ins.length,
              },
            ]}
          />
          <FormCard tone="owner" title="Check in member" onSubmit={() => void add()} saving={saving} submitLabel="Check in">
            <select className={fc()} value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
              <option value="">Client…</option>
              {store.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
              ))}
            </select>
            <input className={fc()} type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            <input className={fc()} type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
            <select className={fc()} value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
              <option value="front_desk">Front desk</option>
              <option value="app">App</option>
              <option value="class">Class</option>
              <option value="other">Other</option>
            </select>
            <select className={fc()} value={form.session_id} onChange={(e) => setForm((f) => ({ ...f, session_id: e.target.value }))}>
              <option value="">Session (optional)…</option>
              {store.sessions
                .filter((s) => s.date === form.date)
                .map((s) => {
                  const ct = store.class_types.find((c) => c.id === s.class_type_id);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.start_time} · {ct?.name}
                    </option>
                  );
                })}
            </select>
          </FormCard>
          <DataTable tone="owner"
            headers={['Date', 'Time', 'Client', 'Method', 'Session']}
            rows={[...store.check_ins]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((c) => {
                const client = store.clients.find((x) => x.id === c.client_id);
                const ses = store.sessions.find((s) => s.id === c.session_id);
                const ct = store.class_types.find((t) => t.id === ses?.class_type_id);
                return {
                  id: c.id,
                  cells: [
                    c.date,
                    c.time || '—',
                    client?.name || c.client_id,
                    c.method || '—',
                    ct?.name || '—',
                  ],
                };
              })}
            onDelete={(id) => void post({ entity: 'check_ins', action: 'delete', id })}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
