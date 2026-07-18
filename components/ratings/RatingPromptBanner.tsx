'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Star, X, Package } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { RateCompanyForm } from './RateCompanyForm';
import type { RateeRole } from '@/lib/ratings/company-rating';

type Prompt = {
  id: number;
  counterparty_name?: string | null;
  counterparty_profile_id?: number | null;
  ratee_role?: string;
  context_type?: string;
  context_id?: string | null;
};

type Peer = { profileId: number; trading_name: string; role?: string };

function rateHref(p: Prompt): string {
  const base =
    p.ratee_role === 'customer'
      ? '/dashboard/customers/ratings'
      : '/dashboard/suppliers/ratings';
  const qs = new URLSearchParams();
  if (p.counterparty_profile_id) {
    qs.set('ratee', String(p.counterparty_profile_id));
  }
  if (p.id) qs.set('promptId', String(p.id));
  if (p.context_type) qs.set('ctx', p.context_type);
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}

function contextLabel(p: Prompt): string {
  const t = String(p.context_type || '').toLowerCase();
  if (t === 'po') return 'after purchase order delivery';
  if (t === 'invoice') return 'after invoice paid';
  if (t === 'shipment') return 'after shipment delivered';
  if (t === 'connection') return 'after network connection';
  return 'after trade';
}

function asRateeRole(r?: string): RateeRole {
  if (r === 'customer' || r === 'partner') return r;
  return 'supplier';
}

/**
 * Dashboard banner for pending rating prompts + in-place rate modal.
 */
