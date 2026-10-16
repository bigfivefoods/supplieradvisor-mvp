'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { RECOVER_COMPANY_COOKIE } from '@/lib/recovery/member-company';
import type { RecoverIllustration } from '@/lib/recovery/sample-desk';
import type { RecoverDeskPayload, RecoverOp } from '@/lib/recovery/types';

export type DeskSave =
  | RecoverOp
  | {
      op:
        | 'creditor.upsert'
        | 'mandate.upsert'
        | 'staff.set_expiry'
        | 'account.bulk_assign'
        | 'account.assign'
        | 'account.set_flag'
        | 'account.clear_flag'
        | 'account.add_note'
        | 'account.recall'
        | 'account.adjust'
        | 'debtor.merge'
        | 'workspace.set_assignment_block';
      name?: string;
      customer_id?: number | string;
      enabled?: boolean;
      id?: string;
      source_id?: string;
      target_id?: string;
      reg_no?: string;
      contact_email?: string;
      creditor_id?: string;
      product_type?: string;
      nca_regulated?: boolean;
      commission_model?: { kind: string };
      staff_id?: string | null;
      email?: string;
      expires_on?: string | null;
      ids?: string[];
      team_id?: string | null;
      flag?: string;
      reason?: string;
      note_text?: string;
      adjustment_cents?: number;
      close_reason?: string;
    };

const PreviewBookContext = createContext<((op: DeskSave) => boolean) | null>(null);

export function PreviewBookProvider({ children, onOp }: { children: ReactNode; onOp: (op: DeskSave) => boolean }) {
  return createElement(PreviewBookContext.Provider, { value: onOp }, children);
}

export function usePreviewBook() {
  return useContext(PreviewBookContext);
}

const PreviewContext = createContext<RecoverDeskPayload | null>(null);

export function useIsRecoverPreview() {
  return useContext(PreviewContext) !== null;
}
const IllustrationContext = createContext<RecoverIllustration | null>(null);
const HrefBaseContext = createContext<string | null>(null);
const LinksContext = createContext<'live' | 'soon'>('live');

export function RecoverPreviewProvider({
  desk,
  illustration,
  hrefBase = null,
  links = 'live',
  children,
}: {
  desk: RecoverDeskPayload;
  illustration: RecoverIllustration | null;
  hrefBase?: string | null;
  links?: 'live' | 'soon';
  children: React.ReactNode;
}) {
  return createElement(
    PreviewContext.Provider,
    { value: desk },
    createElement(
      IllustrationContext.Provider,
      { value: illustration },
      createElement(
        HrefBaseContext.Provider,
        { value: hrefBase },
        createElement(LinksContext.Provider, { value: links }, children)
      )
    )
  );
}

export function useRecoverIllustration() {
  return useContext(IllustrationContext);
}

export function useRecoverLinks() {
  return useContext(LinksContext);
}

export function useRecoverHref(path: string) {
  const base = useContext(HrefBaseContext);
  if (!base) return path;
  const root = '/dashboard/recovergraph';
  const [basePath, query] = base.split('?');
  const suffix = query ? `?${query}` : '';
  if (path === root) return `${basePath}${suffix}`;
  if (path.startsWith(`${root}/`)) return `${basePath}${path.slice(root.length)}${suffix}`;
  return path;
}

function rememberCompany() {
  const companyId = getSelectedCompanyId();
  if (!companyId || typeof document === 'undefined') return;
  document.cookie = `${RECOVER_COMPANY_COOKIE}=${companyId};path=/;SameSite=Lax`;
}

export function useRecoverDesk() {
  const preview = useContext(PreviewContext);
  const [desk, setDesk] = useState<RecoverDeskPayload | null>(preview);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (preview) {
      setDesk(preview);
      setError(null);
      setLoading(false);
      return;
    }
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
  }, [preview]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (op: DeskSave) => {
    if (preview) {
      void op;
      setError(null);
      return true;
    }
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
  }, [preview]);

  return { desk, error, loading, saving, reload: load, save };
}
