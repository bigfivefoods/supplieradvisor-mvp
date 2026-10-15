'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { RECOVER_COMPANY_COOKIE } from '@/lib/recovery/member-company';
import type { RecoverDeskPayload, RecoverOp } from '@/lib/recovery/types';

function rememberCompany() {
  const companyId = getSelectedCompanyId();
  if (!companyId || typeof document === 'undefined') return;
  document.cookie = `${RECOVER_COMPANY_COOKIE}=${companyId};path=/;SameSite=Lax`;
}

export function useRecoverDesk() {
  const [desk, setDesk] = useState<RecoverDeskPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    rememberCompany();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recovery/recovergraph', {
        credentials: 'include',
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => null)) as
        | (RecoverDeskPayload & { error?: string })
        | null;
      if (!res.ok || !body || body.error) {
        setDesk(null);
        setError(body?.error || 'RecoverAdvisor® could not be opened.');
        return;
      }
      setDesk(body);
    } catch {
      setDesk(null);
      setError('RecoverAdvisor® could not be opened.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (op: RecoverOp) => {
    rememberCompany();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/recovery/recovergraph', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op),
      });
      const body = (await res.json().catch(() => null)) as
        | (RecoverDeskPayload & { error?: string; reason?: string })
        | null;
      if (!res.ok || !body || body.error) {
        setError(body?.error || 'RecoverAdvisor® could not save that change.');
        return false;
      }
      setDesk(body);
      return true;
    } catch {
      setError('RecoverAdvisor® could not save that change.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { desk, error, loading, saving, reload: load, save };
}
