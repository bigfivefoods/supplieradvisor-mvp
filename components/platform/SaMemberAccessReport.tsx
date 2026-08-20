'use client';

import { useMemo, useState } from 'react';
import {
  Clock3,
  Download,
  Search,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  SaMemberAccessReport,
  SaMemberAccessRow,
} from '@/lib/system/sa-member-access-report';
import { formatDurationMs } from '@/lib/b2c/access-log';

function ago(iso?: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  if (ms < 45_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 21) return `${d}d ago`;
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso.slice(0, 10);
  }
}

function when(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCsv(rows: SaMemberAccessRow[]) {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Signed up',
    'Last login',
    'Last seen',
    'Last surface',
    'PWA or site',
    'Last path',
    'Sessions',
    'Visits',
    'Total time',
    'Last session',
    'Avg session',
    'Sites / PWAs',
    'City',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.name || '',
        r.email || '',
        r.phone || '',
        r.signed_up_at || '',
        r.last_login_at || '',
        r.last_seen_at || '',
        r.last_surface_label || '',
        r.last_display_label || '',
        r.last_path || '',
        String(r.session_count),
        String(r.visit_count),
        r.total_active_label,
        r.last_session_label,
        r.avg_session_label,
        r.site_summary,
        r.city || '',
      ]
        .map((v) => csvEscape(String(v)))
        .join(',')
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SA-Member-Access-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success(`Exported ${rows.length} SA Member row${rows.length === 1 ? '' : 's'}`);
}

type FilterId = 'all' | 'today' | 'week' | 'new' | 'pwa';

export function SaMemberAccessReportView({
  report,
}: {
  report: SaMemberAccessReport;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const since24 = Date.now() - 24 * 3600 * 1000;
  const since7 = Date.now() - 7 * 24 * 3600 * 1000;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return report.members.filter((row) => {
      if (filter === 'today') {
        const t = Date.parse(row.last_seen_at || '');
        if (!t || t < since24) return false;
      }
      if (filter === 'week') {
        const t = Date.parse(row.last_seen_at || '');
        if (!t || t < since7) return false;
      }
      if (filter === 'new') {
        const t = Date.parse(row.signed_up_at || '');
        if (!t || t < since7) return false;
      }
      if (filter === 'pwa' && row.last_display !== 'standalone') return false;
      if (!needle) return true;
      const hay = [
        row.name,
        row.email,
        row.phone,
        row.city,
        row.last_surface_label,
        row.last_display_label,
        row.last_path,
        row.site_summary,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [report.members, q, filter, since24, since7]);

  const s = report.summary;
  const chips: Array<{ id: FilterId; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Active 24h' },
    { id: 'week', label: 'Active 7d' },
    { id: 'new', label: 'New 7d' },
    { id: 'pwa', label: 'Last on PWA' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="SA Members"
          value={s.total}
          hint={`${s.new_7d} new in 7d · ${s.new_30d} in 30d`}
        />
        <Metric
          label="Active 24h"
          value={s.active_24h}
          hint={`${s.active_7d} in 7d`}
        />
        <Metric
          label="Last opened as PWA"
          value={s.pwa_last}
          hint={`${s.with_sites} with a linked gym / clinic / hire`}
        />
        <Metric
          label="Avg time in app"
          value={formatDurationMs(s.avg_session_ms)}
          hint={`All sessions ${formatDurationMs(s.total_active_ms)}`}
        />
      </div>

      <p className="text-xs text-slate-500">{report.note}</p>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-[#00b4d8]" />
            <h2 className="text-sm font-black text-slate-900">
              Member access · latest activity first
            </h2>
          </div>
          <button
            type="button"
            onClick={() => downloadCsv(filtered)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                  filter === c.id
                    ? 'bg-[#0077b6] text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {c.label}
              </button>
            ))}
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs sm:ml-auto">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, gym…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            {filtered.length} of {report.members.length} wallets
          </p>
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No SA Members match that filter yet.
            </p>
          ) : (
            <div className="max-h-[min(75vh,48rem)] overflow-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[72rem] text-sm">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                  <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-2 pl-3 pr-2">Member</th>
                    <th className="py-2 pr-2">Last login</th>
                    <th className="py-2 pr-2">Last seen</th>
                    <th className="py-2 pr-2">Site / PWA</th>
                    <th className="py-2 pr-2">Duration</th>
                    <th className="py-2 pr-2">Linked places</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((row) => (
                    <tr key={row.user_id} className="align-top">
                      <td className="py-2.5 pl-3 pr-2">
                        <p className="font-black text-slate-900">
                          {row.name || '—'}
                        </p>
                        <p className="text-xs text-slate-600">{row.email || 'no email'}</p>
                        {row.phone ? (
                          <p className="text-[11px] text-slate-500">{row.phone}</p>
                        ) : null}
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Joined {ago(row.signed_up_at)}
                        </p>
                      </td>
                      <td className="py-2.5 pr-2">
                        <p className="font-bold text-slate-900">
                          {ago(row.last_login_at)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {when(row.last_login_at)}
                        </p>
                      </td>
                      <td className="py-2.5 pr-2">
                        <p className="font-bold text-slate-900">
                          {ago(row.last_seen_at)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {when(row.last_seen_at)}
                        </p>
                      </td>
                      <td className="py-2.5 pr-2">
                        <p className="font-bold text-slate-900">
                          {row.last_surface_label || '—'}
                        </p>
                        <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                          {row.last_display === 'standalone' ? (
                            <Smartphone className="h-3 w-3" />
                          ) : null}
                          {row.last_display_label || 'Not yet classified'}
                        </p>
                        {row.last_path ? (
                          <p className="font-mono text-[10px] text-slate-400">
                            {row.last_path}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-2">
                        <p className="inline-flex items-center gap-1 font-black tabular-nums text-slate-900">
                          <Clock3 className="h-3 w-3 text-slate-400" />
                          {row.total_active_label}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {row.session_count} session
                          {row.session_count === 1 ? '' : 's'}
                          {row.avg_session_ms
                            ? ` · avg ${row.avg_session_label}`
                            : ''}
                        </p>
                        {row.last_session_ms ? (
                          <p className="text-[11px] text-slate-400">
                            Last sit {row.last_session_label}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3">
                        {row.sites.length === 0 ? (
                          <p className="text-xs text-slate-400">Wallet only</p>
                        ) : (
                          <ul className="space-y-1">
                            {row.sites.map((site) => (
                              <li key={`${site.company_id}-${site.kind}-${site.path}`}>
                                <p className="text-xs font-bold text-slate-800">
                                  {site.brand}{' '}
                                  <span className="font-semibold text-slate-500">
                                    · {site.kind_label}
                                  </span>
                                </p>
                                {site.path ? (
                                  <p className="font-mono text-[10px] text-slate-400">
                                    {site.path}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black tabular-nums tracking-tight text-slate-900">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] font-medium text-slate-500">{hint}</div>
      ) : null}
    </div>
  );
}
