'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StarRating } from './StarRating';
import { StarScaleLegend, StarSelectionCaption } from './StarGuide';
import {
  CUSTOMER_DIMS,
  SUPPLIER_DIMS,
  type RateeRole,
} from '@/lib/ratings/company-rating';

type Peer = { profileId: number; trading_name: string; role?: string };

export function RateCompanyForm({
  companyId,
  privyUserId,
  rateeRole,
  peers,
  onSaved,
  initialRateeId,
  initialRateeName,
  lockRatee,
  compact,
  hideLegend,
}: {
  companyId: number;
  privyUserId: string | null | undefined;
  rateeRole: RateeRole;
  peers: Peer[];
  onSaved?: () => void;
  /** Pre-select from rating prompt deep link (?ratee=) */
  initialRateeId?: number | string | null;
  initialRateeName?: string | null;
  /** Hide peer dropdown — rate only this company */
  lockRatee?: boolean;
  /** Tighter padding for modals */
  compact?: boolean;
  hideLegend?: boolean;
}) {
  const dims = rateeRole === 'customer' ? CUSTOMER_DIMS : SUPPLIER_DIMS;
  const initial =
    initialRateeId != null && String(initialRateeId) !== ''
      ? String(initialRateeId)
      : '';
  const [rateeId, setRateeId] = useState(initial);
  const [overall, setOverall] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const d of dims) init[d.key] = 0;
    return init;
  });
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  // Inject prompt peer into list if missing
  const peerOptions = useMemo(() => {
    if (
      initial &&
      initialRateeName &&
      !peers.some((p) => String(p.profileId) === initial)
    ) {
      return [
        {
          profileId: Number(initial),
          trading_name: initialRateeName,
          role: rateeRole,
        },
        ...peers,
      ];
    }
    return peers;
  }, [initial, initialRateeName, peers, rateeRole]);

  // Keep preselect when peers load late
  useEffect(() => {
    if (initial && !rateeId) setRateeId(initial);
  }, [initial, rateeId]);

  const setDim = (key: string, n: number) => {
    setScores((s) => ({ ...s, [key]: n }));
  };

  const submit = async () => {
    if (!rateeId) {
      toast.error('Select a company to rate');
      return;
    }
    if (!overall || overall < 1) {
      toast.error('Select an overall star rating (1–5)');
      return;
    }
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        companyId,
        privyUserId,
        rateeProfileId: Number(rateeId),
        rateeRole,
        overall,
        comment: comment.trim() || null,
      };
      for (const d of dims) {
        if (scores[d.key] >= 1) body[d.key] = scores[d.key];
      }
      const res = await fetch('/api/business/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed to save rating');
      toast.success(data.updated ? 'Rating updated' : 'Rating published');
      const { toastGoldenPathStep } = await import(
        '@/lib/onboarding/toast-client'
      );
      toastGoldenPathStep('rate_partner');
      setComment('');
      onSaved?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const noun =
    rateeRole === 'customer'
      ? 'customer'
      : rateeRole === 'supplier'
        ? 'supplier'
        : 'partner';

  const canSubmit =
    Boolean(rateeId) &&
    (peerOptions.length > 0 || (lockRatee && Boolean(initial)));

  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white space-y-5 ${
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'
      }`}
    >
      {!compact && (
        <div>
          <h3 className="text-lg font-black text-slate-900">Rate a {noun}</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Subjective business feedback for companies you work with. This does{' '}
            <strong>not</strong> replace OTIFEF (objective PO scores).
          </p>
        </div>
      )}

      <div>
        <label className="text-xs font-bold text-slate-600">Company *</label>
        {lockRatee && rateeId ? (
          <div className="mt-1 w-full rounded-2xl border border-sky-100 bg-sky-50/80 px-3 py-2.5 text-sm font-semibold text-slate-900">
            {initialRateeName ||
              peerOptions.find((p) => String(p.profileId) === rateeId)
                ?.trading_name ||
              `Company #${rateeId}`}
            <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-sky-700">
              {noun}
            </span>
          </div>
        ) : (
          <select
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
            value={rateeId}
            onChange={(e) => setRateeId(e.target.value)}
          >
            <option value="">Select connected company…</option>
            {peerOptions.map((p) => (
              <option key={p.profileId} value={String(p.profileId)}>
                {p.trading_name}
                {p.role ? ` · ${p.role}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="text-xs font-bold text-slate-600">Overall rating *</label>
        <div className="mt-2">
          <StarRating
            value={overall}
            onChange={setOverall}
            size={compact ? 'md' : 'lg'}
            label="Overall"
          />
          <StarSelectionCaption value={overall} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          Dimension scores (optional)
        </div>
        {dims.map((d) => (
          <div
            key={d.key}
            className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-slate-900">{d.label}</div>
                {!compact && (
                  <div className="text-[11px] text-slate-500">{d.hint}</div>
                )}
              </div>
              <StarRating
                value={scores[d.key] || 0}
                onChange={(n) => setDim(d.key, n)}
                size="md"
                label={d.label}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-bold text-slate-600">Comment (optional)</label>
        <textarea
          className={`mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm ${
            compact ? 'min-h-[64px]' : 'min-h-[80px]'
          }`}
          placeholder="Facts only — what went well or needs improvement…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
        />
      </div>

      <button
        type="button"
        disabled={saving || !canSubmit}
        onClick={() => void submit()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00b4d8] hover:bg-[#0096c7] text-white font-bold py-3 text-sm disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Publish {noun} rating
      </button>

      {!hideLegend && <StarScaleLegend />}
    </div>
  );
}