export default function RatingPromptBanner() {
  const { user } = usePrivy();
  const companyId = getSelectedCompanyId();
  const privyUserId = getCanonicalUserId(user?.id);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [active, setActive] = useState<Prompt | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(
        `/api/business/rating-prompts?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (res.ok) {
        const list = (data.prompts || []) as Prompt[];
        setPrompts(list.slice(0, 3));
        return list;
      }
    } catch {
      /* optional */
    }
    return [] as Prompt[];
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Deep link from notification bell: /dashboard?ratePrompt=ID or ?ratee=PROFILE
  useEffect(() => {
    const promptId = searchParams.get('ratePrompt');
    const ratee = searchParams.get('ratee');
    if (!promptId && !ratee) return;

    let cancelled = false;
    (async () => {
      const list = (await load()) || [];
      if (cancelled) return;
      let match: Prompt | undefined;
      if (promptId && promptId !== 'open') {
        match = list.find((p) => String(p.id) === String(promptId));
      }
      if (!match && (promptId === 'open' || !promptId) && list.length) {
        match = list[0];
      }
      if (!match && ratee) {
        match = list.find(
          (p) => String(p.counterparty_profile_id) === String(ratee)
        );
      }
      if (!match && ratee) {
        // Synthetic prompt from query alone
        match = {
          id: Number(promptId) || 0,
          counterparty_profile_id: Number(ratee),
          counterparty_name: searchParams.get('name') || 'Trading partner',
          ratee_role: searchParams.get('role') || 'supplier',
          context_type: searchParams.get('ctx') || 'general',
        };
      }
      if (match) setActive(match);

      // Clean query without full navigation flash
      if (pathname && (promptId || ratee)) {
        const next = new URLSearchParams(searchParams.toString());
        next.delete('ratePrompt');
        next.delete('ratee');
        next.delete('name');
        next.delete('role');
        next.delete('ctx');
        const q = next.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from query
  }, [companyId]);

  // Light peer list for modal (connections) when opening rate
  useEffect(() => {
    if (!active || !companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/connections?companyId=${companyId}${
            privyUserId
              ? `&privyUserId=${encodeURIComponent(privyUserId)}`
              : ''
          }`
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const map = new Map<number, Peer>();
        for (const e of data.edges || []) {
          if (e.status !== 'accepted' || e.suspended) continue;
          const id = Number(e.peer?.id);
          if (!id) continue;
          const name = e.peer?.trading_name || e.peer?.legal_name;
          if (!name) continue;
          map.set(id, {
            profileId: id,
            trading_name: name,
            role: e.role || e.connection_type || 'partner',
          });
        }
        // Ensure prompt counterparty is present
        const cid = Number(active.counterparty_profile_id);
        if (
          Number.isFinite(cid) &&
          cid > 0 &&
          !map.has(cid) &&
          active.counterparty_name
        ) {
          map.set(cid, {
            profileId: cid,
            trading_name: String(active.counterparty_name),
            role: active.ratee_role || 'partner',
          });
        }
        setPeers(Array.from(map.values()));
      } catch {
        if (!cancelled) setPeers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, companyId, privyUserId]);

  const dismiss = async (promptId: number) => {
    if (!companyId) return;
    // Hard trust close: require snooze reason (not silent dismiss)
    const reason = window.prompt(
      'Snooze rating? Enter a short reason (required — trust loop closes after trade):',
      'Will rate after delivery confirmation'
    );
    if (!reason?.trim()) {
      return;
    }
    try {
      await fetch('/api/business/rating-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'dismiss',
          promptId,
          privyUserId,
          reason: reason.trim().slice(0, 200),
        }),
      });
      setPrompts((p) => p.filter((x) => x.id !== promptId));
      if (active?.id === promptId) setActive(null);
    } catch {
      /* ignore */
    }
  };

  const [showTrustNudge, setShowTrustNudge] = useState(false);

  const onRated = async () => {
    if (active && companyId) {
      // Mark prompt completed (also done server-side by afterPeerRatingPublished)
      try {
        await fetch('/api/business/rating-prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            action: 'complete',
            promptId: active.id,
            privyUserId,
          }),
        });
      } catch {
        /* ignore */
      }
      setPrompts((p) => p.filter((x) => x.id !== active.id));
    }
    setActive(null);
    setShowTrustNudge(true);
    void load();
  };

  if (!prompts.length && !active && !showTrustNudge) return null;

  return (
    <>
      {showTrustNudge && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-emerald-950">
              Rating published — thank you
            </div>
            <p className="text-xs text-emerald-900/80 mt-0.5 leading-relaxed">
              Peer stars feed trust for the network. OTIFEF (objective delivery)
              still lives on supplier scorecards.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/dashboard/my-business/trust"
              className="rounded-full bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white touch-manipulation"
              onClick={() => setShowTrustNudge(false)}
            >
              View trust score
            </Link>
            <button
              type="button"
              className="rounded-full border border-emerald-300 bg-white px-3 py-2.5 text-xs font-bold text-emerald-950 touch-manipulation"
              onClick={() => setShowTrustNudge(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {prompts.length > 0 && (
        <div className="mb-4 space-y-2">
          {prompts.map((p) => (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 sm:px-4 py-3 relative"
            >
              <button
                type="button"
                className="absolute right-2 top-2 p-1 text-amber-800/50 hover:text-amber-900"
                onClick={() => void dismiss(p.id)}
                aria-label="Snooze with reason"
                title="Snooze requires a reason"
              >
                <X className="w-4 h-4" />
              </button>
              <Star className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="min-w-0 flex-1 pr-6">
                <div className="text-sm font-bold text-amber-950">
                  Rate {p.counterparty_name || 'your trading partner'}
                </div>
                <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
                  Prompted {contextLabel(p)}. Close the loop: capture OTIFEF if
                  goods moved, then leave peer stars — both feed trust.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {(String(p.context_type || '').toLowerCase() === 'po' ||
                  p.context_id) && (
                  <Link
                    href={
                      String(p.context_type || '').toLowerCase() === 'po' &&
                      p.context_id
                        ? `/dashboard/suppliers/po?po=${p.context_id}`
                        : '/dashboard/suppliers/po'
                    }
                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-950 hover:bg-sky-100 inline-flex items-center gap-1"
                  >
                    <Package className="w-3.5 h-3.5" />
                    OTIFEF
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setActive(p)}
                  className="rounded-full bg-amber-800 px-4 py-2 text-xs font-bold text-white hover:bg-amber-900"
                >
                  Rate now
                </button>
                <Link
                  href={rateHref(p)}
                  className="rounded-full border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
                >
                  Full page
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {active && companyId && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-pb"
          role="dialog"
          aria-modal="true"
          aria-label="Rate trading partner"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setActive(null)}
          />
          <div className="relative w-full sm:max-w-lg max-h-[min(92dvh,100%)] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200 pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-100 bg-white/95 px-3 sm:px-4 py-3 backdrop-blur">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Trust loop
                </div>
                <div className="font-black text-slate-900 text-sm sm:text-base truncate">
                  Rate {active.counterparty_name || 'partner'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 touch-manipulation shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 sm:p-4">
              <div className="mb-3 rounded-2xl border border-sky-100 bg-sky-50/80 px-3 py-2.5 text-xs text-sky-950">
                <p className="font-bold flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  Close the loop (2 steps)
                </p>
                <ol className="mt-1.5 space-y-1 text-[11px] text-sky-900/90 list-decimal list-inside">
                  <li>
                    If goods moved:{' '}
                    <Link
                      href={
                        String(active.context_type || '').toLowerCase() ===
                          'po' && active.context_id
                          ? `/dashboard/suppliers/po?po=${active.context_id}`
                          : '/dashboard/suppliers/po'
                      }
                      className="font-bold text-[#0077b6] underline"
                    >
                      Record OTIFEF on the PO
                    </Link>
                  </li>
                  <li>Leave peer stars below (subjective trust)</li>
                </ol>
              </div>
              <RateCompanyForm
                companyId={companyId}
                privyUserId={privyUserId}
                rateeRole={asRateeRole(active.ratee_role)}
                peers={peers}
                initialRateeId={active.counterparty_profile_id}
                initialRateeName={active.counterparty_name}
                lockRatee={Boolean(active.counterparty_profile_id)}
                compact
                hideLegend
                onSaved={() => void onRated()}
              />
              <p className="text-center text-[11px] text-slate-400 mt-3 pb-4 sm:pb-2">
                Prefer the full form?{' '}
                <Link
                  href={rateHref(active)}
                  className="font-semibold text-sky-700 hover:underline"
                >
                  Open ratings page
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
