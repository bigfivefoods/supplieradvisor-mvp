'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { StarRating } from './StarRating';
import { PO_REVIEW_DIMENSION_KEYS } from '@/lib/procurement/types';

const DIMENSION_LABELS: Record<string, string> = {
  quality: 'Quality',
  delivery: 'Delivery',
  communication: 'Communication',
  value: 'Value',
};

export type ReviewFormSubmit = {
  rating: number;
  title?: string;
  body?: string;
  dimensions?: Record<string, number>;
};

type ReviewFormProps = {
  purchaseOrderId: number;
  supplierLabel?: string;
  submitting?: boolean;
  onSubmit: (data: ReviewFormSubmit) => void | Promise<void>;
  onCancel?: () => void;
};

/**
 * Post-PO peer review form: stars + optional title/body + dimension scores.
 */
export function ReviewForm({
  purchaseOrderId,
  supplierLabel,
  submitting = false,
  onSubmit,
  onCancel,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dimensions, setDimensions] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please select a star rating (1–5).');
      return;
    }
    setError(null);
    await onSubmit({
      rating,
      title: title.trim() || undefined,
      body: body.trim() || undefined,
      dimensions: Object.keys(dimensions).length ? dimensions : undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-neutral-200 rounded-3xl p-6 space-y-5"
    >
      <div>
        <h3 className="text-lg font-bold text-neutral-900">
          Review PO #{purchaseOrderId}
        </h3>
        {supplierLabel && (
          <p className="text-sm text-neutral-500 mt-1">Supplier: {supplierLabel}</p>
        )}
        <p className="text-xs text-neutral-400 mt-1">
          Bilateral peer review — visible only to your company and the supplier.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Overall rating *</label>
        <StarRating value={rating} onChange={setRating} size="lg" label="Overall rating" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PO_REVIEW_DIMENSION_KEYS.map((key) => (
          <div key={key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              {DIMENSION_LABELS[key] || key}
            </label>
            <StarRating
              value={dimensions[key] || 0}
              onChange={(n) => setDimensions((d) => ({ ...d, [key]: n }))}
              size="sm"
              label={DIMENSION_LABELS[key] || key}
            />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Title (optional)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="w-full px-4 py-2.5 border border-neutral-200 rounded-2xl focus:border-[#00b4d8] outline-none"
          placeholder="Short summary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Comments (optional)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={4}
          className="w-full px-4 py-2.5 border border-neutral-200 rounded-2xl focus:border-[#00b4d8] outline-none resize-y"
          placeholder="What went well? What could improve?"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting || rating < 1}
          className="btn-primary !py-2.5 !px-5 text-sm disabled:opacity-50 inline-flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit review
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-secondary !py-2.5 !px-5 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
