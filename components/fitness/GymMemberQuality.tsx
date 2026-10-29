'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MemberQualityIssue } from '@/lib/fitness/member-directory';

export function GymMemberQuality({ companyId }: { companyId: number }) {
  const [open, setOpen] = useState(false);
  const [issues, setIssues] = useState<MemberQualityIssue[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setLoading(true);
    const params = new URLSearchParams({
      companyId: String(companyId),
      directory: 'quality',
      page: String(page),
    });
    fetch(`/api/fitness/fitgraph?${params}`, { credentials: 'same-origin' })
      .then(async (res) => {
        const data = (await res.json()) as {
          directory?: {
            issues: MemberQualityIssue[];
            total: number;
            pages: number;
          };
        };
        if (cancel || !res.ok || !data.directory) return;
        setIssues(data.directory.issues);
        setTotal(data.directory.total);
        setPages(data.directory.pages);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [open, companyId, page]);

  return (
    <section className="overflow-hidden rounded-3xl border border-[#00b4d8]/40 bg-white">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          className={`h-4 w-4 text-[#0077b6] transition-transform ${open ? '' : '-rotate-90'}`}
        />
        <span className="text-sm font-black text-slate-900">
          Data quality
        </span>
        <span className="text-xs text-slate-500">
          Private-client flags, phones, missing details and possible duplicates.
          Collapsed until you open it.
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-sky-100 px-4 py-3">
          <p className="text-xs text-slate-600">
            {total == null ? 'Loading…' : `${total} issue${total === 1 ? '' : 's'} on this company’s book.`}
          </p>
          {loading && !issues.length ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : issues.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing to review on this page.</p>
          ) : (
            <ul className="space-y-1">
              {issues.map((issue, i) => (
                <li
                  key={`${issue.id}-${issue.kind}-${i}`}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="font-bold">{issue.name}</span>
                  <span className="text-slate-500"> · {issue.detail}</span>
                </li>
              ))}
            </ul>
          )}
          {pages > 1 ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((n) => Math.max(1, n - 1))}
              >
                Previous
              </button>
              <span className="text-xs">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"
                disabled={page >= pages}
                onClick={() => setPage((n) => n + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
