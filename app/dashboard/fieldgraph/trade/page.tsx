'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Network,
  ShoppingCart,
  Truck,
  Warehouse,
} from 'lucide-react';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

export default function FieldgraphTradePage() {
  const { store, loading, summary } = useFieldgraph();

  return (
    <FieldgraphWorkbench
      title="Trade"
      titleAccent="farm → buyer"
      description="This is where Fieldgraph leaves cane-only software behind: harvest destinations connect to mills, silos, and verified buyers on the SupplierAdvisor network — with OTIFEF, settle, and origin lots."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50/80 to-white p-5 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-800">
              Season snapshot
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {Number(summary?.fieldCount) || 0} fields ·{' '}
              {Number(summary?.estimateTonnes) || 0} t estimated ·{' '}
              {Number(summary?.harvestOpen) || 0} harvest lines open
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                href: '/dashboard/suppliers',
                icon: ShoppingCart,
                title: 'Buy inputs',
                body: 'Seed, fert, chem from your supplier book — same OS as the farm office.',
              },
              {
                href: '/dashboard/customers',
                icon: Network,
                title: 'Sell to mills & buyers',
                body: 'Customer book, quotes, orders and OTIFEF — not a private mill portal only.',
              },
              {
                href: '/dashboard/inventory/lots',
                icon: Warehouse,
                title: 'Origin lots',
                body: 'Carry field origin into inventory lots for full farm-to-buyer trace.',
              },
              {
                href: '/dashboard/distribution',
                icon: Truck,
                title: 'Ship harvest',
                body: 'Outbound logistics, carriers and tracking for cut loads.',
              },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-3xl border border-slate-200 bg-white p-5 hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <c.icon className="w-5 h-5 text-emerald-600 mb-2" />
                <div className="font-black text-slate-900 group-hover:text-emerald-800">
                  {c.title}
                </div>
                <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                  {c.body}
                </p>
                <span className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-emerald-700">
                  Open <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-black text-slate-900 mb-2">
              Harvest destinations on plan
            </h3>
            <ul className="space-y-1.5 text-sm">
              {store.harvest_plan.length === 0 ? (
                <li className="text-slate-500">
                  No harvest lines yet — build them under Harvest plan.
                </li>
              ) : (
                store.harvest_plan.map((h) => {
                  const field = store.fields.find((f) => f.id === h.field_id);
                  return (
                    <li
                      key={h.id}
                      className="flex justify-between gap-2 border-b border-slate-50 py-2"
                    >
                      <span className="font-semibold">
                        {field?.code || h.field_id}
                      </span>
                      <span className="text-slate-600">
                        {h.destination || 'Unassigned destination'}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      )}
    </FieldgraphWorkbench>
  );
}
