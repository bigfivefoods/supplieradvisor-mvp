'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import {
  DataTable,
  FormCard,
  ListRowCard,
  StatRow,
  fc,
} from '@/components/fitness/FitForm';

const STATUSES = [
  'active',
  'trialing',
  'past_due',
  'paused',
  'cancelled',
  'expired',
] as const;

export default function SubscriptionsPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    client_id: '',
    plan_id: '',
    status: 'active' as string,
    started_at: today,
    current_period_end: '',
    auto_renew: true,
    class_credits_remaining: '',
    notes: '',
  });

  const subs = store?.subscriptions || [];

  const activeCount = useMemo(
    () =>
      subs.filter((s) => s.status === 'active' || s.status === 'trialing')
        .length,
    [subs]
  );

  const add = async () => {
    if (!form.client_id || !form.plan_id) {
      toast.error('Select client and plan');
      return;
    }
    await post({
      entity: 'subscriptions',
      action: 'upsert',
      record: {
        client_id: form.client_id,
        plan_id: form.plan_id,
        status: form.status,
        started_at: form.started_at,
        current_period_end: form.current_period_end || null,
        auto_renew: form.auto_renew,
        class_credits_remaining: form.class_credits_remaining
          ? Number(form.class_credits_remaining)
          : null,
        notes: form.notes || undefined,
      },
    });
    toast.success('Subscription saved — client membership synced');
    setForm((f) => ({
      ...f,
      client_id: '',
      plan_id: '',
      notes: '',
      class_credits_remaining: '',
    }));
  };

  const setStatus = async (
    id: string,
    status: (typeof STATUSES)[number]
  ) => {
    const row = subs.find((s) => s.id === id);
    if (!row) return;
    await post({
      entity: 'subscriptions',
      action: 'upsert',
      record: { ...row, status },
    });
    toast.success(`Status → ${status}`);
  };

  return (
    <FitgraphWorkbench
      title="Subscriptions"
      titleAccent="members"
      description="Active member subscriptions linked to plans. Status updates sync membership on the client record. Packs track remaining class credits."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="owner"
            items={[
              {
                label: 'Active / trial',
                value:
                  Number(summary?.activeSubscriptions) || activeCount,
              },
              { label: 'All subs', value: subs.length },
              {
                label: 'Plans',
                value: Number(summary?.planCount) || 0,
              },
            ]}
          />

          <FormCard tone="owner"
            title="Start / update subscription"
            onSubmit={() => void add()}
            saving={saving}
            submitLabel="Save subscription"
          >
            <select
              className={fc()}
              value={form.client_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, client_id: e.target.value }))
              }
            >
              <option value="">Client…</option>
              {store.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
            <select
              className={fc()}
              value={form.plan_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, plan_id: e.target.value }))
              }
            >
              <option value="">Plan…</option>
              {store.membership_plans
                .filter((p) => p.active !== false)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · R{p.price_zar}/{p.billing}
                  </option>
                ))}
            </select>
            <select
              className={fc()}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              className={fc()}
              type="date"
              value={form.started_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, started_at: e.target.value }))
              }
            />
            <input
              className={fc()}
              type="date"
              placeholder="Period end"
              value={form.current_period_end}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  current_period_end: e.target.value,
                }))
              }
            />
            <input
              className={fc()}
              type="number"
              placeholder="Class credits remaining (blank = plan default)"
              value={form.class_credits_remaining}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  class_credits_remaining: e.target.value,
                }))
              }
            />
            <label className="flex items-center gap-2 text-sm font-medium px-1">
              <input
                type="checkbox"
                checked={form.auto_renew}
                onChange={(e) =>
                  setForm((f) => ({ ...f, auto_renew: e.target.checked }))
                }
              />
              Auto-renew
            </label>
            <input
              className={fc()}
              placeholder="Notes"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </FormCard>

          <div className="space-y-2">
            {subs.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                No subscriptions yet. Create plans under Memberships, then start
                a sub for a client.
              </p>
            ) : (
              subs.map((s) => {
                const client = store.clients.find((c) => c.id === s.client_id);
                const plan = store.membership_plans.find(
                  (p) => p.id === s.plan_id
                );
                return (
                  <ListRowCard
                    key={s.id}
                    tone="owner"
                    actions={
                      <>
                        {s.status === 'active' || s.status === 'trialing' ? (
                          <>
                            <button
                              type="button"
                              className="text-xs font-bold text-amber-700 dark:text-amber-300"
                              onClick={() => void setStatus(s.id, 'paused')}
                            >
                              Pause
                            </button>
                            <button
                              type="button"
                              className="text-xs font-bold text-rose-600 dark:text-rose-400"
                              onClick={() => void setStatus(s.id, 'cancelled')}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="text-xs font-bold text-emerald-700 dark:text-emerald-300"
                            onClick={() => void setStatus(s.id, 'active')}
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-xs font-bold text-slate-500 dark:text-violet-300/70"
                          onClick={() =>
                            void post({
                              entity: 'subscriptions',
                              action: 'delete',
                              id: s.id,
                            })
                          }
                        >
                          Delete
                        </button>
                      </>
                    }
                  >
                    <div className="font-bold text-sm text-slate-900 dark:text-violet-50">
                      {client?.name || s.client_id} · {plan?.name || 'Plan'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-violet-200/80">
                      {s.status} · started {s.started_at}
                      {s.current_period_end
                        ? ` · ends ${s.current_period_end}`
                        : ''}
                      {s.class_credits_remaining != null
                        ? ` · ${s.class_credits_remaining} credits left`
                        : ' · unlimited / plan'}
                      {s.auto_renew ? ' · auto-renew' : ''}
                    </div>
                  </ListRowCard>
                );
              })
            )}
          </div>

          <DataTable tone="owner"
            headers={[
              'Client',
              'Plan',
              'Status',
              'Started',
              'Period end',
              'Credits',
              'Renew',
            ]}
            rows={subs.map((s) => {
              const client = store.clients.find((c) => c.id === s.client_id);
              const plan = store.membership_plans.find(
                (p) => p.id === s.plan_id
              );
              return {
                id: s.id,
                cells: [
                  client?.name || '—',
                  plan?.name || '—',
                  s.status,
                  s.started_at,
                  s.current_period_end || '—',
                  s.class_credits_remaining ?? '∞',
                  s.auto_renew ? 'Yes' : 'No',
                ],
              };
            })}
            onDelete={(id) =>
              void post({ entity: 'subscriptions', action: 'delete', id })
            }
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
