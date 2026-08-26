'use client';

import { toast } from 'sonner';
import {
  LoadingBlock,
  VetgraphWorkbench,
  useVetgraph,
} from '@/components/clinic/VetgraphWorkbench';
import { AdvisorPortalPreviewDesk } from '@/components/advisors/AdvisorPortalPreviewDesk';
import {
  advisorPublicEmbedPath,
  portalSectionsToLegacyFlags,
} from '@/lib/advisors/portal-sections';

export default function VetgraphPortalPage() {
  const { store, loading, saving, post } = useVetgraph();
  const token = store?.settings?.public_token || '';

  return (
    <VetgraphWorkbench
      title="View portal"
      titleAccent="patient app · website"
      description="Publish a branded home-screen app for patients, then preview the patient PWA and optional public website."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <AdvisorPortalPreviewDesk
          module="vetgraph"
          eyebrow="VetAdvisor®"
          embedPath={
            token ? advisorPublicEmbedPath('vetgraph', token) : ''
          }
          settings={store.settings}
          websiteHref="/dashboard/vetgraph/website"
          saving={saving}
          onSave={async (sections) => {
            await post({
              action: 'update_settings',
              settings: {
                portal_sections: sections,
                ...portalSectionsToLegacyFlags('vetgraph', sections),
              },
            });
            toast.success('Portal sections saved');
          }}
          onSavePwa={async (pwa) => {
            await post({
              action: 'update_settings',
              settings: pwa,
            });
          }}
        />
      )}
    </VetgraphWorkbench>
  );
}
