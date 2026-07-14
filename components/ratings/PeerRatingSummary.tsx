'use client';

import { Star } from 'lucide-react';
import { StarRating, formatAvgRating } from './StarRating';

type PeerRatingSummaryProps = {
  avgPeerRating: number | null | undefined;
  publishedCount: number;
  totalCount?: number;
  className?: string;
  /** Clarify this is peer reputation, not CRM internal score */
  note?: string;
};

/**
 * Bilateral peer aggregate for seller CRM / performance UI.
 * Separate from customers.rating (internal seller score).
 */
export function PeerRatingSummary({
  avgPeerRating,
  publishedCount,
  totalCount,
  className = '',
  note = 'Peer reputation from post-PO reviews (bilateral only — not public). Separate from internal CRM rating.',
}: PeerRatingSummaryProps) {
  const hasData = publishedCount > 0 && avgPeerRating != null;

  return (
    <div
      className={`bg-gradient-to-br from-[#00b4d8]/10 to-white border border-[#00b4d8]/20 rounded-3xl p-6 ${className}`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-[#00b4d8] mb-3">
        <Star className="w-4 h-4 fill-[#00b4d8]" />
        Peer rating
      </div>
      {hasData ? (
        <div className="flex items-end gap-4 flex-wrap">
          <div className="text-4xl font-black tracking-tight text-neutral-900">
            {formatAvgRating(avgPeerRating)}
            <span className="text-lg font-semibold text-neutral-400">/5</span>
          </div>
          <div className="pb-1">
            <StarRating value={Number(avgPeerRating)} readOnly size="md" />
            <p className="text-xs text-neutral-500 mt-1">
              {publishedCount} published review{publishedCount === 1 ? '' : 's'}
              {totalCount != null && totalCount > publishedCount
                ? ` · ${totalCount - publishedCount} hidden`
                : ''}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          No published peer reviews yet. Reviews unlock when buyer POs reach paid or
          completed.
        </p>
      )}
      {note && <p className="text-xs text-neutral-400 mt-3 max-w-md">{note}</p>}
    </div>
  );
}
