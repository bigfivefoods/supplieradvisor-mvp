'use client';

import { StarRating } from './StarRating';
import type { PoReviewRecord } from '@/lib/procurement/types';

type ReviewCardProps = {
  review: PoReviewRecord;
  /** Extra context line e.g. "Buyer company #12" */
  subtitle?: string;
  /** Seller moderation actions */
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Display a single peer review (bilateral — not public).
 */
export function ReviewCard({
  review,
  subtitle,
  actions,
  className = '',
}: ReviewCardProps) {
  const status = String(review.status || 'published').toLowerCase();
  const hidden = status === 'hidden';
  const dims =
    review.dimensions && typeof review.dimensions === 'object'
      ? review.dimensions
      : null;

  return (
    <article
      className={`bg-white border rounded-3xl p-5 ${
        hidden ? 'border-neutral-200 opacity-75' : 'border-neutral-200'
      } ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <StarRating value={Number(review.rating) || 0} readOnly size="sm" />
            <span className="text-sm font-semibold text-neutral-800">
              {Number(review.rating) || 0}/5
            </span>
            {hidden && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600">
                Hidden
              </span>
            )}
          </div>
          {review.title && (
            <h4 className="font-semibold text-neutral-900 mt-2">{review.title}</h4>
          )}
          {subtitle && (
            <p className="text-xs text-neutral-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="text-right text-xs text-neutral-400">
          <div>PO #{review.purchase_order_id}</div>
          {review.created_at && (
            <div>
              {new Date(review.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          )}
        </div>
      </div>

      {review.body && (
        <p className="text-sm text-neutral-700 mt-3 whitespace-pre-wrap">{review.body}</p>
      )}

      {dims && Object.keys(dims).length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-neutral-100">
          {Object.entries(dims).map(([key, val]) => (
            <div key={key} className="text-xs text-neutral-600">
              <span className="capitalize font-medium">{key}</span>:{' '}
              <span>{Number(val)}/5</span>
            </div>
          ))}
        </div>
      )}

      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}
