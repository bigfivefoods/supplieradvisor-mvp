'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ApparelLoadingBlock,
  ApparelgraphWorkbench,
  useApparelgraph,
} from '@/components/apparel/ApparelgraphWorkbench';
import {
  bomLanded,
  newApparelId,
  styleBomCost,
} from '@/lib/apparel/apparelgraph';

function zar(n: number) {
  return `R ${Number(n || 0).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;
}

export default function ApparelgraphCostingPage() {
  const { store, loading, saving, post } = useApparelgraph();
  const [styleCode, setStyleCode] = useState('');
  const [item, setItem] = useState('');
  const [uom, setUom] = useState('m');
  const [consumption, setConsumption] = useState('');
  const [waste, setWaste] = useState('3');
  const [unitCost, setUnitCost] = useState('');
  const [duty, setDuty] = useState('22');

  const add = async () => {
    const sc = styleCode.trim();
    const nextItem = item.trim();
    if (!sc || !nextItem) {
      toast.error('Style and material are required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        styles: {
          bom: [
            {
              id: newApparelId('bom'),
              style_code: sc,
              item: nextItem,
              uom: uom.trim() || 'm',
              consumption: Number(consumption) || 0,
              wastage_pct: Number(waste) || 0,
              unit_cost: Number(unitCost) || 0,
              duty_pct: Number(duty) || 0,
            },
          ],
        },
      },
    });
    setItem('');
    setConsumption('');
    setUnitCost('');
    toast.success('BOM line landed');
  };

  return (
    <ApparelgraphWorkbench
      title="Costing"
      description="Bill of materials with wastage and landed duty — style cost on the same record as the tech pack. Invoices stay on Customers Trade."
    >
      {loading || !store ? (
        <ApparelLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 grid sm:grid-cols-4 gap-2">
            <select
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              value={styleCode}
              onChange={(e) => setStyleCode(e.target.value)}
            >
              <option value="">Style</option>
              {store.styleBook.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.code}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Material / trim"
              value={item}
              onChange={(e) => setItem(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Consumption"
              value={consumption}
              onChange={(e) => setConsumption(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="UOM"
              value={uom}
              onChange={(e) => setUom(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Waste %"
              value={waste}
              onChange={(e) => setWaste(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Unit cost"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Duty %"
              value={duty}
              onChange={(e) => setDuty(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm"
            >
              Add BOM line
            </button>
          </div>
          {store.styleBook.map((style) => {
            const lines = store.styles.bom.filter((b) => b.style_code === style.code);
            const total = styleBomCost(store, style.code);
            return (
              <div
                key={style.id}
                className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm"
              >
                <div className="font-black">
                  {style.code} · {style.name} · landed {zar(total)}
                </div>
                {lines.map((row) => (
                  <div key={row.id} className="text-xs border-t mt-2 pt-2">
                    {row.item} · {row.consumption} {row.uom} @ {zar(row.unit_cost || 0)} · waste{' '}
                    {row.wastage_pct || 0}% · duty {row.duty_pct || 0}% = {zar(bomLanded(row))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
