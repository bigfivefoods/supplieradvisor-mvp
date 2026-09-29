'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ApparelLoadingBlock,
  ApparelgraphWorkbench,
  useApparelgraph,
} from '@/components/apparel/ApparelgraphWorkbench';
import { newApparelId } from '@/lib/apparel/apparelgraph';

export default function ApparelgraphStylesPage() {
  const { store, loading, saving, post } = useApparelgraph();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [curve, setCurve] = useState('S-M-L-XL');
  const [styleCode, setStyleCode] = useState('');
  const [colour, setColour] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState('');

  const addStyle = async () => {
    const nextCode = code.trim();
    const nextName = name.trim();
    if (!nextCode || !nextName) {
      toast.error('Style code and name are required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        styleBook: [
          {
            id: newApparelId('sty'),
            code: nextCode,
            name: nextName,
            season_id: seasonId || null,
            size_curve: curve.trim() || 'S-M-L-XL',
            status: 'concept',
            colorways: [],
          },
        ],
      },
    });
    setCode('');
    setName('');
    toast.success('Style master saved');
  };

  const addMatrix = async () => {
    const sc = styleCode.trim();
    if (!sc || !colour.trim() || !size.trim()) {
      toast.error('Style, colour and size are required');
      return;
    }
    await post({
      action: 'merge',
      store: {
        styles: {
          matrix: [
            {
              id: newApparelId('smx'),
              style_code: sc,
              colour: colour.trim(),
              size: size.trim(),
              planned_qty: Number(qty) || 0,
            },
          ],
        },
      },
    });
    setColour('');
    setSize('');
    setQty('');
    toast.success('Size/colour row saved');
  };

  return (
    <ApparelgraphWorkbench
      title="Styles"
      description="Style master with colourways and size curve — inventory that thinks in style / colour / size, not a pile of unrelated SKUs."
    >
      {loading || !store ? (
        <ApparelLoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 grid sm:grid-cols-5 gap-2">
            <select
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
            >
              <option value="">Season</option>
              {store.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Style code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Size curve"
              value={curve}
              onChange={(e) => setCurve(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void addStyle()}
              className="btn-primary !py-2 text-sm"
            >
              Add style
            </button>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 grid sm:grid-cols-5 gap-2">
            <select
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              value={styleCode}
              onChange={(e) => setStyleCode(e.target.value)}
            >
              <option value="">Matrix onto style</option>
              {store.styleBook.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Colour"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Size"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
            <input
              className="rounded-lg border border-cyan-200 px-3 py-2 text-sm"
              placeholder="Planned qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void addMatrix()}
              className="btn-secondary !py-2 text-sm"
            >
              Add colour/size
            </button>
          </div>
          <div className="grid lg:grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl border border-cyan-200 bg-white p-4">
              <h3 className="font-black mb-2">Style master ({store.styleBook.length})</h3>
              {store.styleBook.map((row) => (
                <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                  {row.code} · {row.name} · {row.size_curve || '—'} · {row.status}
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-white p-4">
              <h3 className="font-black mb-2">Matrix ({store.styles.matrix.length})</h3>
              {store.styles.matrix.map((row) => (
                <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                  {row.style_code} · {row.colour} · {row.size} · planned {row.planned_qty} · sew{' '}
                  {row.sew_qty ?? 0}
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-white p-4">
              <h3 className="font-black mb-2">Tech pack ({store.styles.techPack.length})</h3>
              {store.styles.techPack.map((row) => (
                <div key={row.id} className="text-xs py-1 border-t first:border-t-0">
                  {row.style_code} · {row.version} · {row.approved_at?.slice(0, 10) || 'pending'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
