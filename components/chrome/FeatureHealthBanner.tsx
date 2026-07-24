'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

type HealthJson = {
  ok?: boolean;
  golden_loop?: {
    ok?: boolean;
    missing?: string[];
    migrationsToApply?: string[];
  };
};

/**
 * Soft banner when golden-loop tables are missing (migrations not applied).
 */
export default function FeatureHealthBanner({
  className = '',
}: {
  className?: string;
}) {
  const [missing, setMissing] = useState<string[] | null>(null);
  const [migrations, setMigrations] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/system/health')
      .then((r) => r.json())
      .then((j: HealthJson) => {
        if (cancelled) return;
        const m = j.golden_loop?.missing || [];
        if (m.length) {
          setMissing(m);
          setMigrations(j.golden_loop?.migrationsToApply || []);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!missing?.length) return null;

  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2 ${className}`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-bold">Some live modules need database migrations</p>
        <p className="text-xs mt-0.5">
          Missing tables: {missing.slice(0, 8).join(', ')}
          {missing.length > 8 ? '…' : ''}
        </p>
        {migrations.length > 0 && (
          <p className="text-[11px] font-mono mt-1 text-amber-900/80">
            Apply: {migrations.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
