'use client';

/**
 * Selected calendar event — customer context, reminders, ICS, quick reschedule.
 */

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  MessageSquare,
  User,
  HeartPulse,
  Mail,
  Phone,
  Download,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertTriangle,
} from 'lucide-react';
import type { EnrichedScheduleEvent } from '@/lib/services/advisor-calendar-intelligence';
import {
  buildIcsCalendar,
  downloadIcsBrowser,
  shiftSlot,
} from '@/lib/schedule/advisor-ics';

export type EventReminderTarget = {
  email?: string | null;
  phone?: string | null;
  personName?: string;
  brand?: string;
  manageUrl?: string;
  moduleLabel?: string;
  companyId?: number | string;
};

type Props = {
  event: EnrichedScheduleEvent | null;
  clientsHref?: string;
  messagesHref?: string;
  onClose?: () => void;
  reminder?: EventReminderTarget | null;
  onReschedule?: (next: {
    id: string;
    date: string;
    start_time: string;
  }) => void | Promise<void>;
  authHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  materialsSummary?: {
    count: number;
    billableTotal: number;
    labels: string[];
    hasLowStock?: boolean;
    hasOutOfStock?: boolean;
  } | null;
};

export function AdvisorEventContextCard({
  event,
  clientsHref = '/dashboard/fitgraph/clients',
  messagesHref = '/dashboard/fitgraph/messages',
  onClose,
  reminder,
  onReschedule,
  authHeaders,
  materialsSummary,
}: Props) {
  const [busy, setBusy] = useState(false);
  if (!event) return null;

  const downloadOne = () => {
    const ics = buildIcsCalendar([
      {
        id: event.id,
        title: event.title,
        description: [event.subtitle, event.meta].filter(Boolean).join(' · '),
        date: event.date,
        start_time: event.start_time,
        end_time: event.end_time,
        duration_min: event.duration_min,
      },
    ]);
    downloadIcsBrowser(`${event.title.replace(/\s+/g, '-')}-${event.date}.ics`, ics);
    toast.success('ICS downloaded — import into Outlook or Google as a mirror');
  };

  const sendEmailReminder = async () => {
    if (!reminder?.email || !reminder.companyId) {
      toast.error('Customer email or company missing');
      return;
    }
    setBusy(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(authHeaders ? await authHeaders() : {}),
      };
      const res = await fetch('/api/schedule/remind', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          companyId: reminder.companyId,
          channel: 'email',
          to: reminder.email,
          personName: reminder.personName || 'there',
          brand: reminder.brand || 'Practice',
          eventTitle: event.title,
          date: event.date,
          start_time: event.start_time,
          location: event.subtitle,
          manageUrl: reminder.manageUrl,
          moduleLabel: reminder.moduleLabel,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Send failed');
      toast.success(`Reminder emailed to ${reminder.email}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Email failed');
    } finally {
      setBusy(false);
    }
  };

  const openWhatsApp = async () => {
    if (!reminder?.companyId) {
      toast.error('Company missing');
      return;
    }
    setBusy(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(authHeaders ? await authHeaders() : {}),
      };
      const res = await fetch('/api/schedule/remind', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          companyId: reminder.companyId,
          channel: 'whatsapp',
          phone: reminder.phone || '',
          personName: reminder.personName || 'there',
          brand: reminder.brand || 'Practice',
          eventTitle: event.title,
          date: event.date,
          start_time: event.start_time,
          manageUrl: reminder.manageUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'WhatsApp failed');
      if (data.whatsapp_url && typeof window !== 'undefined') {
        window.open(String(data.whatsapp_url), '_blank', 'noopener,noreferrer');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'WhatsApp failed');
    } finally {
      setBusy(false);
    }
  };

  const move = async (deltaMin: number) => {
    if (!onReschedule) return;
    const next = shiftSlot(event.date, event.start_time, deltaMin);
    setBusy(true);
    try {
      await onReschedule({ id: event.id, ...next });
      toast.success(`Moved to ${next.date} ${next.start_time}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Reschedule failed');
    } finally {
      setBusy(false);
    }
  };

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
          <button type="button" className="text-[10px] font-bold text-slate-500" onClick={onClose}>
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

      {materialsSummary && materialsSummary.count > 0 ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-2.5 py-2 dark:border-sky-800 dark:bg-sky-950/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-900 dark:text-sky-200">
              <Package className="w-3.5 h-3.5" />
              Materials used ({materialsSummary.count})
            </div>
            {materialsSummary.billableTotal > 0 ? (
              <span className="text-[11px] font-black text-sky-900 dark:text-sky-100">
                R{materialsSummary.billableTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
              </span>
            ) : null}
          </div>
          {materialsSummary.labels.length > 0 ? (
            <p className="mt-1 text-[10px] leading-snug text-sky-800/90 dark:text-sky-300/90">
              {materialsSummary.labels.join(' · ')}
              {materialsSummary.count > materialsSummary.labels.length
                ? ` · +${materialsSummary.count - materialsSummary.labels.length} more`
                : ''}
            </p>
          ) : null}
          {materialsSummary.hasOutOfStock || materialsSummary.hasLowStock ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800">
              <AlertTriangle className="w-3 h-3" />
              {materialsSummary.hasOutOfStock
                ? 'Includes out-of-stock items at time of use'
                : 'Includes low-stock items'}
            </p>
          ) : null}
        </div>
      ) : null}

      {onReschedule ? (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={busy} onClick={() => void move(-15)} className="inline-flex items-center gap-0.5 rounded-lg border border-violet-300 bg-white px-2 py-1 text-[10px] font-bold text-violet-900 disabled:opacity-50">
            <ChevronLeft className="w-3 h-3" /> −15m
          </button>
          <button type="button" disabled={busy} onClick={() => void move(15)} className="inline-flex items-center gap-0.5 rounded-lg border border-violet-300 bg-white px-2 py-1 text-[10px] font-bold text-violet-900 disabled:opacity-50">
            +15m <ChevronRight className="w-3 h-3" />
          </button>
          <button type="button" disabled={busy} onClick={() => void move(24 * 60)} className="rounded-lg border border-violet-300 bg-white px-2 py-1 text-[10px] font-bold text-violet-900 disabled:opacity-50">
            +1 day
          </button>
          <button type="button" disabled={busy} onClick={() => void move(-24 * 60)} className="rounded-lg border border-violet-300 bg-white px-2 py-1 text-[10px] font-bold text-violet-900 disabled:opacity-50">
            −1 day
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy} onClick={downloadOne} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700">
          <Download className="w-3 h-3" /> ICS
        </button>
        {reminder?.email ? (
          <button type="button" disabled={busy} onClick={() => void sendEmailReminder()} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-900 disabled:opacity-50">
            <Mail className="w-3 h-3" /> Email reminder
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => void openWhatsApp()} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900 disabled:opacity-50">
          <Phone className="w-3 h-3" /> WhatsApp
        </button>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={clientsHref} className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-300">
          <User className="w-3 h-3" /> Customer profile
        </Link>
        <Link href={messagesHref} className="inline-flex items-center gap-1 text-[11px] font-bold text-fuchsia-700 dark:text-fuchsia-300">
          <MessageSquare className="w-3 h-3" /> Message
        </Link>
      </div>
    </div>
  );
}

export default AdvisorEventContextCard;
