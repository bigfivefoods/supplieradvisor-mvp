'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import {
  ArrowLeft,
  Building2,
  Loader2,
  MessageSquareHeart,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  ReviewForm,
  ReviewCard,
  type ReviewFormSubmit,
} from '@/components/ratings';
import type { PoReviewRecord } from '@/lib/procurement/types';

interface PendingPO {
  id: number;
  buyer_profile_id?: number | null;
  supplier_profile_id?: number | null;
  supplier_id?: number | null;
  status: string;
  total_amount?: number | null;
  subtotal?: number | null;
  currency?: string | null;
  description?: string | null;
  created_at?: string;
}

export default function BuyerReviewsPage() {
  const { user } = usePrivy();
  const companyId = getSelectedCompanyId();
  const companyName = getSelectedCompanyName();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviews, setReviews] = useState<PoReviewRecord[]>([]);
  const [pending, setPending] = useState<PendingPO[]>([]);
  const [activePoId, setActivePoId] = useState<number | null>(null);
  const [supplierNames, setSupplierNames] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (!companyId || !privyUserId) return;
    const params = new URLSearchParams({
      buyerCompanyId: String(companyId),
      privyUserId,
    });
    const res = await fetch(`/api/buyer/reviews?${params}`);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed to load reviews');
      return;
    }
    setReviews(json.reviews || []);
    setPending(json.pending || []);
  }, [companyId, privyUserId]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [companyId, load]);

  // Resolve supplier display names for pending POs
  useEffect(() => {
    const ids = new Set<number>();
    for (const po of pending) {
      const sid = Number(po.supplier_profile_id || po.supplier_id);
      if (sid > 0) ids.add(sid);
    }
    for (const r of reviews) {
      if (r.reviewee_profile_id) ids.add(Number(r.reviewee_profile_id));
    }
    if (ids.size === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name')
          .in('id', [...ids]);
        if (cancelled || !data) return;
        const map: Record<number, string> = {};
        for (const p of data) {
          map[Number(p.id)] =
            p.trading_name || p.legal_name || `Company ${p.id}`;
        }
        setSupplierNames(map);
      } catch {
        /* ignore — labels fall back to id */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, reviews]);

  const supplierLabel = (po: PendingPO) => {
    const sid = Number(po.supplier_profile_id || po.supplier_id);
    return supplierNames[sid] || (sid ? `Supplier ${sid}` : 'Supplier');
  };

  const handleSubmit = async (data: ReviewFormSubmit) => {
    if (!companyId || !privyUserId || activePoId == null) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/buyer/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerCompanyId: companyId,
          privyUserId,
          purchaseOrderId: activePoId,
          rating: data.rating,
          title: data.title,
          body: data.body,
          dimensions: data.dimensions,
          // Intentionally omit reviewer/reviewee — server derives from PO
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to submit review');
        return;
      }
      toast.success('Review submitted');
      setActivePoId(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  if (!companyId) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-neutral-600 mb-4">Select a company to manage reviews.</p>
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">
          Select company
        </Link>
      </div>
    );
  }

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-10 px-6 max-w-5xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4 hover:text-neutral-800"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-[-2px] text-[#00b4d8]">
              Post-PO reviews
            </h1>
            <p className="text-neutral-600 mt-2 text-sm max-w-xl">
              Rate suppliers after POs are paid or completed. Allowed even if the
              connection is suspended. Reviews are bilateral (you + supplier only).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/buyer/pos"
              className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" /> Purchase orders
            </Link>
            <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-2xl px-4 py-2">
              <Building2 className="w-4 h-4 text-[#00b4d8]" />
              <span className="font-semibold text-sm">{companyName}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : (
          <>
            {/* Pending */}
            <section className="mb-10">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <MessageSquareHeart className="w-5 h-5 text-[#00b4d8]" />
                Pending reviews
                {pending.length > 0 && (
                  <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {pending.length}
                  </span>
                )}
              </h2>

              {pending.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-3xl p-8 text-center text-sm text-neutral-500">
                  No reviewable POs waiting for a review. When a supplier marks your
                  PO as paid or completed, it appears here.
                </div>
              ) : (
                <div className="space-y-4">
                  {pending.map((po) => {
                    const amount = Number(po.total_amount ?? po.subtotal ?? 0);
                    const currency = po.currency || 'ZAR';
                    if (activePoId === po.id) {
                      return (
                        <ReviewForm
                          key={po.id}
                          purchaseOrderId={po.id}
                          supplierLabel={supplierLabel(po)}
                          submitting={submitting}
                          onSubmit={handleSubmit}
                          onCancel={() => setActivePoId(null)}
                        />
                      );
                    }
                    return (
                      <div
                        key={po.id}
                        className="bg-white border border-amber-200 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-neutral-900">
                            PO #{po.id} · {supplierLabel(po)}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1 flex flex-wrap gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 capitalize">
                              {po.status}
                            </span>
                            <span>
                              {currency} {amount.toFixed(2)}
                            </span>
                            {po.description && (
                              <span className="truncate max-w-xs">{po.description}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActivePoId(po.id)}
                          className="btn-primary !py-2 !px-4 text-sm"
                        >
                          Write review
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* History */}
            <section>
              <h2 className="text-xl font-bold mb-4">Your reviews</h2>
              {reviews.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-3xl p-8 text-center text-sm text-neutral-500">
                  You have not submitted any peer reviews yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <ReviewCard
                      key={r.id}
                      review={r}
                      subtitle={
                        supplierNames[Number(r.reviewee_profile_id)]
                          ? `Supplier: ${supplierNames[Number(r.reviewee_profile_id)]}`
                          : `Supplier #${r.reviewee_profile_id}`
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
