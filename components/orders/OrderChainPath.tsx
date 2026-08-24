'use client';

import { ChevronRight } from 'lucide-react';
import {
  chainStepsFor,
  type ChainSide,
} from '@/lib/orders/chain-path';

export function OrderChainPath({
  side,
  current,
  compact,
}: {
  side: ChainSide;
  current?: number;
  compact?: boolean;
}) {
  const steps = chainStepsFor(side);
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, i) => {
        const on = current != null && i === current;
        const done = current != null && i < current;
        return (
          <li key={step.id} className="flex items-center gap-1.5">
            {i > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
            ) : null}
            <span
              className={`rounded-full px-2.5 py-1 font-semibold ${
                compact ? 'text-[10px]' : 'text-[11px]'
              } ${
                on
                  ? 'bg-[#0077b6] text-white'
                  : done
                    ? 'bg-emerald-50 text-emerald-900'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
