'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type {
  HealthProgrammeRole,
  HealthProgrammeRoleInfo,
} from '@/lib/health/programme-role';

export function useHealthProgrammeRole() {
  const companyId = getSelectedCompanyId();
  const [info, setInfo] = useState<HealthProgrammeRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setInfo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/health/programme-role?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (res.ok && data.role) {
        setInfo({
          role: data.role as HealthProgrammeRole,
          group: data.group,
          label: data.label,
          homePath: data.homePath,
        });
      } else {
        setInfo(null);
      }
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    role: (info?.role || 'facility') as HealthProgrammeRole,
    group: info?.group || 'Facility',
    label: info?.label || 'Facility',
    homePath: info?.homePath || '/dashboard/health',
    info,
    reload: load,
  };
}
