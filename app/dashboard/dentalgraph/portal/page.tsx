'use client';

import { toast } from 'sonner';
import {
  DentalgraphWorkbench,
  LoadingBlock,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { AdvisorPortalPreviewDesk } from '@/components/advisors/AdvisorPortalPreviewDesk';
import {
  advisorPublicEmbedPath,
  portalSectionsToLegacyFlags,
} from '@/lib/advisors/portal-sections';

export default function DentalgraphPortalPage() {
  const { store, loading, saving, post } = useDentalgraph();
  const token = store?.settings?.public_token || '';

  return (
    <DentalgraphWorkbench
      title="View portal"
      titleAccent="patient app · website"
      description="Publish a branded home-screen app for patients, then preview the patient PWA and optional public website."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <AdvisorPortalPreviewDesk
          module="dentalgraph"
          eyebrow="DentalAdvisor®"
          embedPath={
            token ? advisorPublicEmbedPath('dentalgraph', token) : ''
          }
          settings={store.settings}
          websiteHref="/dashboard/dentalgraph/website"
          saving={saving}
          onSave={async (sections) => {
            await post({
              action: 'update_settings',
              settings: {
                portal_sections: sections,
                ...portalSectionsToLegacyFlags('dentalgraph', sections),
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
    </DentalgraphWorkbench>
  );
}
