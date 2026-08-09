'use client';

import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

export default function FieldgraphReportPage() {
  const { store, loading, summary } = useFieldgraph();

  return (
    <FieldgraphWorkbench
      title="Insights"
      titleAccent="scorecard"
      description="Season view across yield estimates, harvest, nutrients, fleet, labour and regen — one place for farm and buyer conversations."
    >
      {loading || !store || !summary ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { l: 'Fields', v: summary.fieldCount },
              { l: 'Hectares', v: summary.hectares },
              { l: 'Est. tonnes', v: summary.estimateTonnes },
              { l: 'Crops', v: summary.cropCount },
              { l: 'Harvest open', v: summary.harvestOpen },
              { l: 'Applications', v: summary.applications },
              { l: 'Fleet logs', v: summary.fleetLogs },
              { l: 'Labour logs', v: summary.labourLogs },
            ].map((c) => (
              <div
                key={String(c.l)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {c.l}
                </div>
                <div className="text-2xl font-black tabular-nums text-slate-900">
                  {String(c.v ?? '—')}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-black mb-3">Crops in book</h3>
            <div className="flex flex-wrap gap-2">
              {(summary.crops as string[] | undefined)?.length ? (
                (summary.crops as string[]).map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900"
                  >
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No crops yet</span>
              )}
            </div>
            {summary.avgSoilOrganicCarbon != null ? (
              <p className="mt-4 text-sm text-slate-600">
                Average soil organic carbon:{' '}
                <strong>{String(summary.avgSoilOrganicCarbon)}%</strong> across{' '}
                {String(summary.regenSamples)} sample
                {Number(summary.regenSamples) === 1 ? '' : 's'}.
              </p>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Add regen samples to surface soil carbon on this scorecard.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Field</th>
                  <th className="px-3 py-2.5">Crop</th>
                  <th className="px-3 py-2.5">Ha</th>
                  <th className="px-3 py-2.5">Est. t</th>
                  <th className="px-3 py-2.5">Apps</th>
                </tr>
              </thead>
              <tbody>
                {store.fields.map((f) => {
                  const est = store.estimates
                    .filter((e) => e.field_id === f.id)
                    .reduce((n, e) => n + (Number(e.tonnes) || 0), 0);
                  const apps = store.applications.filter(
                    (a) => a.field_id === f.id
                  ).length;
                  return (
                    <tr key={f.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-semibold">
                        {f.code} · {f.name}
                      </td>
                      <td className="px-3 py-2.5">{f.crop}</td>
                      <td className="px-3 py-2.5 tabular-nums">{f.hectares}</td>
                      <td className="px-3 py-2.5 tabular-nums">{est || '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums">{apps}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FieldgraphWorkbench>
  );
}
