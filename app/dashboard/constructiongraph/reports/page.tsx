'use client';

import {
  ConstructionEmptyHint,
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';
import {
  clientReport,
  programmeReport,
} from '@/lib/construction/constructiongraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA')}`;
}

export default function ConstructiongraphReportsPage() {
  const { store, loading } = useConstructiongraph();
  const roll = store ? programmeReport(store) : null;

  return (
    <ConstructiongraphWorkbench
      title="Reports"
      description="Detailed report per project — budget vs costs, planned claims vs paid — then roll every project into the contractor programme."
    >
      {loading || !store || !roll ? (
        <ConstructionLoadingBlock />
      ) : store.sites.length === 0 ? (
        <ConstructionEmptyHint>
          Seed a demo or add a project to see reports.
        </ConstructionEmptyHint>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-800 bg-stone-900 text-white p-4 grid sm:grid-cols-4 gap-3">
            {[
              ['Programme budget', zar(roll.budget)],
              ['Posted costs', zar(roll.costs)],
              ['Claimed / paid', `${zar(roll.claimedBillings)} / ${zar(roll.paidBillings)}`],
              [
                'Plan / actual',
                `${Math.round(roll.plannedPct)}% / ${Math.round(roll.actualPct)}%`,
              ],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <div className="text-[10px] uppercase font-black text-amber-200">
                  {label}
                </div>
                <div className="text-xl font-black">{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-stone-300 bg-white p-4 text-sm overflow-x-auto">
            <div className="font-black mb-2">Programme roll-up</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-stone-500">
                  <th className="py-1">Project</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Budget</th>
                  <th>Costs</th>
                  <th>Planned claims</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Plan/actual</th>
                </tr>
              </thead>
              <tbody>
                {roll.projects.map((p) => (
                  <tr key={p.siteId} className="border-t">
                    <td className="py-1">
                      {p.code} · {p.name}
                    </td>
                    <td>{p.clientName}</td>
                    <td>{p.status}</td>
                    <td>{zar(p.budget)}</td>
                    <td>{zar(p.costs)}</td>
                    <td>{zar(p.plannedBillings)}</td>
                    <td>{zar(p.paidBillings)}</td>
                    <td>{zar(p.outstandingBillings)}</td>
                    <td>
                      {Math.round(p.plannedPct)}% / {Math.round(p.actualPct)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {store.clients.map((c) => {
            const report = clientReport(store, c.id);
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-stone-300 bg-white p-4 text-sm"
              >
                <div className="font-black">{c.name}</div>
                <div className="text-xs text-stone-500">
                  {report.projectCount} project{report.projectCount === 1 ? '' : 's'} ·
                  budget {zar(report.budget)} · costs {zar(report.costs)} · paid{' '}
                  {zar(report.paidBillings)} · outstanding {zar(report.outstandingBillings)}
                </div>
                {report.projects.map((p) => (
                  <div key={p.siteId} className="mt-3 border-t pt-3">
                    <div className="font-bold">
                      {p.code} · {p.name} · {p.status}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      Budget {zar(p.budget)} · BOQ {zar(p.boqPlanned)} / actual{' '}
                      {zar(p.boqActual)} · costs {zar(p.costs)} · claims planned{' '}
                      {zar(p.plannedBillings)} · paid {zar(p.paidBillings)} · due{' '}
                      {zar(p.outstandingBillings)}
                      {p.overduePayments ? ` · ${p.overduePayments} overdue` : ''} ·
                      plan {Math.round(p.plannedPct)}% / actual {Math.round(p.actualPct)}%
                      · snags {p.openSnags}
                    </div>
                    {p.boqLines.length ? (
                      <table className="w-full text-xs mt-2">
                        <thead>
                          <tr className="text-left text-stone-500">
                            <th className="py-1">Item</th>
                            <th>Description</th>
                            <th>Planned</th>
                            <th>Actual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.boqLines.map((row) => (
                            <tr key={row.id} className="border-t">
                              <td className="py-1">{row.item_no}</td>
                              <td>{row.description}</td>
                              <td>{zar(row.planned)}</td>
                              <td>{zar(row.actual)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-xs text-stone-500 mt-1">No BOQ on this project.</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
