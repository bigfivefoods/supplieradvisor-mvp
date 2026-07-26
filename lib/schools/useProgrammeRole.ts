'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ProgrammeRole, ProgrammeRoleInfo } from '@/lib/schools/programme-role';
import { infoForProgrammeRole } from '@/lib/schools/programme-role';

const DEFAULT: ProgrammeRoleInfo = infoForProgrammeRole('school');

/**
 * Client hook: which Schools nav tool the selected company should see.
 */
export function useProgrammeRole(): ProgrammeRoleInfo & {
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [companyId, setCompanyId] = useState<number | null>(() =>
    typeof window !== 'undefined' ? getSelectedCompanyId() : null
  );
  const [info, setInfo] = useState<ProgrammeRoleInfo>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = () => setCompanyId(getSelectedCompanyId());
    sync();
    window.addEventListener('sa:company-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('sa:company-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setInfo(DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/programme-role?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (res.ok && data.role) {
        setInfo({
          role: data.role as ProgrammeRole,
          group: data.group,
          label: data.label,
          homePath: data.homePath,
        });
      } else {
        setInfo(DEFAULT);
      }
    } catch {
      setInfo(DEFAULT);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...info, loading, refresh };
}
