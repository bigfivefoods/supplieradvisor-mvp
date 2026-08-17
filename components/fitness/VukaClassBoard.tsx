import type { SubscribeClass } from '@/lib/fitness/vuka-class-catalog';

export function VukaClassBoard({
  classes,
  joining,
  tone = 'owner',
}: {
  classes: SubscribeClass[];
  joining?: { fee_zar: number; waived?: boolean; note?: string } | null;
  tone?: 'owner' | 'member';
}) {
  const card =
    tone === 'member'
      ? 'rounded-2xl border border-yellow-200 bg-white p-4'
      : 'rounded-2xl border border-yellow-200 bg-white p-4 dark:border-yellow-700 dark:bg-yellow-950/30';
  const muted = 'text-slate-500 dark:text-slate-400';
  if (!classes.length) return null;
  const mrr = classes.reduce((n, c) => n + c.price_zar * c.subscribers, 0);
  return (
    <div className={`${card} space-y-3`}>
      <div>
        <p className={`text-[10px] font-black uppercase tracking-wider ${muted}`}>
          Classes members subscribe to
        </p>
        <p className="text-sm font-black">
          {classes.length} classes · fees add up from the ones they pick
        </p>
        {joining ? (
          <p className={`mt-1 text-[11px] ${muted}`}>
            {joining.note ||
              `Joining R${joining.fee_zar}${joining.waived ? ' · currently free' : ''}`}
          </p>
        ) : null}
        {tone === 'owner' ? (
          <p className={`mt-1 text-[11px] ${muted}`}>
            {classes.reduce((n, c) => n + c.subscribers, 0)} subscriptions · R
            {mrr.toLocaleString('en-ZA')}/pm
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead className={muted}>
            <tr>
              <th className="py-1 pr-2 font-black uppercase text-[10px]">
                Class
              </th>
              <th className="py-1 pr-2 font-black uppercase text-[10px]">
                When
              </th>
              <th className="py-1 pr-2 font-black uppercase text-[10px]">
                /pm
              </th>
              {tone === 'owner' ? (
                <th className="py-1 font-black uppercase text-[10px]">Subs</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.plan_id} className="border-t border-slate-200/50">
                <td className="py-1.5 pr-2 font-bold">
                  {c.class_name}
                  {c.addon ? (
                    <span className="ml-1 text-[10px] uppercase text-amber-700">
                      add-on
                    </span>
                  ) : null}
                  {c.audience && c.audience !== 'all' ? (
                    <span className="ml-1 text-[10px] uppercase text-slate-400">
                      {c.audience}
                    </span>
                  ) : null}
                </td>
                <td className={`py-1.5 pr-2 ${muted}`}>
                  {c.schedule_label || '—'}
                  {c.location ? (
                    <span className="block text-[10px]">{c.location}</span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-2 tabular-nums font-black">
                  R{c.price_zar}
                </td>
                {tone === 'owner' ? (
                  <td className="py-1.5 tabular-nums">{c.subscribers}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
