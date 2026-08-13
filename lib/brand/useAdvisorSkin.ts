'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  resolveAdvisorSkin,
  type AdvisorSkin,
} from '@/lib/brand/advisor-skins';

/** Live Advisor product skin — respects user brand preference. */
export function useAdvisorSkin(): AdvisorSkin {
  const pathname = usePathname();
  const { enabledModules, packaging } = useCompanyRole();
  const { brandMode } = useTheme();

  return useMemo(
    () =>
      resolveAdvisorSkin({
        pathname,
        enabledModules,
        packIds: packaging?.packIds || null,
        brandMode,
      }),
    [pathname, enabledModules, packaging?.packIds, brandMode]
  );
}
