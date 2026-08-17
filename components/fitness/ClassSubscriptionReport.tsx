import type { ClassSubscriptionReport as Report } from '@/lib/fitness/vuka-class-catalog';

export function ClassSubscriptionReport({
  report,
  tone = 'owner',
  title = 'Class subscriptions',
}: {
  report: Report | null | undefined;
  tone?: 'owner' | 'coach' | 'member';
  title?: string;
}) {
  if (!report) return null;
  const card =
    tone === 'coach'
      ? 'rounded-2xl border border-slate-700 bg-slate-950/60 p-4'
      : tone === 'member'
        ? 'rounded-2xl border border-yellow-200 bg-white p-4'
        : 'rounded-2xl border border-yellow-200 bg-white p-4 dark:border-yellow-600/40 dark:bg-yellow-950/30';
  const muted =
    tone === 'coach' ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400';
  return (
    <div className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-wider ${muted}`}>
            {title}
          </p>
          <p className="text-sm font-black">
            {report.active_subs} active · R
            {report.mrr_zar.toLocaleString('en-ZA')}/pm
          </p>
        </div>
        {report.joining ? (
          <p className={`text-[11px] ${muted} max-w-sm`}>
            Joining R{report.joining.fee_zar}
            {report.joining.waived ? ' · currently free' : ''}
          </p>
        ) : null}
      </div>
      {report.plans.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className={muted}>
              <tr>
                <th className="py-1 pr-2 font-black uppercase text-[10px]">
                  Plan
                </th>
                <th className="py-1 pr-2 font-black uppercase text-[10px]">
                  When
                </th>
                <th className="py-1 pr-2 font-black uppercase text-[10px]">
                  Rate
                </th>
                <th className="py-1 pr-2 font-black uppercase text-[10px]">
                  Subs
                </th>
                <th className="py-1 font-black uppercase text-[10px]">MRR</th>
              </tr>
            </thead>
            <tbody>
              {report.plans.map((p) => (
                <tr key={p.plan_id} className="border-t border-slate-200/40">
                  <td className="py-1.5 pr-2 font-bold">
                    {p.name}
                    {p.addon ? (
                      <span className="ml-1 text-[10px] uppercase text-amber-600">
                        add-on
                      </span>
                    ) : null}
                  </td>
                  <td className={`py-1.5 pr-2 ${muted}`}>
                    {p.schedule_label || '—'}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums">R{p.price_zar}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{p.subscribers}</td>
                  <td className="py-1.5 tabular-nums">
                    R{p.mrr_zar.toLocaleString('en-ZA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={`text-sm ${muted}`}>No class subscriptions yet.</p>
      )}
      {report.members.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className={muted}>
              <tr>
                <th className="py-1 pr-2 font-black uppercase text-[10px]">
                  Member
                </th>
                <th className="py-1 pr-2 font-black uppercase text-[10px]">
                  Classes
                </th>
                <th className="py-1 pr-2 font-black uppercase text-[10px]">
                  /pm
                </th>
                <th className="py-1 pr-2 font-black uppercase text-[10px]">
                  Booked
                </th>
                <th className="py-1 font-black uppercase text-[10px]">
                  Attended
                </th>
              </tr>
            </thead>
            <tbody>
              {report.members.map((m) => (
                <tr key={m.client_id} className="border-t border-slate-200/40">
                  <td className="py-1.5 pr-2 font-bold">{m.name}</td>
                  <td className={`py-1.5 pr-2 ${muted}`}>
                    {m.plans.join(' · ') || '—'}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums">
                    R{m.monthly_zar.toLocaleString('en-ZA')}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums">{m.booked}</td>
                  <td className="py-1.5 tabular-nums">{m.attended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
