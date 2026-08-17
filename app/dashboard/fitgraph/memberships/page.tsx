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
    description: '',
    public: true,
    access: 'classes',
    programme_id: '',
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
        description: form.description.trim() || undefined,
        public: form.public,
        access: form.access,
        programme_id: form.programme_id || null,
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
      description="Sellable memberships shown on your website. Members must pay first (Paystack / Apple Pay) before they can book classes. Assign desk-issued plans on Subscriptions."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="owner"
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
              className="font-bold text-yellow-700 underline dark:text-yellow-300"
            >
              Subscriptions
            </a>
            .
          </p>
          <FormCard tone="owner" title="Add plan" onSubmit={() => void add()} saving={saving}>
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
            <textarea
              className={fc() + ' min-h-[3rem] resize-y sm:col-span-2'}
              placeholder="What this membership includes (shown on the public shop)"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <select
              className={fc()}
              value={form.access}
              onChange={(e) =>
                setForm((f) => ({ ...f, access: e.target.value }))
              }
            >
              <option value="classes">Unlocks classes</option>
              <option value="programme">Unlocks a programme</option>
              <option value="both">Classes + programme</option>
            </select>
            <select
              className={fc()}
              value={form.programme_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, programme_id: e.target.value }))
              }
            >
              <option value="">Include programme (optional)…</option>
              {(store.programmes || [])
                .filter((p) => p.active !== false && p.personal_for_coach !== true)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <label className="flex items-center gap-2 text-sm font-medium col-span-full">
              <input
                type="checkbox"
                checked={form.public}
                onChange={(e) =>
                  setForm((f) => ({ ...f, public: e.target.checked }))
                }
              />
              Sell on website (public priced plans require Paystack / Apple Pay first)
            </label>
          </FormCard>
          <DataTable tone="owner"
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

          <FormCard tone="owner" title="Issue PT pack" onSubmit={() => void addPt()} saving={saving} submitLabel="Issue pack">
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
          <DataTable tone="owner"
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
