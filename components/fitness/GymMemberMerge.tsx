'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

type MergeRow = {
  keeper_id: string;
  keeper_name: string;
  donor_ids: string[];
  donor_names: string[];
};

type ReviewRow = {
  client_ids: string[];
  names: string[];
  reason: string;
};

type PostFn = (body: Record<string, unknown>) => Promise<Record<string, unknown>>;

export function GymMemberMerge({
  companyId,
  post,
}: {
  companyId: number;
  post: PostFn;
}) {
  const [open, setOpen] = useState(false);
  const [merges, setMerges] = useState<MergeRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams({
      companyId: String(companyId),
      directory: 'duplicates',
    });
    return fetch(`/api/fitness/fitgraph?${params}`, { credentials: 'same-origin' })
      .then(async (res) => {
        const data = (await res.json()) as {
          directory?: { merges: MergeRow[]; manual_reviews: ReviewRow[] };
        };
        if (!res.ok || !data.directory) return;
        setMerges(data.directory.merges);
        setReviews(data.directory.manual_reviews);
      });
  };

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId]);

  const merge = async (row: MergeRow) => {
    if (
      !confirm(
        `Keep ${row.keeper_name} and move classes, coaches, bookings and history from ${row.donor_names.join(', ')}?`
      )
    ) {
      return;
    }
    setBusy(row.keeper_id);
    try {
      await post({
        action: 'merge_members',
        keeper_id: row.keeper_id,
        donor_ids: row.donor_ids,
        reasons: ['Desk merge'],
      });
      toast.success(`Kept ${row.keeper_name}`);
      await load();
    } catch {
      /* toast in post */
    } finally {
      setBusy(null);
    }
  };

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
        <span className="text-sm font-black text-slate-900">Merge duplicates</span>
        <span className="text-xs text-slate-500">
          Owner only. Moves classes, coaches, bookings and history onto the kept record.
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-sky-100 px-4 py-3">
          {reviews.length ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Manual review — not merged automatically
              </p>
              <ul className="mt-1 space-y-1">
                {reviews.map((row) => (
                  <li
                    key={row.client_ids.join('|')}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                  >
                    <span className="font-bold">{row.names.join(' / ')}</span>
                    <span className="text-slate-600"> — {row.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {merges.length === 0 ? (
            <p className="text-sm text-slate-500">No automatic duplicate groups.</p>
          ) : (
            <ul className="space-y-2">
              {merges.map((row) => (
                <li
                  key={row.keeper_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2"
                >
                  <p className="text-sm">
                    <span className="font-bold">Keep {row.keeper_name}</span>
                    <span className="text-slate-500">
                      {' '}
                      · merge {row.donor_names.join(', ')}
                    </span>
                  </p>
                  <button
                    type="button"
                    className="rounded-xl bg-[#00b4d8] px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
                    disabled={busy === row.keeper_id}
                    onClick={() => void merge(row)}
                  >
                    {busy === row.keeper_id ? 'Merging…' : 'Merge into kept record'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
