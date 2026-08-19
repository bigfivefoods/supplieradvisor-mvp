'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  RetailgraphPage,
  RetailgraphRequired,
} from '@/components/retail/RetailgraphShell';
import { AdvisorPortalPreviewDesk } from '@/components/advisors/AdvisorPortalPreviewDesk';
import {
  advisorPublicEmbedPath,
  portalSectionsToLegacyFlags,
} from '@/lib/advisors/portal-sections';
import type { RetailgraphStore } from '@/lib/retail/retailgraph';

export default function RetailgraphPortalPage() {
  const { companyId, withAuthJson } = useApiAuth();
  const [store, setStore] = useState<RetailgraphStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{ store?: RetailgraphStore }>(
      `/api/retail/retailgraph?companyId=${companyId}`
    );
    setStore(data.store || null);
  }, [companyId, withAuthJson]);

  useEffect(() => {
    void load()
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [load]);

  const token = store?.settings?.public_token || '';

  return (
    <RetailgraphRequired>
      <RetailgraphPage
        title="View portal"
        description="See the shopper PWA and the optional public website. Choose which sections appear on the site."
      >
        {loading || !store || !companyId ? (
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
        ) : (
          <AdvisorPortalPreviewDesk
            module="retailgraph"
            eyebrow="RetailAdvisor®"
            embedPath={
              token ? advisorPublicEmbedPath('retailgraph', token) : ''
            }
            settings={store.settings}
            websiteHref="/dashboard/retailgraph/website"
            saving={saving}
            onSave={async (sections) => {
              setSaving(true);
              try {
                const data = await withAuthJson<{ store?: RetailgraphStore }>(
                  '/api/retail/retailgraph',
                  {
                    method: 'POST',
                    jsonBody: {
                      companyId,
                      action: 'update_settings',
                      settings: {
                        ...(store.settings || {}),
                        portal_sections: sections,
                        ...portalSectionsToLegacyFlags('retailgraph', sections),
                      },
                    },
                  }
                );
                if (data.store) setStore(data.store);
                toast.success('Portal sections saved');
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : 'Save failed');
              } finally {
                setSaving(false);
              }
            }}
          />
        )}
      </RetailgraphPage>
    </RetailgraphRequired>
  );
}
