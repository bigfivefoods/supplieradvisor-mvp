'use client';

import { StarRating } from './StarRating';
import {
  OVERALL_STAR_GUIDE,
  starGuide,
} from '@/lib/ratings/company-rating';

/** Compact legend: what each star means */
export function StarScaleLegend({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3 ${className}`}
    >
      <div className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 mb-2">
        Star scale (business feedback)
      </div>
      <ul className="space-y-2">
        {([5, 4, 3, 2, 1] as const).map((n) => {
          const g = OVERALL_STAR_GUIDE[n];
          return (
            <li key={n} className="flex gap-3 items-start text-sm">
              <span className="shrink-0 font-black tabular-nums text-amber-800 w-4">
                {n}
              </span>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-xs">{g.label}</div>
                <div className="text-[11px] text-slate-600 leading-snug">
                  {g.description}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[10px] text-slate-500 leading-relaxed border-t border-amber-100/80 pt-2">
        <strong>Note:</strong> Stars are peer business feedback. OTIFEF (On-Time ×
        In-Full × Error-Free) is calculated objectively from purchase-order delivery
        data and is shown separately on reports.
      </p>
    </div>
  );
}

/** Live caption under interactive stars */
export function StarSelectionCaption({ value }: { value: number }) {
  if (!value || value < 1) {
    return (
      <p className="text-xs text-slate-500 mt-1.5">Select 1–5 stars</p>
    );
  }
  const g = starGuide(value);
  return (
    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <StarRating value={value} readOnly size="sm" />
        <span className="text-xs font-black text-slate-900">{g.label}</span>
      </div>
      <p className="text-[11px] text-slate-600 mt-1 leading-snug">{g.description}</p>
    </div>
  );
}
