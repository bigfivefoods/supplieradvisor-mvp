'use client';

/**
 * Owner desk — publish ads / notices to every member on this Advisor portal.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Megaphone,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  AnnouncementKind,
  AnnouncementStatus,
  MemberAnnouncement,
} from '@/lib/services/member-announcements';
import { normalizeAnnouncements } from '@/lib/services/member-announcements';

const KIND_LABEL: Record<AnnouncementKind, string> = {
  notice: 'Notice',
  ad: 'Advert',
  offer: 'Offer',
  alert: 'Alert',
};

const emptyForm = {
  id: '',
  kind: 'notice' as AnnouncementKind,
  title: '',
  body: '',
  cta_label: '',
  cta_href: '',
  pinned: false,
  starts_at: '',
  ends_at: '',
};

type Props = {
  items?: MemberAnnouncement[] | unknown;
  post: (body: Record<string, unknown>) => Promise<unknown>;
  saving?: boolean;
  accentClass?: string;
  buttonClass?: string;
};

export function AdvisorAnnouncementsDesk({
  items,
  post,
  saving,
  accentClass = 'border-slate-200',
  buttonClass = 'bg-slate-900 hover:bg-slate-800 text-white',
}: Props) {
  const rows = useMemo(() => normalizeAnnouncements(items), [items]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState<'all' | AnnouncementStatus>('all');

  const visible = rows.filter((r) =>
    filter === 'all' ? true : r.status === filter
  );

  const edit = (row: MemberAnnouncement) => {
    setForm({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      cta_label: row.cta_label || '',
      cta_href: row.cta_href || '',
      pinned: row.pinned === true,
      starts_at: (row.starts_at || '').slice(0, 16),
      ends_at: (row.ends_at || '').slice(0, 16),
    });
  };

  const save = async (publish: boolean) => {
    try {
      await post({
        action: 'upsert_announcement',
        announcement: {
          id: form.id || undefined,
          kind: form.kind,
          title: form.title,
          body: form.body,
          cta_label: form.cta_label,
          cta_href: form.cta_href,
          pinned: form.pinned,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
        },
        publish,
      });
      toast.success(publish ? 'Published to all members' : 'Draft saved');
      setForm(emptyForm);
    } catch {
      /* toast in workbench post */
    }
  };

  const act = async (action: string, id: string, extra?: Record<string, unknown>) => {
    try {
      await post({ action, id, ...extra });
    } catch {
      /* toast in workbench */
    }
  };

  return (
    <div className="space-y-5">
      <div
        className={`rounded-2xl border bg-white p-4 space-y-3 ${accentClass}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-black text-slate-900">
              {form.id ? 'Edit communication' : 'New communication'}
            </h2>
          </div>
          {form.id ? (
            <button
              type="button"
              className="text-[11px] font-bold text-slate-500"
              onClick={() => setForm(emptyForm)}
            >
              New
            </button>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          Published notices and ads appear on every member&apos;s portal for
          this business.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-[10px] font-bold uppercase text-slate-500">
            Type
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              value={form.kind}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  kind: e.target.value as AnnouncementKind,
                }))
              }
            >
              {Object.entries(KIND_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-5 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) =>
                setForm((f) => ({ ...f, pinned: e.target.checked }))
              }
            />
            Pin to top
          </label>
        </div>
        <label className="block text-[10px] font-bold uppercase text-slate-500">
          Title
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
            value={form.title}
            maxLength={120}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="December membership special"
          />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-500">
          Message
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[7rem]"
            value={form.body}
            maxLength={2000}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="What should every member see?"
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-[10px] font-bold uppercase text-slate-500">
            Button label
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.cta_label}
              onChange={(e) =>
                setForm((f) => ({ ...f, cta_label: e.target.value }))
              }
              placeholder="Book now"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase text-slate-500">
            Button link
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.cta_href}
              onChange={(e) =>
                setForm((f) => ({ ...f, cta_href: e.target.value }))
              }
              placeholder="https://… or /member/…"
            />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-[10px] font-bold uppercase text-slate-500">
            Show from
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.starts_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, starts_at: e.target.value }))
              }
            />
          </label>
          <label className="block text-[10px] font-bold uppercase text-slate-500">
            Hide after
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.ends_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, ends_at: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || (!form.title.trim() && !form.body.trim())}
            onClick={() => void save(false)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={saving || !form.title.trim()}
            onClick={() => void save(true)}
            className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50 ${buttonClass}`}
          >
            <Plus className="h-3.5 w-3.5" />
            Publish to members
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['all', 'published', 'draft', 'archived'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1 text-[11px] font-black capitalize ${
              filter === id
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {id}
            {id !== 'all'
              ? ` · ${rows.filter((r) => r.status === id).length}`
              : ` · ${rows.length}`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No {filter === 'all' ? 'communications' : filter + ' items'} yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => edit(row)}
                >
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    {KIND_LABEL[row.kind]} · {row.status}
                    {row.pinned ? ' · pinned' : ''}
                  </p>
                  <p className="mt-0.5 text-sm font-black text-slate-900">
                    {row.title || '(untitled)'}
                  </p>
                  {row.body ? (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {row.body}
                    </p>
                  ) : null}
                </button>
                <div className="flex shrink-0 flex-col gap-1">
                  {row.status === 'published' ? (
                    <button
                      type="button"
                      className="text-[11px] font-bold text-slate-600"
                      onClick={() => void act('unpublish_announcement', row.id)}
                    >
                      Unpublish
                    </button>
                  ) : row.status !== 'archived' ? (
                    <button
                      type="button"
                      className="text-[11px] font-bold text-emerald-700"
                      onClick={() => void act('publish_announcement', row.id)}
                    >
                      Publish
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600"
                    onClick={() =>
                      void act('upsert_announcement', row.id, {
                        announcement: { ...row, pinned: !row.pinned },
                      })
                    }
                  >
                    {row.pinned ? (
                      <PinOff className="h-3 w-3" />
                    ) : (
                      <Pin className="h-3 w-3" />
                    )}
                    {row.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  {row.status !== 'archived' ? (
                    <button
                      type="button"
                      className="text-[11px] font-bold text-amber-800"
                      onClick={() => void act('archive_announcement', row.id)}
                    >
                      Archive
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600"
                    onClick={() => {
                      if (confirm('Delete this communication?')) {
                        void act('delete_announcement', row.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
