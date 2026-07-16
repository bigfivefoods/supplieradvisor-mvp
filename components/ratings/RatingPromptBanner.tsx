'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

type Prompt = {
  id: number;
  counterparty_name?: string | null;
  counterparty_profile_id?: number | null;
  ratee_role?: string;
  context_type?: string;
};

export default function RatingPromptBanner() {
  const { user } = usePrivy();
  const companyId = getSelectedCompanyId();
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(
        `/api/business/rating-prompts?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (res.ok) setPrompts((data.prompts || []).slice(0, 3));
    } catch {
      /* optional */
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dismiss = async (promptId: number) => {
    if (!companyId) return;
    try {
      await fetch('/api/business/rating-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'dismiss',
          promptId,
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
      setPrompts((p) => p.filter((x) => x.id !== promptId));
    } catch {
      /* ignore */
    }
  };

  if (!prompts.length) return null;

  return (
    <div className="mb-4 space-y-2">
      {prompts.map((p) => (
        <div
          key={p.id}
          className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 relative"
        >
          <button
            type="button"
            className="absolute right-2 top-2 p-1 text-amber-800/50 hover:text-amber-900"
            onClick={() => void dismiss(p.id)}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <Star className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="min-w-0 flex-1 pr-6">
            <div className="text-sm font-bold text-amber-950">
              Rate {p.counterparty_name || 'your trading partner'}
            </div>
            <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
              Suppliers and customers rate each other after trade — continuous
              feedback that builds OTIFEF and trust for the whole network.
            </p>
          </div>
          <Link
            href={
              p.ratee_role === 'customer'
                ? '/dashboard/customers/ratings'
                : '/dashboard/suppliers/ratings'
            }
            className="shrink-0 rounded-full bg-amber-800 px-4 py-2 text-xs font-bold text-white hover:bg-amber-900"
          >
            Open ratings
          </Link>
        </div>
      ))}
    </div>
  );
}
