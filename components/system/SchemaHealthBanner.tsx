'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';

/**
 * Shows when production schema is missing required profiles columns
 * (branch_code, bank AVS fields, etc.) — from /api/system/health.
 */
export default function SchemaHealthBanner() {
  const [missing, setMissing] = useState<string[] | null>(null);
  const [commit, setCommit] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/system/health', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        setCommit(data.deploy?.commitShort || null);
        if (Array.isArray(data.schemaMissingColumns) && data.schemaMissingColumns.length) {
          setMissing(data.schemaMissingColumns);
        } else {
          setMissing([]);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || missing == null || missing.length === 0) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-950">
      <div className="mx-auto max-w-screen-2xl flex items-start gap-2 text-xs sm:text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            Database schema incomplete{commit ? ` · deploy ${commit}` : ''}
          </p>
          <p className="mt-0.5 text-amber-900/90 leading-snug">
            Missing columns: <code className="font-mono text-[11px]">{missing.join(', ')}</code>.
            Run Supabase migrations{' '}
            <code className="font-mono text-[11px]">20260716_profiles_branch_code.sql</code> and{' '}
            <code className="font-mono text-[11px]">20260716_bank_account_verification.sql</code>,
            then redeploy. See{' '}
            <Link href="/dashboard/my-business/profile" className="underline font-semibold">
              profile banking
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-amber-100 text-amber-800"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function SchemaOkBadge() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/system/health', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setOk(d.schemaColumnsOk !== false && d.ok))
      .catch(() => setOk(null));
  }, []);
  if (ok !== true) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
      <CheckCircle2 className="w-3 h-3" /> Schema OK
    </span>
  );
}
