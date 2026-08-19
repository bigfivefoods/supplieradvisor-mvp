'use client';

import Link from 'next/link';
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
  const onClassIds = new Set(activeSubs.map((s) => s.client_id));
  const memberCount = people.filter(
    (c) => onClassIds.has(c.id) || Boolean(c.membership_plan_id)
  ).length;
  const bothCount = people.filter(
    (c) =>
      c.private_client === true &&
      (onClassIds.has(c.id) || Boolean(c.membership_plan_id))
  ).length;

  return (
    <FitgraphWorkbench
      title="Membership"
      titleAccent="members · private clients"
      description={
        classSubscribe
          ? 'A person can be a member, a private client, or both. Tick every class they are booked to, then Save — they land on the calendar for those classes.'
          : 'A person can be a member, a private client, or both. Members get a plan and a class actual rate. Private clients get a coach and a private rate.'
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
              { label: 'Members', value: memberCount },
              { label: 'Private clients', value: privateCount },
              { label: 'Both', value: bothCount },
            ]}
          />
          <MemberAllocateTable
            store={store}
            post={post}
            saving={saving}
            classSubscribe={classSubscribe}
          />
          <p className="text-[12px] text-slate-500">
            Invoices are monthly memberships (the class / private rate), not
            after each class.{' '}
            <Link
              href="/dashboard/fitgraph/accounts"
              className="font-bold text-yellow-800 underline"
            >
              Send this month’s invoices
            </Link>
          </p>
        </div>
      )}
    </FitgraphWorkbench>
  );
}
