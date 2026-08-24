'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import {
  ZAR_DISPLAY_PAIRS,
  formatZarPair,
  rateToZar,
  type FxRatesPayload,
} from '@/lib/fx/types';

type Props = {
  /** Kept for call-site compat — strip always quotes USD / GBP / EUR in ZAR. */
  currency?: string;
  className?: string;
  compact?: boolean;
};

/**
 * Live FX strip — USD:ZAR, GBP:ZAR, EUR:ZAR only.
 * Rates are indicative (ECB via Frankfurter); not a bank feed.
 */
export default function FxRateStrip({
  className = '',
  compact = false,
}: Props) {
  const [fx, setFx] = useState<FxRatesPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fx/rates?base=USD');
      const data = await res.json();
      if (res.ok && data.rates) {
        setFx({
          base: data.base || 'USD',
          date: data.date || null,
          rates: data.rates,
          source: data.source || 'fx',
          fetchedAt: data.fetchedAt || new Date().toISOString(),
          stale: data.stale,
          warning: data.warning,
        });
      }
    } catch {
      /* ignore — strip hides if empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const rates = fx?.rates || {};
  const pairs = ZAR_DISPLAY_PAIRS.map((from) => ({
    from,
    label: formatZarPair(from, rateToZar(from, rates)),
  }));

  if (compact) {
    return (
      <div
        className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-600 ${className}`}
      >
        <TrendingUp className="w-3.5 h-3.5 text-[#00b4d8] shrink-0" />
        {loading && !fx ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            {pairs.map((p) => (
              <span key={p.from} className="font-semibold text-slate-700 tabular-nums">
                {p.label}
              </span>
            ))}
            {fx?.date && (
              <span className="text-neutral-400">· {fx.date}</span>
            )}
            {fx?.stale && (
              <span className="text-amber-700 font-medium">approx</span>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => void load()}
          className="text-neutral-400 hover:text-[#0077b6]"
          title="Refresh FX"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[#00b4d8]/20 bg-gradient-to-r from-[#00b4d8]/5 to-white px-4 py-3 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#0077b6]">
          <TrendingUp className="w-4 h-4" />
          Live FX
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-[#0077b6]"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && !fx ? (
        <div className="flex items-center gap-2 text-xs text-neutral-500 py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading rates…
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {pairs.map((p) => (
              <span
                key={p.from}
                className="text-[11px] font-semibold px-2 py-1 rounded-full bg-white border border-neutral-200 text-slate-700 tabular-nums"
              >
                {p.label}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-neutral-400 mt-1.5">
            Indicative ECB reference
            {fx?.date ? ` · ${fx.date}` : ''}
            {fx?.source ? ` · ${fx.source}` : ''}
            {fx?.stale ? ' · approximate fallback' : ''} — not a bank settlement rate.
          </p>
          {fx?.warning && (
            <p className="text-[10px] text-amber-700 mt-0.5">{fx.warning}</p>
          )}
        </>
      )}
    </div>
  );
}
