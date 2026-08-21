'use client';

import { toast } from 'sonner';
import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { AdvisorPortalPreviewDesk } from '@/components/advisors/AdvisorPortalPreviewDesk';
import {
  advisorPublicEmbedPath,
  portalSectionsToLegacyFlags,
} from '@/lib/advisors/portal-sections';

export default function PhysiographPortalPage() {
  const { store, loading, saving, post } = usePhysiograph();
  const token = store?.settings?.public_token || '';

  return (
    <PhysiographWorkbench
      title="View portal"
      titleAccent="patient app · website"
      description="Publish a branded home-screen app for patients, then preview the patient PWA and optional public website."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <AdvisorPortalPreviewDesk
          module="physiograph"
          eyebrow="PhysioAdvisor®"
          embedPath={
            token ? advisorPublicEmbedPath('physiograph', token) : ''
          }
          settings={store.settings}
          websiteHref="/dashboard/physiograph/website"
          saving={saving}
          onSave={async (sections) => {
            await post({
              action: 'update_settings',
              settings: {
                portal_sections: sections,
                ...portalSectionsToLegacyFlags('physiograph', sections),
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
    </PhysiographWorkbench>
  );
}
