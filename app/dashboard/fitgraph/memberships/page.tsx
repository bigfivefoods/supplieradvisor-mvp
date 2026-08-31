'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { ClassDeskTable } from '@/components/fitness/ClassDeskTable';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { storeUsesClassSubscribe } from '@/lib/fitness/vuka-class-catalog';

export default function MembershipsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { companyId, store, loading, saving, post, summary } = useFitgraph();
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const rosterPlanId = search.get('roster');

  useEffect(() => {
    if (store && classSubscribe) {
      const roster = rosterPlanId
        ? `?roster=${encodeURIComponent(rosterPlanId)}`
        : '';
      router.replace(`/dashboard/fitgraph/classes${roster}`);
    }
  }, [store, classSubscribe, router, rosterPlanId]);
  const [pt, setPt] = useState({
    client_id: '',
    coach_id: '',
    sessions_total: '10',
    price_zar: '',
  });

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
      title={classSubscribe ? 'Classes' : 'Memberships'}
      titleAccent={classSubscribe ? 'roster · coach · calendar' : 'plans · PT packs'}
      description={
        classSubscribe
          ? 'The class list. Open a row to set times, put it on the calendar, and save which members are booked to it.'
          : 'Plans in a list. Members pay first, then you allocate them on Clients. Open a plan to edit it.'
      }
    >
      {loading || !store || classSubscribe ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="owner"
            items={[
              {
                label: classSubscribe ? 'Classes' : 'Plans',
                value:
                  Number(summary?.planCount) || store.membership_plans.length,
              },
              {
                label: 'Active members',
                value: Number(summary?.activeSubscriptions) || 0,
              },
              {
                label: 'Coaches',
                value: store.coaches.filter((c) => c.active !== false).length,
              },
            ]}
          />
          {store.settings?.public_token ? (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm dark:border-yellow-800 dark:bg-yellow-950/40">
              <p className="font-black">New member onboarding</p>
              <p className="mt-1 text-[12px] text-slate-600 dark:text-yellow-100/80">
                Send the group or private contract form. Answers save on their
                profile for you only.
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-[12px] font-bold">
                <a
                  className="underline"
                  href={`/join/fitgraph/${encodeURIComponent(store.settings.public_token)}?kind=group`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Group class form
                </a>
                <a
                  className="underline"
                  href={`/join/fitgraph/${encodeURIComponent(store.settings.public_token)}?kind=private`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Private form
                </a>
              </div>
            </div>
          ) : null}
          {store.settings?.joining_fee_zar != null ? (
            <p className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-950 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-100">
              Once-off joining R{store.settings.joining_fee_zar}
              {store.settings.joining_fee_waived
                ? ' — currently waived (free).'
                : '.'}{' '}
              {store.settings.joining_fee_note || ''}
            </p>
          ) : null}
          <p className="rounded-2xl border border-yellow-100 bg-yellow-50/70 px-4 py-3 text-xs text-slate-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-100">
            {classSubscribe ? (
              <>
                Tick members on a class and press <strong>Save booked members</strong> —
                they stay booked on the calendar. You can also save a member’s
                classes from{' '}
                <a
                  href="/dashboard/fitgraph/clients"
                  className="font-bold text-yellow-800 underline dark:text-yellow-200"
                >
                  Clients
                </a>
                .
              </>
            ) : (
              <>
                Allocate people on{' '}
                <a
                  href="/dashboard/fitgraph/clients"
                  className="font-bold text-yellow-800 underline dark:text-yellow-200"
                >
                  Clients
                </a>
                .
              </>
            )}
          </p>

          <ClassDeskTable
            store={store}
            post={post}
            saving={saving}
            classSubscribe={classSubscribe}
            companyId={companyId}
            initialRosterId={rosterPlanId}
          />

          {!classSubscribe ? (
            <>
              <FormCard
                tone="owner"
                title="Issue PT pack"
                onSubmit={() => void addPt()}
                saving={saving}
                submitLabel="Issue pack"
              >
                <select
                  className={fc()}
                  value={pt.client_id}
                  onChange={(e) =>
                    setPt((f) => ({ ...f, client_id: e.target.value }))
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
                  value={pt.coach_id}
                  onChange={(e) =>
                    setPt((f) => ({ ...f, coach_id: e.target.value }))
                  }
                >
                  <option value="">Coach…</option>
                  {store.coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  className={fc()}
                  type="number"
                  placeholder="Sessions"
                  value={pt.sessions_total}
                  onChange={(e) =>
                    setPt((f) => ({ ...f, sessions_total: e.target.value }))
                  }
                />
                <input
                  className={fc()}
                  type="number"
                  placeholder="Price ZAR"
                  value={pt.price_zar}
                  onChange={(e) =>
                    setPt((f) => ({ ...f, price_zar: e.target.value }))
                  }
                />
              </FormCard>
              <DataTable
                tone="owner"
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
                onDelete={(id) =>
                  void post({ entity: 'pt_packs', action: 'delete', id })
                }
              />
            </>
          ) : null}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
