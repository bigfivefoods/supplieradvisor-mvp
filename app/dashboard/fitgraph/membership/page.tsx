'use client';

import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { MemberAllocateTable } from '@/components/fitness/MemberAllocateTable';
import { StatRow } from '@/components/fitness/FitForm';
import { storeUsesClassSubscribe } from '@/lib/fitness/vuka-class-catalog';

export default function MembershipAllocatePage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const people = (store?.clients || []).filter((c) => c.active !== false);
  const activeSubs = (store?.subscriptions || []).filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  );
  const privateCount = people.filter((c) => c.private_client === true).length;

  return (
    <FitgraphWorkbench
      title="Membership"
      titleAccent="members · private clients"
      description={
        classSubscribe
          ? 'Mark each person as a member (class + coach) or a private client (coach). Membership rate is the class list price. Client actual rate is the agreed amount.'
          : 'Mark each person as a member (plan + coach) or a private client (coach). Membership rate is the plan price. Client actual rate is the agreed amount.'
      }
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-5">
          <StatRow
            tone="owner"
            items={[
              { label: 'People', value: people.length },
              {
                label: 'Members',
                value: people.length - privateCount,
              },
              { label: 'Private clients', value: privateCount },
              {
                label: 'On a class',
                value:
                  Number(summary?.activeSubscriptions) || activeSubs.length,
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
