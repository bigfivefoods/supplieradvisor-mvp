'use client';

import {
  PO_LIFECYCLE,
  readStatusTrail,
  trailLabel,
  type StatusTrailEvent,
} from '@/lib/schools/order-process';

type Props = {
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  deliveryStatus?: string | null;
  compact?: boolean;
};

function activeIndex(status?: string | null, deliveryStatus?: string | null) {
  const po = String(status || '').toLowerCase();
  const dn = String(deliveryStatus || '').toLowerCase();
  if (['received', 'closed', 'complete', 'partially_received'].includes(po) || dn === 'received')
    return 5;
  if (dn === 'delivered' || po === 'delivered') return 4;
  if (dn === 'dispatched' || po === 'dispatched') return 3;
  if (['fulfilling', 'confirmed'].includes(po) || dn === 'confirmed') return 2;
  if (po === 'accepted') return 1;
  if (po === 'submitted') return 0;
  return -1;
}

export default function PoStatusTrail({
  status,
  metadata,
  deliveryStatus,
  compact,
}: Props) {
  const idx = activeIndex(status, deliveryStatus);
  const trail = readStatusTrail(metadata);
  const events: StatusTrailEvent[] =
    trail.length > 0
      ? trail
      : status
        ? [
            {
              at: new Date().toISOString(),
              status: String(status),
              label: trailLabel(String(status)),
            },
          ]
        : [];

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {PO_LIFECYCLE.map((step, i) => {
          const done = idx >= i;
          const active = idx === i;
          return (
            <div
              key={step.status}
              className={`shrink-0 rounded-xl border px-2 py-1.5 min-w-[4.75rem] ${
                active
                  ? 'border-sky-400 bg-sky-50'
                  : done
                    ? 'border-emerald-200 bg-emerald-50/80'
                    : 'border-slate-100 bg-slate-50'
              }`}
              title={step.label}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {i + 1}
              </p>
              <p
                className={`text-[10px] font-bold leading-tight ${
                  active
                    ? 'text-sky-900'
                    : done
                      ? 'text-emerald-900'
                      : 'text-slate-500'
                }`}
              >
                {step.label.replace(/^SP |^School /, '')}
              </p>
            </div>
          );
        })}
      </div>
      {!compact && events.length > 0 ? (
        <ul className="text-[11px] text-slate-600 space-y-1 max-h-28 overflow-y-auto">
          {[...events].reverse().slice(0, 8).map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex gap-2">
              <span className="tabular-nums text-slate-400 shrink-0">
                {String(e.at).slice(0, 16).replace('T', ' ')}
              </span>
              <span className="font-semibold text-slate-800">{e.label}</span>
              {e.note ? (
                <span className="text-slate-500 truncate">· {e.note}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
