'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  rememberAdvisorPwaMember,
  type AdvisorPwaBrand,
  type AdvisorPwaModule,
} from '@/lib/advisors/member-pwa';
import { AdvisorPwaInstallPrompt } from '@/components/advisors/AdvisorPwaInstallPrompt';
import { applyAdvisorPwaDocumentHead } from '@/components/advisors/apply-advisor-pwa-head';

/**
 * Remembers this member/patient token against the business public token
 * so the installed company PWA opens their in-app home next time.
 */
export function AdvisorPwaMemberBinder({
  module,
  memberToken,
  publicToken,
  brandName,
  themeColor,
  iconUrl,
  backgroundColor,
}: {
  module: AdvisorPwaModule;
  memberToken: string;
  publicToken?: string | null;
  brandName?: string | null;
  themeColor?: string | null;
  iconUrl?: string | null;
  backgroundColor?: string | null;
}) {
  const [brand, setBrand] = useState<AdvisorPwaBrand | null>(null);

  useEffect(() => {
    const member = String(memberToken || '').trim();
    const pub = String(publicToken || '').trim();
    // Public shop/catalogue visits share the public token — don't clobber
    // a real member/patient mapping from a previous join.
    if (pub && member === pub) return;
    rememberAdvisorPwaMember({
      module,
      memberToken,
      publicToken,
    });
  }, [module, memberToken, publicToken]);

  const pub = String(publicToken || '').trim();

  useEffect(() => {
    if (pub.length < 8) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/public/advisor-pwa?module=${encodeURIComponent(module)}&token=${encodeURIComponent(pub)}`
        );
        const data = await res.json();
        if (!res.ok || cancelled) return;
        if (data.brand) setBrand(data.brand as AdvisorPwaBrand);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [module, pub]);

  const fallback = useMemo(() => {
    if (!pub || brand) return null;
    if (!brandName) return null;
    return {
      module,
      publicToken: pub,
      companyId: 0,
      advisorLabel: '',
      audience: 'members',
      audienceSingular: 'member',
      brandName,
      shortName: brandName.slice(0, 12),
      description: '',
      themeColor: themeColor || '#0c4a6e',
      backgroundColor: backgroundColor || '#0c4a6e',
      iconUrl: iconUrl || '/sa-icon-512.png',
      startPath: `/pwa/${module}/${encodeURIComponent(pub)}`,
      memberBasePath: `/member/${module}`,
      joinPath: '',
      joinGymPath: '',
      joinPrivatePath: '',
      joinKind: '',
      enabled: true,
    } satisfies AdvisorPwaBrand;
  }, [backgroundColor, brand, brandName, iconUrl, module, pub, themeColor]);

  const live = brand || fallback;
  useEffect(() => {
    if (!live || live.enabled === false) return;
    applyAdvisorPwaDocumentHead(live);
  }, [live]);

  if (!live || live.enabled === false) return null;
  return <AdvisorPwaInstallPrompt brand={live} mode="chip" autoOpen />;
}
