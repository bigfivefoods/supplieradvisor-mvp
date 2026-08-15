'use client';

import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { StatRow } from '@/components/fitness/FitForm';
import { AdvisorAnnouncementsDesk } from '@/components/services/AdvisorAnnouncementsDesk';

export default function FitgraphCommsPage() {
  const { store, loading, saving, post } = useFitgraph();
  const rows = store?.announcements || [];
  const live = rows.filter((r) => r.status === 'published').length;

  return (
    <FitgraphWorkbench
      title="Comms"
      titleAccent="all members"
      description="Push notices, ads and offers to every member on the gym portal."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              { label: 'Live', value: live },
              { label: 'Drafts', value: rows.filter((r) => r.status === 'draft').length },
              { label: 'Members', value: (store.clients || []).length },
            ]}
          />
          <AdvisorAnnouncementsDesk
            items={store.announcements}
            post={post}
            saving={saving}
            accentClass="border-yellow-200"
            buttonClass="bg-[#E8E830] hover:bg-yellow-400 text-slate-900"
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
