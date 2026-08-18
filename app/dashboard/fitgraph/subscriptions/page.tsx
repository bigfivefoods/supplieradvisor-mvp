'use client';

import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { MemberAllocateTable } from '@/components/fitness/MemberAllocateTable';
import { StatRow } from '@/components/fitness/FitForm';
import { storeUsesClassSubscribe } from '@/lib/fitness/vuka-class-catalog';

export default function SubscriptionsPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const subs = store?.subscriptions || [];
  const activeCount = subs.filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  ).length;

  return (
    <FitgraphWorkbench
      title="Subscriptions"
      titleAccent="members · private clients"
      description="Same desk as Membership: member or private client, class, coach, membership rate vs agreed client rate, and status."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-5">
          <StatRow
            tone="owner"
            items={[
              {
                label: 'Active / trial',
                value: Number(summary?.activeSubscriptions) || activeCount,
              },
              { label: 'All records', value: subs.length },
              {
                label: classSubscribe ? 'Classes' : 'Plans',
                value: Number(summary?.planCount) || 0,
              },
            ]}
          />
          <MemberAllocateTable
            store={store}
            post={post}
            saving={saving}
            classSubscribe={classSubscribe}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
