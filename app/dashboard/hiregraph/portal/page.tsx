'use client';

import { toast } from 'sonner';
import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import { AdvisorPortalPreviewDesk } from '@/components/advisors/AdvisorPortalPreviewDesk';
import {
  advisorPublicEmbedPath,
  portalSectionsToLegacyFlags,
} from '@/lib/advisors/portal-sections';

export default function HiregraphPortalPage() {
  const { store, loading, saving, post } = useHiregraph();
  const token = store?.settings?.public_token || '';

  return (
    <HiregraphWorkbench
      title="View portal"
      titleAccent="hirer app · website"
      description="Publish a branded home-screen app for hirers, then preview the customer PWA and optional public website."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <AdvisorPortalPreviewDesk
          module="hiregraph"
          eyebrow="HireAdvisor®"
          embedPath={
            token ? advisorPublicEmbedPath('hiregraph', token) : ''
          }
          settings={store.settings}
          websiteHref="/dashboard/hiregraph/website"
          saving={saving}
          onSave={async (sections) => {
            await post({
              action: 'update_settings',
              settings: {
                portal_sections: sections,
                ...portalSectionsToLegacyFlags('hiregraph', sections),
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
    </HiregraphWorkbench>
  );
}
