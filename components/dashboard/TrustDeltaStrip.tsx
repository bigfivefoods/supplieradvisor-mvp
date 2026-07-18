'use client';

/**
 * Home trust delta — current score + how to improve after trade.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Star, ArrowRight } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

export default function TrustDeltaStrip() {
  const companyId = getSelectedCompanyId();
  const [score, setScore] = useState<number | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [verified, setVerified] = useState(false);
  const [pendingPrompts, setPendingPrompts] = useState(0);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const [tRes, pRes] = await Promise.all([
        fetch(`/api/business/trust?companyId=${companyId}`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(`/api/business/rating-prompts?companyId=${companyId}`, {
          cache: 'no-store',
        }).catch(() => null),
      ]);
      if (tRes?.ok) {
        const t = await tRes.json().catch(() => ({}));
        const computed = t.computed ?? t.trust?.computed ?? t.score;
        if (computed != null) setScore(Number(computed));
        const avg = t.inputs?.starAvg ?? t.trust?.inputs?.starAvg;
        if (avg != null) setStars(Number(avg));
        setVerified(
          Boolean(
            t.inputs?.verified ??
              t.trust?.inputs?.verified ??
              t.verified
          )
        );
      }
      if (pRes?.ok) {
        const p = await pRes.json().catch(() => ({}));
        setPendingPrompts((p.prompts || []).length);
      }
    } catch {
      /* soft */
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId || (score == null && pendingPrompts === 0)) return null;

  return (
    <div className="mb-4 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="flex items-start gap-2 min-w-0">
        <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-black text-slate-900">
            Trust
            {score != null ? (
              <span className="ml-1.5 text-sky-800">{Math.round(score)}</span>
            ) : null}
            {verified ? (
              <span className="ml-1.5 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                CIPC
              </span>
            ) : null}
          </p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            {pendingPrompts > 0
              ? `${pendingPrompts} rating prompt(s) waiting — close the trust loop after trade.`
              : stars != null
                ? `Peer stars avg ${stars.toFixed(1)}. Keep rating after paid invoices.`
                : 'Rate partners after settle to lift peer-star contribution.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {pendingPrompts > 0 ? (
          <Link
            href="/dashboard?ratePrompt=open"
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-800 text-white text-xs font-bold px-3 py-2"
          >
            <Star className="w-3.5 h-3.5" />
            Rate now
          </Link>
        ) : null}
        <Link
          href="/dashboard/my-business/trust"
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white text-sky-900 text-xs font-bold px-3 py-2"
        >
          Trust detail
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
