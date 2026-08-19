'use client';

import { toast } from 'sonner';
import {
  LoadingBlock,
  PsychiatrygraphWorkbench,
  usePsychiatrygraph,
} from '@/components/clinic/PsychiatrygraphWorkbench';
import { AdvisorPortalPreviewDesk } from '@/components/advisors/AdvisorPortalPreviewDesk';
import {
  advisorPublicEmbedPath,
  portalSectionsToLegacyFlags,
} from '@/lib/advisors/portal-sections';

export default function PsychiatrygraphPortalPage() {
  const { store, loading, saving, post } = usePsychiatrygraph();
  const token = store?.settings?.public_token || '';

  return (
    <PsychiatrygraphWorkbench
      title="View portal"
      titleAccent="patient app · website"
      description="See the patient PWA and the optional public website. Choose which sections appear on the site."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <AdvisorPortalPreviewDesk
          module="psychiatrygraph"
          eyebrow="PsychiatryAdvisor®"
          embedPath={
            token ? advisorPublicEmbedPath('psychiatrygraph', token) : ''
          }
          settings={store.settings}
          websiteHref="/dashboard/psychiatrygraph/website"
          saving={saving}
          onSave={async (sections) => {
            await post({
              action: 'update_settings',
              settings: {
                portal_sections: sections,
                ...portalSectionsToLegacyFlags('psychiatrygraph', sections),
              },
            });
            toast.success('Portal sections saved');
          }}
        />
      )}
    </PsychiatrygraphWorkbench>
  );
}
