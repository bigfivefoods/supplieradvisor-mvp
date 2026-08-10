'use client';

type RecallRow = {
  id: string;
  name: string;
  email?: string;
  last_attended: string | null;
  days_since: number | null;
};

type Props = {
  rows: RecallRow[];
  title?: string;
  description?: string;
  onBook?: (id: string) => void;
};

export function AdvisorRecallPanel({
  rows,
  title = 'Recall list',
  description = 'Patients / members due for a follow-up visit.',
  onBook,
}: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-4 sm:p-5 space-y-3">
      <div>
        <p className="text-sm font-black text-slate-900 dark:text-white">
          {title}
        </p>
        <p className="text-[11px] text-slate-500">{description}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">
          No recalls due right now.
        </p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {rows.slice(0, 40).map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {r.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {r.days_since != null
                    ? `${r.days_since}d since last visit`
                    : 'No attended visit yet'}
                  {r.last_attended ? ` · ${r.last_attended}` : ''}
                  {r.email ? ` · ${r.email}` : ''}
                </p>
              </div>
              {onBook ? (
                <button
                  type="button"
                  onClick={() => onBook(r.id)}
                  className="shrink-0 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2.5 py-1 text-[10px] font-bold"
                >
                  Book
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
