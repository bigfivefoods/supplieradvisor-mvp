'use client';

import Link from 'next/link';
import { ArrowRight, Rocket } from 'lucide-react';
import type { TradeNextAction } from '@/lib/connections/next-action';

/** Compact hub CTA for the shared trade-loop next step. */
export default function TradeNextBanner({
  action,
}: {
  action: TradeNextAction;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-[#00b4d8]/30 bg-gradient-to-br from-[#e0f7fc] to-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="min-w-0 flex items-start gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00b4d8]/15 text-[#0077b6]">
          <Rocket className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-black text-slate-900">{action.title}</p>
          <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
            {action.body}
          </p>
        </div>
      </div>
      <Link
        href={action.href}
        className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5 shrink-0"
      >
        {action.cta} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
