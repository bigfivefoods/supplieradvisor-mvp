'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Network, Search, AlertTriangle } from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

type GraphNode = {
  id: string;
  type: string;
  label: string;
  meta?: Record<string, unknown>;
};
type GraphEdge = { id: string; from: string; to: string; label?: string };

const TYPE_COLOR: Record<string, string> = {
  product: 'bg-sky-100 border-sky-300 text-sky-900',
  lot: 'bg-violet-100 border-violet-300 text-violet-900',
  warehouse: 'bg-emerald-100 border-emerald-300 text-emerald-900',
  movement: 'bg-amber-100 border-amber-300 text-amber-900',
  inspection: 'bg-rose-100 border-rose-300 text-rose-900',
  haccp: 'bg-orange-100 border-orange-300 text-orange-900',
};

export default function TraceabilityGraphPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [lot, setLot] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [holds, setHolds] = useState<{ lot_number: string; status: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(
    async (lotNumber?: string) => {
      if (!companyId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ companyId: String(companyId) });
        if (privyUserId) params.set('privyUserId', privyUserId);
        if (lotNumber) params.set('lot', lotNumber);
        const res = await fetch(`/api/quality/traceability-graph?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load graph');
        setNodes(json.nodes || []);
        setEdges(json.edges || []);
        setSummary(json.summary || null);
        setHolds(json.holds || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    },
    [companyId, privyUserId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selected) || null,
    [nodes, selected]
  );

  const neighbors = useMemo(() => {
    if (!selected) return { in: [] as GraphEdge[], out: [] as GraphEdge[] };
    return {
      in: edges.filter((e) => e.to === selected),
      out: edges.filter((e) => e.from === selected),
    };
  }, [edges, selected]);

  const byType = useMemo(() => {
    const m: Record<string, GraphNode[]> = {};
    for (const n of nodes) {
      if (!m[n.type]) m[n.type] = [];
      m[n.type].push(n);
    }
    return m;
  }, [nodes]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/quality"
        backLabel="Quality"
        eyebrow="Pedigree graph"
        title="Traceability"
        titleAccent="graph"
        description="Live material flow: products → lots → movements → warehouses, with QA and HACCP nodes. Filter by lot for recall precision."
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !pl-10 !py-2.5 !text-sm font-mono"
            placeholder="Filter by lot number…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setLot(q.trim());
                void load(q.trim() || undefined);
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setLot(q.trim());
            void load(q.trim() || undefined);
          }}
          className="btn-primary !py-2.5 !px-4 text-sm"
        >
          <Network className="w-4 h-4" /> Build graph
        </button>
      </div>

      {holds.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {holds.length} lot(s) on QA hold:{' '}
            {holds.map((h) => h.lot_number).join(', ')}
          </span>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} className="bg-white border rounded-2xl px-3 py-2">
              <div className="text-lg font-black">{v}</div>
              <div className="text-[10px] text-neutral-500 capitalize">{k.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="bg-white border rounded-3xl p-12 text-center text-sm text-neutral-500">
          No pedigree nodes yet. Receive stock with lot numbers or clear the filter.
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {(['product', 'lot', 'warehouse', 'movement', 'inspection', 'haccp'] as const).map(
              (type) => {
                const list = byType[type] || [];
                if (!list.length) return null;
                return (
                  <div key={type} className="bg-white border rounded-3xl p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-neutral-400 mb-3">
                      {type}s ({list.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {list.map((n) => {
                        const hold =
                          n.type === 'lot' && n.meta?.on_hold === true;
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => setSelected(n.id)}
                            className={`text-left text-xs px-3 py-2 rounded-xl border font-medium transition ${
                              TYPE_COLOR[n.type] || 'bg-neutral-50 border-neutral-200'
                            } ${selected === n.id ? 'ring-2 ring-[#00b4d8]' : ''} ${
                              hold ? 'ring-1 ring-red-400' : ''
                            }`}
                          >
                            <div className="font-semibold line-clamp-1 max-w-[180px]">
                              {n.label}
                            </div>
                            {hold && (
                              <div className="text-[10px] text-red-700 font-bold mt-0.5">
                                HOLD
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <div className="bg-white border rounded-3xl p-5 h-fit sticky top-24">
            <div className="text-xs font-bold uppercase text-neutral-400 mb-2">Node detail</div>
            {!selectedNode ? (
              <p className="text-sm text-neutral-500">Select a node to see links.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      TYPE_COLOR[selectedNode.type] || ''
                    }`}
                  >
                    {selectedNode.type}
                  </span>
                  <div className="font-bold text-lg mt-2 break-all">{selectedNode.label}</div>
                  <div className="text-[11px] font-mono text-neutral-400">{selectedNode.id}</div>
                </div>
                {selectedNode.meta && (
                  <dl className="text-xs space-y-1">
                    {Object.entries(selectedNode.meta).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <dt className="text-neutral-500">{k}</dt>
                        <dd className="font-medium text-right">{String(v ?? '—')}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div>
                  <div className="text-[11px] font-bold text-neutral-400 mb-1">Inbound</div>
                  {neighbors.in.length === 0 ? (
                    <p className="text-xs text-neutral-400">None</p>
                  ) : (
                    <ul className="text-xs space-y-1">
                      {neighbors.in.map((e) => (
                        <li key={e.id}>
                          <button
                            type="button"
                            className="text-[#0077b6] hover:underline font-mono"
                            onClick={() => setSelected(e.from)}
                          >
                            {e.from}
                          </button>
                          {e.label ? ` · ${e.label}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-bold text-neutral-400 mb-1">Outbound</div>
                  {neighbors.out.length === 0 ? (
                    <p className="text-xs text-neutral-400">None</p>
                  ) : (
                    <ul className="text-xs space-y-1">
                      {neighbors.out.map((e) => (
                        <li key={e.id}>
                          <button
                            type="button"
                            className="text-[#0077b6] hover:underline font-mono"
                            onClick={() => setSelected(e.to)}
                          >
                            {e.to}
                          </button>
                          {e.label ? ` · ${e.label}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {lot && (
              <p className="text-[11px] text-neutral-400 mt-4">Filter: lot “{lot}”</p>
            )}
          </div>
        </div>
      )}
    </RelationshipPage>
  );
}
