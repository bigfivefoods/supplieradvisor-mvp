'use client';

import { Megaphone } from 'lucide-react';
import type { MemberAnnouncementPublic } from '@/lib/services/member-announcements';

const KIND_LABEL: Record<string, string> = {
  notice: 'Notice',
  ad: 'Advert',
  offer: 'Offer',
  alert: 'Alert',
};

const TONE: Record<string, { wrap: string; chip: string; title: string }> = {
  yellow: {
    wrap: 'border-yellow-200 bg-white',
    chip: 'bg-yellow-100 text-yellow-900',
    title: 'text-yellow-900',
  },
  teal: {
    wrap: 'border-teal-200 bg-white',
    chip: 'bg-teal-100 text-teal-900',
    title: 'text-teal-900',
  },
  sky: {
    wrap: 'border-sky-200 bg-white',
    chip: 'bg-sky-100 text-sky-900',
    title: 'text-sky-900',
  },
  emerald: {
    wrap: 'border-emerald-200 bg-white',
    chip: 'bg-emerald-100 text-emerald-900',
    title: 'text-emerald-900',
  },
  rose: {
    wrap: 'border-rose-200 bg-white',
    chip: 'bg-rose-100 text-rose-900',
    title: 'text-rose-900',
  },
  indigo: {
    wrap: 'border-indigo-200 bg-white',
    chip: 'bg-indigo-100 text-indigo-900',
    title: 'text-indigo-900',
  },
};

export function MemberAnnouncementsFeed({
  items,
  brand,
  tone = 'emerald',
}: {
  items?: MemberAnnouncementPublic[] | null;
  brand?: string;
  tone?: keyof typeof TONE | string;
}) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  const t = TONE[tone] || TONE.emerald;

  return (
    <section className="space-y-2">
      <div className={`flex items-center gap-2 ${t.title}`}>
        <Megaphone className="h-4 w-4" />
        <h2 className="text-sm font-black">
          From {brand || 'the practice'}
        </h2>
      </div>
      <ul className="space-y-2">
        {list.map((row) => (
          <li
            key={row.id}
            className={`rounded-2xl border p-4 shadow-sm ${
              row.kind === 'alert'
                ? 'border-rose-200 bg-rose-50'
                : t.wrap
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              {KIND_LABEL[row.kind] || 'Notice'}
              {row.pinned ? ' · pinned' : ''}
            </p>
            <p className="mt-0.5 text-sm font-black text-slate-900">{row.title}</p>
            {row.body ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {row.body}
              </p>
            ) : null}
            {row.cta_href && row.cta_label ? (
              <a
                href={row.cta_href}
                className={`mt-3 inline-flex rounded-xl px-3 py-1.5 text-xs font-black ${t.chip}`}
              >
                {row.cta_label}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
