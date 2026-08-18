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
      titleAccent="what patients see"
      description="Preview your MedicalAdvisor® portal and choose which sections are public."
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
        />
      )}
    </MedicalgraphWorkbench>
  );
}
