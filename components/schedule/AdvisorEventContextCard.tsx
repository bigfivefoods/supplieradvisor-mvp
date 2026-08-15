'use client';

/**
 * Context card when an advisor selects a calendar event —
 * membership, relationship, packs, actions (not a bare Outlook event).
 */

import Link from 'next/link';
import type { EnrichedScheduleEvent } from '@/lib/services/advisor-calendar-intelligence';
import { MessageSquare, User, HeartPulse } from 'lucide-react';

type Props = {
  event: EnrichedScheduleEvent | null;
  clientsHref?: string;
  messagesHref?: string;
  onClose?: () => void;
};

export function AdvisorEventContextCard({
  event,
  clientsHref = '/dashboard/fitgraph/clients',
  messagesHref = '/dashboard/fitgraph/messages',
  onClose,
}: Props) {
  if (!event) return null;

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-800 dark:bg-violet-950/30 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-violet-50">
            {event.title}
          </p>
          <p className="text-[11px] text-slate-600 dark:text-violet-100/80">
            {event.date} · {event.start_time}
            {event.end_time ? `–${event.end_time}` : ''}
            {event.person_name ? ` · ${event.person_name}` : ''}
          </p>
          {event.subtitle ? (
            <p className="text-[11px] text-slate-500 mt-0.5">{event.subtitle}</p>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            className="text-[10px] font-bold text-slate-500"
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {event.relationship_level ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white border border-violet-200 px-2 py-0.5 text-[10px] font-black uppercase dark:bg-violet-950 dark:border-violet-700">
            <HeartPulse className="w-3 h-3" />
            {event.relationship_level}
            {event.relationship_score != null ? ` · ${event.relationship_score}` : ''}
          </span>
        ) : null}
        {event.no_show_risk ? (
          <span className="rounded-full bg-rose-100 text-rose-900 px-2 py-0.5 text-[10px] font-black uppercase">
            no-show risk
          </span>
        ) : null}
        {event.waitlist_count ? (
          <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-black uppercase">
            waitlist {event.waitlist_count}
          </span>
        ) : null}
        {event.pack_remaining != null ? (
          <span className="rounded-full bg-emerald-100 text-emerald-900 px-2 py-0.5 text-[10px] font-black uppercase">
            pack {event.pack_remaining} left
          </span>
        ) : null}
        {event.is_private_client ? (
          <span className="rounded-full bg-sky-100 text-sky-900 px-2 py-0.5 text-[10px] font-black uppercase">
            private client
          </span>
        ) : null}
      </div>

      {event.meta ? (
        <p className="text-[11px] text-slate-500">{event.meta}</p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={clientsHref}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-300"
        >
          <User className="w-3 h-3" /> Customer profile
        </Link>
        <Link
          href={messagesHref}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-fuchsia-700 dark:text-fuchsia-300"
        >
          <MessageSquare className="w-3 h-3" /> Message
        </Link>
      </div>
    </div>
  );
}

export default AdvisorEventContextCard;
