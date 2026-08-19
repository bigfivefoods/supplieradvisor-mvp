'use client';

import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { AdvisorPortalPreviewDesk } from '@/components/advisors/AdvisorPortalPreviewDesk';
import {
  advisorPublicEmbedPath,
  portalSectionsToLegacyFlags,
} from '@/lib/advisors/portal-sections';

export default function FitgraphPortalPage() {
  const { store, loading, saving, post } = useFitgraph();
  const token = store?.settings?.public_token || '';

  return (
    <FitgraphWorkbench
      title="View portal"
      titleAccent="member app · website"
      description="See the member PWA and the optional public website. Choose which sections appear on the site."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <AdvisorPortalPreviewDesk
          module="fitgraph"
          eyebrow="GymAdvisor®"
          embedPath={
            token ? advisorPublicEmbedPath('fitgraph', token) : ''
          }
          settings={store.settings}
          websiteHref="/dashboard/fitgraph/website"
          saving={saving}
          onSave={async (sections) => {
            await post({
              action: 'update_settings',
              settings: {
                portal_sections: sections,
                ...portalSectionsToLegacyFlags('fitgraph', sections),
              },
            });
            toast.success('Portal sections saved');
          }}
        />
      )}
    </FitgraphWorkbench>
  );
}
