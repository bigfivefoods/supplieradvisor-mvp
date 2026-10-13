'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, FileText, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  downloadSpecialDatesCsv,
  formatSpecialDate,
  memberSpecialDates,
  missingBirthdayCount,
  specialDateKindLabel,
  specialDateMonthLabel,
  specialDateToday,
  specialDateWhen,
  specialDateWindowDays,
  specialDatesCsv,
  type MemberSpecialDate,
  type SpecialDatePerson,
  type SpecialDatePlace,
  type SpecialDateWindowId,
} from '@/lib/fitness/member-special-dates';

const WINDOWS: Array<{ id: SpecialDateWindowId; label: string }> = [
  { id: '14', label: 'Next 14 days' },
  { id: '30', label: 'Next 30 days' },
  { id: '90', label: 'Next 90 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'Next 12 months' },
];

const KINDS: Array<{ id: 'all' | 'birthday' | 'membership_anniversary'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'birthday', label: 'Birthdays' },
  { id: 'membership_anniversary', label: 'Anniversaries' },
];

const REPORT_KINDS = ['birthday', 'membership_anniversary'] as const;

function yearsCopy(row: MemberSpecialDate): string {
  if (row.years == null) return '—';
  if (row.kind === 'birthday') return `Turns ${row.years}`;
  if (row.kind === 'membership_anniversary') {
    return `${row.years} year${row.years === 1 ? '' : 's'}`;
  }
  return '—';
}

function chipClass(on: boolean): string {
  return `min-h-11 rounded-full border px-3 text-xs font-bold ${
    on
      ? 'border-[#0077b6] bg-[#0077b6] text-white dark:border-cyan-300 dark:bg-cyan-400 dark:text-slate-950'
      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-cyan-500/30 dark:bg-[#0b1e33] dark:text-cyan-50'
  }`;
}

