'use client';

import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import { StatRow } from '@/components/hire/SimpleEntityForm';
import { AdvisorAnnouncementsDesk } from '@/components/services/AdvisorAnnouncementsDesk';

export default function HiregraphCommsPage() {
  const { store, coreCustomers, loading, saving, post } = useHiregraph();
  const rows = store?.announcements || [];

  return (
    <HiregraphWorkbench
      title="Comms"
      titleAccent="all hirers"
      description="Push notices, ads and offers to every hirer on the HireAdvisor portal and SA Member."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Live',
                value: rows.filter((r) => r.status === 'published').length,
              },
              {
                label: 'Drafts',
                value: rows.filter((r) => r.status === 'draft').length,
              },
              { label: 'Customers', value: coreCustomers.length },
            ]}
          />
          <AdvisorAnnouncementsDesk
            items={store.announcements}
            post={post}
            saving={saving}
            accentClass="border-cyan-200"
            buttonClass="bg-cyan-600 hover:bg-cyan-700 text-white"
          />
        </div>
      )}
    </HiregraphWorkbench>
  );
}
