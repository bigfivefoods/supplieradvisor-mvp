'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { VukaClassBoard } from '@/components/fitness/VukaClassBoard';
import {
  listSubscribeClasses,
  storeUsesClassSubscribe,
  VUKA_JOINING,
} from '@/lib/fitness/vuka-class-catalog';

const blankForm = () => ({
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

export default function MembershipsPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const subscribeClasses = store ? listSubscribeClasses(store) : [];
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [pt, setPt] = useState({
    client_id: '',
    coach_id: '',
    sessions_total: '10',
    price_zar: '',
  });

  const editing = useMemo(
    () =>
      editingId && store
        ? store.membership_plans.find((p) => p.id === editingId) || null
        : null,
    [store, editingId]
  );

  const startEdit = (id: string) => {
    const p = store?.membership_plans.find((x) => x.id === id);
    if (!p) {
      toast.error('Membership not found');
      return;
    }
    setEditingId(p.id);
    setForm({
      code: p.code || '',
      name: p.name || '',
      price_zar: p.price_zar != null ? String(p.price_zar) : '',
      billing: p.billing || 'monthly',
      class_credits:
        p.class_credits != null ? String(p.class_credits) : '',
      pt_credits: p.pt_credits != null ? String(p.pt_credits) : '',
      description: p.description || '',
      public: p.public !== false,
      access: p.access || 'classes',
      programme_id: p.programme_id || '',
    });
    requestAnimationFrame(() => {
      formAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(blankForm());
  };

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'membership_plans',
      action: 'upsert',
      record: {
        ...(editingId ? { id: editingId } : {}),
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
    toast.success(editingId ? 'Plan updated' : 'Plan saved');
    cancelEdit();
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
      title={classSubscribe ? 'Class subscriptions' : 'Membership plans'}
      titleAccent={classSubscribe ? '& PT packs' : '& PT packs'}
      description={
        classSubscribe
          ? 'Members subscribe to one or more of these classes. Their fee is the total of those classes. Assign a member on Subscriptions, or they pay on the member portal / website.'
          : 'Sellable memberships shown on your website. Members must pay first (Paystack / Apple Pay) before they can book classes. Assign desk-issued plans on Subscriptions.'
      }
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
          {classSubscribe ? (
            <VukaClassBoard
              classes={subscribeClasses}
              joining={
                store.settings?.joining_fee_zar != null
                  ? {
                      fee_zar: store.settings.joining_fee_zar,
                      waived: store.settings.joining_fee_waived,
                      note: store.settings.joining_fee_note || VUKA_JOINING.note,
                    }
                  : null
              }
              onEdit={startEdit}
            />
          ) : null}
          {store.settings?.joining_fee_zar != null && !classSubscribe ? (
            <p className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-950 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-100">
              Once-off joining R{store.settings.joining_fee_zar}
              {store.settings.joining_fee_waived
                ? ' — currently waived (free).'
                : '.'}{' '}
              {store.settings.joining_fee_note || ''}
            </p>
          ) : null}
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
          <div ref={formAnchorRef}>
          <FormCard
            tone="owner"
            title={
              editingId
                ? `Edit plan · ${editing?.name || form.name || '…'}`
                : 'Add plan'
            }
            description={
              editingId
                ? 'Update this membership. Existing subscriptions stay on this plan; price and credits apply from the next save.'
                : undefined
            }
            onSubmit={() => void add()}
            saving={saving}
            submitLabel={editingId ? 'Save changes' : 'Add plan'}
          >
            {editingId ? (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-yellow-700 dark:text-yellow-300 font-medium rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50/80 dark:bg-yellow-950/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Editing <strong>{editing?.code || editingId}</strong>
                </span>
                <button
                  type="button"
                  className="text-xs font-bold underline"
                  onClick={cancelEdit}
                >
                  Cancel · new plan
                </button>
              </p>
            ) : null}
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
          </div>
          <DataTable tone="owner"
            headers={['Code', 'Name', 'When', 'Price', 'Billing', 'Web']}
            rows={[...store.membership_plans]
              .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
              .map((p) => ({
              id: p.id,
              cells: [
                p.code,
                p.name,
                p.schedule_label || (p.addon ? 'Add-on' : '—'),
                p.price_zar,
                p.billing,
                p.public !== false ? 'Public' : 'Hidden',
              ],
            }))}
            onEdit={(id) => startEdit(id)}
            onDelete={(id) => {
              if (editingId === id) cancelEdit();
              void post({ entity: 'membership_plans', action: 'delete', id });
            }}
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
