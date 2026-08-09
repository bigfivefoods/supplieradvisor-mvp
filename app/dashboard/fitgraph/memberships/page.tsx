'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';

export default function MembershipsPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    price_zar: '',
    billing: 'monthly',
    class_credits: '',
    pt_credits: '',
  });
  const [pt, setPt] = useState({
    client_id: '',
    coach_id: '',
    sessions_total: '10',
    price_zar: '',
  });

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'membership_plans',
      action: 'upsert',
      record: {
        ...form,
        price_zar: Number(form.price_zar) || 0,
        class_credits: form.class_credits ? Number(form.class_credits) : null,
        pt_credits: form.pt_credits ? Number(form.pt_credits) : null,
      },
    });
    toast.success('Plan saved');
  };

  const addPt = async () => {
    if (!pt.client_id) {
      toast.error('Select client');
      return;
    }
    await post({
      entity: 'pt_packs',
      action: 'upsert',
      record: {
        ...pt,
        coach_id: pt.coach_id || null,
        sessions_total: Number(pt.sessions_total) || 0,
        sessions_used: 0,
        price_zar: pt.price_zar ? Number(pt.price_zar) : null,
      },
    });
    toast.success('PT pack issued');
  };

  return (
    <FitgraphWorkbench
      title="Membership plans"
      titleAccent="& PT packs"
      description="Sellable memberships (monthly, packs) shown on your website pricing. Assign plans to members via Subscriptions; issue PT session packs here."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              { label: 'Plans', value: Number(summary?.planCount) || 0 },
              {
                label: 'Active subs',
                value: Number(summary?.activeSubscriptions) || 0,
              },
              {
                label: 'PT sessions left',
                value: Number(summary?.ptSessionsRemaining) || 0,
              },
            ]}
          />
          <p className="text-xs text-slate-600">
            Manage member billing status on{' '}
            <a
              href="/dashboard/fitgraph/subscriptions"
              className="font-bold text-violet-700 underline"
            >
              Subscriptions
            </a>
            .
          </p>
          <FormCard title="Add plan" onSubmit={() => void add()} saving={saving}>
            <input className={fc()} placeholder="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <input className={fc()} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className={fc()} type="number" placeholder="Price ZAR" value={form.price_zar} onChange={(e) => setForm((f) => ({ ...f, price_zar: e.target.value }))} />
            <select className={fc()} value={form.billing} onChange={(e) => setForm((f) => ({ ...f, billing: e.target.value }))}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="annual">Annual</option>
              <option value="pack">Pack</option>
              <option value="drop_in">Drop-in</option>
            </select>
            <input className={fc()} type="number" placeholder="Class credits (blank = unlimited)" value={form.class_credits} onChange={(e) => setForm((f) => ({ ...f, class_credits: e.target.value }))} />
            <input className={fc()} type="number" placeholder="PT credits" value={form.pt_credits} onChange={(e) => setForm((f) => ({ ...f, pt_credits: e.target.value }))} />
          </FormCard>
          <DataTable
            headers={['Code', 'Name', 'Price', 'Billing', 'Class cr.', 'PT cr.', 'Web']}
            rows={store.membership_plans.map((p) => ({
              id: p.id,
              cells: [
                p.code,
                p.name,
                p.price_zar,
                p.billing,
                p.class_credits ?? '∞',
                p.pt_credits ?? '—',
                p.public !== false ? 'Public' : 'Hidden',
              ],
            }))}
            onDelete={(id) => void post({ entity: 'membership_plans', action: 'delete', id })}
          />

          <FormCard title="Issue PT pack" onSubmit={() => void addPt()} saving={saving} submitLabel="Issue pack">
            <select className={fc()} value={pt.client_id} onChange={(e) => setPt((f) => ({ ...f, client_id: e.target.value }))}>
              <option value="">Client…</option>
              {store.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
              ))}
            </select>
            <select className={fc()} value={pt.coach_id} onChange={(e) => setPt((f) => ({ ...f, coach_id: e.target.value }))}>
              <option value="">Coach…</option>
              {store.coaches.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input className={fc()} type="number" placeholder="Sessions" value={pt.sessions_total} onChange={(e) => setPt((f) => ({ ...f, sessions_total: e.target.value }))} />
            <input className={fc()} type="number" placeholder="Price ZAR" value={pt.price_zar} onChange={(e) => setPt((f) => ({ ...f, price_zar: e.target.value }))} />
          </FormCard>
          <DataTable
            headers={['Client', 'Coach', 'Used / Total', 'Purchased', 'Price']}
            rows={store.pt_packs.map((p) => {
              const client = store.clients.find((c) => c.id === p.client_id);
              const coach = store.coaches.find((c) => c.id === p.coach_id);
              return {
                id: p.id,
                cells: [
                  client?.name || p.client_id,
                  coach?.name || '—',
                  `${p.sessions_used} / ${p.sessions_total}`,
                  p.purchased_at,
                  p.price_zar ?? '—',
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'pt_packs', action: 'delete', id })}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
