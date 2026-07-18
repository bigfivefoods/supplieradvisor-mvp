'use client';

/**
 * P0 ops-live banner — blockers from public /api/system/health p0Readiness.
 * Visible to all signed-in users so settle features aren't silently broken.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

type P0 = {
  ok?: boolean;
  blockers?: string[];
  warnings?: string[];
  settleMissing?: string[];
  deploy?: { commitShort?: string | null; commit?: string | null };
  tipCheck?: string;
};

export default function OpsLiveBanner() {
  const [p0, setP0] = useState<P0 | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/system/health', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (data.p0Readiness) setP0(data.p0Readiness as P0);
        else setP0({ ok: true, blockers: [], warnings: [] });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || !p0) return null;
  const blockers = p0.blockers || [];
  const warnings = p0.warnings || [];
  if (blockers.length === 0 && warnings.length === 0) return null;

  const critical = blockers.length > 0;

  return (
    <div
      className={`border-b px-4 py-2.5 ${
        critical
          ? 'border-rose-200 bg-rose-50 text-rose-950'
          : 'border-amber-200 bg-amber-50 text-amber-950'
      }`}
    >
      <div className="mx-auto max-w-screen-2xl flex items-start gap-2 text-xs sm:text-sm">
        {critical ? (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {critical ? 'Production ops blockers (P0)' : 'Ops warnings'}
            {p0.deploy?.commitShort
              ? ` · deploy ${p0.deploy.commitShort}`
              : ''}
          </p>
          {blockers.length > 0 ? (
            <ul className="mt-1 list-disc list-inside space-y-0.5 leading-snug">
              {blockers.slice(0, 4).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="mt-1 list-disc list-inside space-y-0.5 leading-snug opacity-90">
              {warnings.slice(0, 3).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-1.5">
            <Link
              href="/dashboard/my-business/ops"
              className="font-bold underline"
            >
              Ops control plane
            </Link>
            {' · '}
            <span className="font-mono text-[11px]">
              docs/OPS_MIGRATIONS.md
            </span>
            {p0.tipCheck ? (
              <>
                {' · '}
                <span className="opacity-80">{p0.tipCheck}</span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className={`p-1 rounded-lg shrink-0 ${
            critical ? 'hover:bg-rose-100' : 'hover:bg-amber-100'
          }`}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
