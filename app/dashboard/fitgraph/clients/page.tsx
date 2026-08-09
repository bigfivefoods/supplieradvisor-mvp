'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { MEMBERSHIP_STATUSES } from '@/lib/fitness/fitgraph';

export default function ClientsPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    membership_plan_id: '',
    membership_status: 'active',
    coach_id: '',
    start_date: new Date().toISOString().slice(0, 10),
  });

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'clients',
      action: 'upsert',
      record: {
        ...form,
        membership_plan_id: form.membership_plan_id || null,
        coach_id: form.coach_id || null,
      },
    });
    toast.success('Client saved');
    setForm((f) => ({ ...f, code: '', name: '', email: '', phone: '' }));
  };

  return (
    <FitgraphWorkbench
      title="Clients / members"
      titleAccent="member book"
      description="Member register with plan, status and optional coach assignment."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              { label: 'Clients', value: Number(summary?.clientCount) || 0 },
              { label: 'Active', value: Number(summary?.activeMembers) || 0 },
            ]}
          />
          <FormCard title="Add client" onSubmit={() => void add()} saving={saving}>
            <input className={fc()} placeholder="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <input className={fc()} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className={fc()} placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input className={fc()} placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <select className={fc()} value={form.membership_plan_id} onChange={(e) => setForm((f) => ({ ...f, membership_plan_id: e.target.value }))}>
              <option value="">Plan…</option>
              {store.membership_plans.map((p) => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
              ))}
            </select>
            <select className={fc()} value={form.membership_status} onChange={(e) => setForm((f) => ({ ...f, membership_status: e.target.value }))}>
              {MEMBERSHIP_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className={fc()} value={form.coach_id} onChange={(e) => setForm((f) => ({ ...f, coach_id: e.target.value }))}>
              <option value="">Coach (optional)…</option>
              {store.coaches.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input className={fc()} type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          </FormCard>
          <DataTable
            headers={['Code', 'Name', 'Plan', 'Status', 'Coach', 'Phone']}
            rows={store.clients.map((c) => {
              const plan = store.membership_plans.find((p) => p.id === c.membership_plan_id);
              const coach = store.coaches.find((x) => x.id === c.coach_id);
              return {
                id: c.id,
                cells: [
                  c.code,
                  c.name,
                  plan?.code || '—',
                  c.membership_status || '—',
                  coach?.name || '—',
                  c.phone || '—',
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'clients', action: 'delete', id })}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