export function SpecialDatesReport({
  people,
  place,
  hrefFor,
  assigneeLabel = 'Coach',
  assignees = [],
}: {
  people: SpecialDatePerson[];
  place: SpecialDatePlace;
  hrefFor?: (row: MemberSpecialDate) => string | null;
  assigneeLabel?: string;
  assignees?: Array<{ id: string; name: string }>;
}) {
  const [windowId, setWindowId] = useState<SpecialDateWindowId>('30');
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('all');
  const [assigneeId, setAssigneeId] = useState('');
  const [query, setQuery] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const from = useMemo(() => specialDateToday(), []);

  const scoped = useMemo(() => {
    if (!assigneeId) return people;
    return people.filter(
      (person) => person.active !== false && person.coach_id === assigneeId
    );
  }, [people, assigneeId]);

  const missing = useMemo(() => missingBirthdayCount(scoped), [scoped]);

  const rows = useMemo(
    () =>
      memberSpecialDates(scoped, {
        from,
        days: specialDateWindowDays(windowId, from),
        place,
        includeHousehold: true,
        kinds: [...REPORT_KINDS],
      }),
    [scoped, from, windowId, place]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (kind !== 'all' && row.kind !== kind) return false;
      if (!needle) return true;
      return row.name.toLowerCase().includes(needle);
    });
  }, [rows, kind, query]);

  const birthdayCount = rows.filter((row) => row.kind === 'birthday').length;
  const anniversaryCount = rows.filter(
    (row) => row.kind === 'membership_anniversary'
  ).length;
  const householdCount = rows.filter((row) => row.household).length;
  const assigneeNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const person of assignees) map[person.id] = person.name;
    return map;
  }, [assignees]);

  const windowLabel =
    WINDOWS.find((item) => item.id === windowId)?.label || 'Next 30 days';
  const anniversaryWord =
    place === 'practice' ? 'practice anniversaries' : 'gym anniversaries';

  const fileSlug = place === 'practice' ? 'medicaladvisor' : 'gymadvisor';

  const download = () => {
    downloadSpecialDatesCsv(
      `${fileSlug}-birthdays-${from}-${windowId}.csv`,
      specialDatesCsv(visible, {
        place,
        assigneeHeader: assigneeLabel,
        assigneeNames,
      })
    );
  };

  const downloadPdf = async () => {
    const companyId = getSelectedCompanyId();
    if (!companyId) {
      toast.error('Choose a company first');
      return;
    }
    setPdfBusy(true);
    try {
      const res = await fetch('/api/advisors/special-dates/pdf', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          place,
          windowLabel,
          windowId,
          from,
          assigneeHeader: assigneeLabel,
          missingBirthdays: missing.people,
          rows: visible.map((row) => ({
            name: row.name,
            kind: row.kind,
            on: row.on,
            years: row.years ?? null,
            days_until: row.days_until,
            assignee: row.coach_id ? assigneeNames[row.coach_id] || '' : '',
          })),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || 'Could not build the PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileSlug}-birthdays-${from}-${windowId}.pdf`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not build the PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const groups: Array<{ key: string; label: string; rows: MemberSpecialDate[] }> =
    [];
  for (const row of visible) {
    const key = row.on.slice(0, 7);
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      groups.push({ key, label: specialDateMonthLabel(row.on), rows: [row] });
    } else {
      last.rows.push(row);
    }
  }

  const columns = assignees.length
    ? ['When', 'Name', 'Occasion', 'Date', 'Years', assigneeLabel]
    : ['When', 'Name', 'Occasion', 'Date', 'Years'];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5 dark:border-cyan-400/25 dark:bg-gradient-to-br dark:from-[#061825] dark:via-[#0b2f44] dark:to-[#0c3d4a] dark:ring-0"
      aria-label="Birthdays and anniversaries"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-cyan-400/20 dark:bg-gradient-to-r dark:from-[#0c4a6e]/80 dark:via-[#0e7490]/50 dark:to-[#134e4a]/60">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">
            Birthdays and anniversaries
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-cyan-100/80">
            {place === 'practice' ? 'Patient' : 'Member'} birthdays and{' '}
            {anniversaryWord}. Household birthdays are included when a date of
            birth is on the file. Counted from today in Johannesburg,{' '}
            {formatSpecialDate(from)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            disabled={visible.length === 0 || pdfBusy}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 disabled:opacity-50 dark:border-cyan-300/40 dark:bg-transparent dark:text-cyan-50"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={visible.length === 0 || pdfBusy}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#0077b6] px-4 text-xs font-black text-white disabled:opacity-50 dark:bg-cyan-400 dark:text-slate-950"
          >
            {pdfBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Birthdays', value: birthdayCount },
            { label: 'Anniversaries', value: anniversaryCount },
            { label: 'Household', value: householdCount },
            { label: 'No birthday on file', value: missing.people },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-cyan-500/20 dark:bg-cyan-950/30"
            >
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-cyan-200/80">
                {item.label}
              </p>
              <p className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {WINDOWS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={windowId === item.id}
              onClick={() => setWindowId(item.id)}
              className={chipClass(windowId === item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={kind === item.id}
                onClick={() => setKind(item.id)}
                className={chipClass(kind === item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {assignees.length ? (
            <label className="block text-[10px] font-bold text-slate-500 dark:text-cyan-100/80">
              {assigneeLabel}
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="mt-0.5 block min-h-11 min-w-[10rem] rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 dark:border-cyan-500/30 dark:bg-[#0b1e33] dark:text-cyan-50"
              >
                <option value="">All</option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block min-w-0 flex-1 text-[10px] font-bold text-slate-500 dark:text-cyan-100/80">
            Search
            <span className="relative mt-0.5 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name"
                className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-800 dark:border-cyan-500/30 dark:bg-[#0b1e33] dark:text-cyan-50"
              />
            </span>
          </label>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-cyan-100/70" aria-live="polite">
          {visible.length} in {windowLabel.toLowerCase()}
          {missing.household > 0
            ? ` · ${missing.household} household ${
                missing.household === 1 ? 'member has' : 'members have'
              } no birthday on file`
            : ''}
        </p>

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-cyan-100/70">
            No birthdays or anniversaries in {windowLabel.toLowerCase()}.
          </p>
        ) : (
          <>
            <ul className="space-y-2 md:hidden">
              {groups.map((group) => (
                <li key={group.key}>
                  <p className="px-1 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-cyan-200/80">
                    {group.label}
                  </p>
                  <ul className="space-y-2">
                    {group.rows.map((row) => {
                      const href = hrefFor?.(row) || null;
                      const body = (
                        <>
                          <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                            {row.name}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-cyan-100/75">
                            {specialDateKindLabel(row.kind, place)} ·{' '}
                            {yearsCopy(row)}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-cyan-100/75">
                            {specialDateWhen(row)} · {formatSpecialDate(row.on)}
                            {row.coach_id && assigneeNames[row.coach_id]
                              ? ` · ${assigneeNames[row.coach_id]}`
                              : ''}
                          </span>
                        </>
                      );
                      return (
                        <li key={row.id}>
                          {href ? (
                            <Link
                              href={href}
                              className="block min-h-11 rounded-2xl border border-slate-100 px-3 py-2.5 dark:border-white/10"
                            >
                              {body}
                            </Link>
                          ) : (
                            <div className="rounded-2xl border border-slate-100 px-3 py-2.5 dark:border-white/10">
                              {body}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto rounded-2xl border border-slate-100 md:block dark:border-white/10">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-cyan-200/80">
                  <tr>
                    {columns.map((header) => (
                      <th key={header} className="px-3 py-2.5">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <GroupRows
                      key={group.key}
                      group={group}
                      place={place}
                      columns={columns.length}
                      assigneeNames={assigneeNames}
                      showAssignee={assignees.length > 0}
                      hrefFor={hrefFor}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function GroupRows({
  group,
  place,
  columns,
  assigneeNames,
  showAssignee,
  hrefFor,
}: {
  group: { key: string; label: string; rows: MemberSpecialDate[] };
  place: SpecialDatePlace;
  columns: number;
  assigneeNames: Record<string, string>;
  showAssignee: boolean;
  hrefFor?: (row: MemberSpecialDate) => string | null;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={columns}
          className="bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-cyan-950/40 dark:text-cyan-100"
        >
          {group.label}
        </td>
      </tr>
      {group.rows.map((row) => {
        const href = hrefFor?.(row) || null;
        const name = href ? (
          <Link
            href={href}
            className="font-bold text-[#005f8a] underline-offset-2 hover:underline dark:text-cyan-200"
          >
            {row.name}
          </Link>
        ) : (
          <span className="font-semibold">{row.name}</span>
        );
        return (
          <tr
            key={row.id}
            className="border-t border-slate-100 dark:border-white/10"
          >
            <td className="px-3 py-2.5 tabular-nums text-slate-700 dark:text-neutral-100">
              {specialDateWhen(row)}
            </td>
            <td className="px-3 py-2.5">{name}</td>
            <td className="px-3 py-2.5 text-slate-700 dark:text-neutral-100">
              {specialDateKindLabel(row.kind, place)}
            </td>
            <td className="px-3 py-2.5 tabular-nums text-slate-700 dark:text-neutral-100">
              {formatSpecialDate(row.on)}
            </td>
            <td className="px-3 py-2.5 tabular-nums text-slate-700 dark:text-neutral-100">
              {yearsCopy(row)}
            </td>
            {showAssignee ? (
              <td className="px-3 py-2.5 text-slate-700 dark:text-neutral-100">
                {row.coach_id ? assigneeNames[row.coach_id] || '—' : '—'}
              </td>
            ) : null}
          </tr>
        );
      })}
    </>
  );
}
