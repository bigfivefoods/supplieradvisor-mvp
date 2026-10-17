'use client';

import { useEffect, useState } from 'react';
import { coreFlowMountState } from '@/lib/advisors/process-flows/core-caps';
import { getCoreFlow } from '@/lib/advisors/process-flows';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { isFixturePath, isFixtureReachable } from '@/lib/preview/fixture-href';
import type { CoreFlowModuleId } from '@/lib/advisors/process-flows/types';
import { AdvisorProcessFlow } from './AdvisorProcessFlow';

export function CoreProcessFlow({ module }: { module: CoreFlowModuleId }) {
  const company = useCompanyRole();
  const [fixture, setFixture] = useState(false);
  useEffect(() => {
    setFixture(isFixturePath('/preview'));
  }, []);
  const state = coreFlowMountState({
    role: company.role,
    loading: company.loading,
    module,
    fixture,
  });
  if (!state.mount || state.role == null) return null;
  const def = getCoreFlow(module);
  if (!def) return null;
  return (
    <AdvisorProcessFlow
      module={module}
      role={state.role}
      caps={state.caps}
      hrefBase={def.hrefRoot}
      reachable={fixture ? isFixtureReachable : undefined}
    />
  );
}
