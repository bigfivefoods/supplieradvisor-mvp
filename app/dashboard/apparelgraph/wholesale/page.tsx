'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ApparelLoadingBlock,
  ApparelgraphWorkbench,
  useApparelgraph,
} from '@/components/apparel/ApparelgraphWorkbench';
import {
  availableToSell,
  newApparelId,
  wholesaleReport,
} from '@/lib/apparel/apparelgraph';

export default function ApparelgraphWholesalePage() {
  const { store, loading, saving, post } = useApparelgraph();
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [customer, setCustomer] = useState('');
  const [matrixId, setMatrixId] = useState('');
  const [qty, setQty] = useState('');

  const addSheet = async () => {
    if (!number.trim() || !title.trim()) {
      toast.error('Line-sheet number and title are required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        lineSheets: [
          {
            id: newApparelId('ls'),
            number: number.trim(),
            title: title.trim(),
            status: 'issued',
            season_id: store?.seasons[0]?.id || null,
            style_codes: store?.styleBook.map((s) => s.code) || [],
          },
        ],
      },
    });
    setNumber('');
    setTitle('');
    toast.success('Line sheet issued');
  };

  const addPrebook = async () => {
    const row = store?.styles.matrix.find((m) => m.id === matrixId);
    const q = Number(qty);
    if (!row || !customer.trim() || !Number.isFinite(q)) {
      toast.error('Customer, SKU and qty are required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        prebooks: [
          {
            id: newApparelId('pb'),
            customer: customer.trim(),
            style_code: row.style_code,
            colour: row.colour,
            size: row.size,
            qty: q,
            status: 'open',
            line_sheet_id: store.lineSheets[0]?.id || null,
          },
        ],
        styles: {
          matrix: [
            {
              ...row,
              booked_qty: (row.booked_qty || 0) + q,
            },
          ],
        },
      },
    });
    setQty('');
    toast.success('Prebook against available-to-sell');
  };

  const roll = store ? wholesaleReport(store) : null;

  return (
    <ApparelgraphWorkbench
      title="Wholesale"
      description="Line sheets and prebooks against available-to-sell by style / colour / size. Size-curve aware: you see the run, not a pile of unrelated SKUs. Orders still invoice on Customers Trade."
    >
      {loading || !store || !roll ? (
        <ApparelLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-800 bg-cyan-950 text-white p-4 grid sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] uppercase font-black text-cyan-200">ATS</div>
              <div className="text-2xl font-black">{roll.ats}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-black text-cyan-200">Prebooked</div>
              <div className="text-2xl font-black">{roll.booked}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-black text-cyan-200">Planned</div>
              <div className="text-2xl font-black">{roll.planned}</div>
            </div>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 grid sm:grid-cols-3 gap-2">
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="LS-SS26"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Line sheet title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void addSheet()}
              className="btn-primary !py-2 text-sm"
            >
              Issue line sheet
            </button>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 grid sm:grid-cols-4 gap-2">
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Buyer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
            <select
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              value={matrixId}
              onChange={(e) => setMatrixId(e.target.value)}
            >
              <option value="">Style · colour · size</option>
              {store.styles.matrix.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.style_code} · {row.colour} · {row.size} · ATS {availableToSell(row)}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void addPrebook()}
              className="btn-secondary !py-2 text-sm"
            >
              Prebook
            </button>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 text-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Style</th>
                  <th>Colour</th>
                  <th>Size</th>
                  <th>Planned</th>
                  <th>Sewn</th>
                  <th>Booked</th>
                  <th>ATS</th>
                </tr>
              </thead>
              <tbody>
                {roll.rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-1">{row.style_code}</td>
                    <td>{row.colour}</td>
                    <td>{row.size}</td>
                    <td>{row.planned_qty}</td>
                    <td>{row.sew_qty ?? 0}</td>
                    <td>{row.booked}</td>
                    <td>{row.ats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {store.prebooks.map((row) => (
            <div key={row.id} className="text-xs text-slate-600">
              {row.customer} · {row.style_code} · {row.colour} {row.size} · {row.qty} · {row.status}
            </div>
          ))}
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
