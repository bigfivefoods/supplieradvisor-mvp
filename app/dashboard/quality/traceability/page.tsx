'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Loader2, Package, Search, ShieldCheck } from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

type LotRow = {
  id: number;
  lot_number?: string | null;
  product_id?: number | null;
  quantity?: number | null;
  status?: string | null;
  expiry_date?: string | null;
  warehouse_id?: number | null;
  created_at?: string;
  product_name?: string | null;
};

export default function TraceabilityPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [q, setQ] = useState('');
  const [holdLots, setHoldLots] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [lotsRes, inspRes] = await Promise.all([
        fetch(
          `/api/inventory/lots?companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId || '')}`
        ),
        fetch(
          `/api/quality/inspections?companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId || '')}&status=open`
        ),
      ]);
      const lotsJson = await lotsRes.json();
      const inspJson = await inspRes.json();
      const list: LotRow[] = lotsJson.lots || lotsJson.data || [];
      setLots(list);
      const holds = new Set<string>();
      for (const i of inspJson.inspections || []) {
        if (i.lot_number && (i.status === 'open' || i.status === 'failed')) {
          holds.add(String(i.lot_number).toLowerCase());
        }
      }
      // also failed
      if (inspJson.inspections) {
        /* open filter already */
      }
      setHoldLots(holds);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = lots.filter((l) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      String(l.lot_number || '')
        .toLowerCase()
        .includes(s) ||
      String(l.product_name || '')
        .toLowerCase()
        .includes(s) ||
      String(l.id).includes(s)
    );
  });

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/quality"
        backLabel="Quality"
        eyebrow="Lot pedigree"
        title="Traceability"
        titleAccent="Lots"
        description="Live inventory lots with quality hold flags. Search by lot number for recall readiness."
        action={
          <Link
            href="/dashboard/quality/inspections"
            className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" /> Inspections
          </Link>
        }
      />

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          className="input w-full !pl-10 !py-3 !text-sm"
          placeholder="Search lot number or product…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-sm text-neutral-500">
            No lots found. Receive inventory with lot numbers to enable pedigree.
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((lot) => {
              const lotKey = String(lot.lot_number || '').toLowerCase();
              const onHold = lotKey && holdLots.has(lotKey);
              return (
                <li
                  key={lot.id}
                  className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-sky-50 text-sky-700">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold font-mono text-sm">
                        {lot.lot_number || `Lot #${lot.id}`}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {lot.product_name || `Product ${lot.product_id || '—'}`}
                        {lot.quantity != null ? ` · qty ${lot.quantity}` : ''}
                        {lot.expiry_date ? ` · exp ${lot.expiry_date}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onHold ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        QA hold
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Clear
                      </span>
                    )}
                    {lot.status && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                        {lot.status}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </RelationshipPage>
  );
}
