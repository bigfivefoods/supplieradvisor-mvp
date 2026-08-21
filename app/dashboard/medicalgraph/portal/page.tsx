'use client';

import { toast } from 'sonner';
import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import { AdvisorPortalPreviewDesk } from '@/components/advisors/AdvisorPortalPreviewDesk';
import {
  advisorPublicEmbedPath,
  portalSectionsToLegacyFlags,
} from '@/lib/advisors/portal-sections';

export default function MedicalgraphPortalPage() {
  const { store, loading, saving, post } = useMedicalgraph();
  const token = store?.settings?.public_token || '';

  return (
    <MedicalgraphWorkbench
      title="View portal"
      titleAccent="patient app · website"
      description="Publish a branded home-screen app for patients, then preview the patient PWA and optional public website."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <AdvisorPortalPreviewDesk
          module="medicalgraph"
          eyebrow="MedicalAdvisor®"
          embedPath={
            token ? advisorPublicEmbedPath('medicalgraph', token) : ''
          }
          settings={store.settings}
          websiteHref="/dashboard/medicalgraph/website"
          saving={saving}
          onSave={async (sections) => {
            await post({
              action: 'update_settings',
              settings: {
                portal_sections: sections,
                ...portalSectionsToLegacyFlags('medicalgraph', sections),
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
    </MedicalgraphWorkbench>
  );
}
