'use client';

/**
 * A+B: Inevitable next best action — prefer Money hub when settle is open.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Compass, Loader2 } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

type Action = {
  id: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  secondaryHref?: string;
  secondaryCta?: string;
  signals?: Record<string, number | boolean>;
};

export default function InevitableNextBanner() {
  const companyId = getSelectedCompanyId();
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/business/next-action?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.action) setAction(data.action as Action);
      else setAction(null);
    } catch {
      setAction(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId || loading) {
    return loading && companyId ? (
      <div className="mb-4 flex items-center gap-2 text-xs text-neutral-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading next step…
      </div>
    ) : null;
  }
  if (!action) return null;

  return (
    <div className="mb-4 rounded-2xl border border-[#00b4d8]/40 bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-4 py-3.5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="min-w-0 flex items-start gap-2">
          <Compass className="w-5 h-5 text-[#0077b6] shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
              Next best action
            </p>
            <p className="text-sm font-black text-slate-900">{action.title}</p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {action.body}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href={action.href}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#00b4d8] hover:bg-[#0096c7] text-white text-xs font-bold px-4 py-2"
          >
            {action.cta}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          {action.secondaryHref ? (
            <Link
              href={action.secondaryHref}
              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white text-sky-900 text-xs font-bold px-3 py-2"
            >
              {action.secondaryCta || 'More'}
            </Link>
          ) : null}
          <Link
            href="/dashboard/customers/money"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-950 text-xs font-bold px-3 py-2"
          >
            Money hub
          </Link>
        </div>
      </div>
    </div>
  );
}
