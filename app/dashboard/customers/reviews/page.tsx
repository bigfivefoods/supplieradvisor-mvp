'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  CompanyRequired,
  CustomersHeader,
} from '@/components/customers/CustomersShell';
import {
  PeerRatingSummary,
  ReviewCard,
} from '@/components/ratings';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import type { PoReviewRecord } from '@/lib/procurement/types';

type Aggregate = {
  avgPeerRating: number | null;
  publishedCount: number;
  totalCount: number;
};

export default function CustomerReviewsPage() {
  const { user } = usePrivy();
  const companyId = getSelectedCompanyId();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reviews, setReviews] = useState<PoReviewRecord[]>([]);
  const [aggregate, setAggregate] = useState<Aggregate>({
    avgPeerRating: null,
    publishedCount: 0,
    totalCount: 0,
  });
  const [buyerNames, setBuyerNames] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (!companyId || !privyUserId) return;
    const params = new URLSearchParams({
      companyId: String(companyId),
      privyUserId,
      includeHidden: '1',
    });
    const res = await fetch(`/api/customers/reviews?${params}`);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed to load reviews');
      return;
    }
    setReviews(json.reviews || []);
    setAggregate(
      json.aggregate || {
        avgPeerRating: null,
        publishedCount: 0,
        totalCount: 0,
      }
    );
  }, [companyId, privyUserId]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [companyId, load]);

  useEffect(() => {
    const ids = [
      ...new Set(reviews.map((r) => Number(r.reviewer_profile_id)).filter((n) => n > 0)),
    ];
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name')
          .in('id', ids);
        if (cancelled || !data) return;
        const map: Record<number, string> = {};
        for (const p of data) {
          map[Number(p.id)] =
            p.trading_name || p.legal_name || `Company ${p.id}`;
        }
        setBuyerNames(map);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reviews]);

  const setStatus = async (id: number, status: 'hidden' | 'published') => {
    if (!companyId || !privyUserId) return;
    setBusyId(id);
    try {
      const res = await fetch('/api/customers/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to update review');
        return;
      }
      toast.success(status === 'hidden' ? 'Review hidden' : 'Review published');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <CompanyRequired>
      <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
        <CustomersHeader
          title="Peer reviews"
          description="Bilateral post-PO reviews from connected buyers. Hide inappropriate reviews — not shown on public supplier profiles."
        />

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : (
          <>
            <PeerRatingSummary
              avgPeerRating={aggregate.avgPeerRating}
              publishedCount={aggregate.publishedCount}
              totalCount={aggregate.totalCount}
              className="mb-8"
            />

            {reviews.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-3xl p-10 text-center text-sm text-neutral-500 max-w-xl mx-auto">
                No peer reviews yet. When buyers complete paid/completed POs and submit
                reviews, they appear here.
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => {
                  const status = String(r.status || 'published').toLowerCase();
                  const hidden = status === 'hidden';
                  return (
                    <ReviewCard
                      key={r.id}
                      review={r}
                      subtitle={
                        buyerNames[Number(r.reviewer_profile_id)]
                          ? `From: ${buyerNames[Number(r.reviewer_profile_id)]}`
                          : `Buyer #${r.reviewer_profile_id}`
                      }
                      actions={
                        <>
                          {hidden ? (
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => setStatus(r.id, 'published')}
                              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-neutral-200 hover:border-emerald-400 text-neutral-700"
                            >
                              {busyId === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                              Unhide
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => setStatus(r.id, 'hidden')}
                              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-neutral-200 hover:border-amber-400 text-neutral-700"
                            >
                              {busyId === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5" />
                              )}
                              Hide
                            </button>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </CompanyRequired>
  );
}
