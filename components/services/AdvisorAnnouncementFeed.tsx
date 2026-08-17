'use client';

import { Megaphone, Pin } from 'lucide-react';

export type AdvisorAnnouncementCard = {
  id: string;
  kind?: string;
  title: string;
  body: string;
  pinned?: boolean;
  cta_label?: string | null;
  cta_href?: string | null;
};

export function AdvisorAnnouncementFeed({
  items,
  title = 'From the desk',
}: {
  items?: AdvisorAnnouncementCard[] | null;
  title?: string;
}) {
  const rows = (items || []).filter((r) => r.title || r.body);
  if (!rows.length) return null;
  return (
    <section className="space-y-2">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
        <Megaphone className="h-3.5 w-3.5" /> {title}
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-black text-slate-900">{row.title}</p>
              {row.pinned ? (
                <Pin className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              ) : null}
            </div>
            {row.body ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {row.body}
              </p>
            ) : null}
            {row.cta_href && row.cta_label ? (
              <a
                href={row.cta_href}
                className="mt-2 inline-flex text-xs font-bold text-sky-700 underline"
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
