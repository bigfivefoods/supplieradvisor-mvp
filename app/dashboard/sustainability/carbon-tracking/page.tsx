'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Leaf, Loader2, Truck, Info } from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

type ShipRow = {
  id: number;
  shipment_number?: string;
  mode: string;
  kgCo2e: number;
  distanceKm: number;
  weightTonnes: number;
  label: string;
  method: string;
  status?: string;
};

export default function CarbonTrackingPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [totalLabel, setTotalLabel] = useState('—');
  const [count, setCount] = useState(0);
  const [byMode, setByMode] = useState<Record<string, number>>({});
  const [ships, setShips] = useState<ShipRow[]>([]);
  const [note, setNote] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/sustainability/carbon?${params}`);
      const json = await res.json();
      if (res.ok) {
        setTotalLabel(json.total_label || `${json.total_kg_co2e || 0} kg`);
        setCount(json.shipment_count || 0);
        setByMode(json.by_mode || {});
        setShips(json.shipments || []);
        setNote(json.note || '');
        setWarning(json.warning || null);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sustainability"
        backLabel="Sustainability"
        eyebrow="Ops carbon lite"
        title="Carbon"
        titleAccent="tracking"
        description="Estimated CO₂e from distribution shipments using transparent mode factors. For awareness and reduction planning — not a certified GHG inventory."
      />

      <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          {note ||
            'Formula: factor (kg/t·km) × weight (t) × distance (km). Distance from shipment data or haversine/default.'}
        </span>
      </div>

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-white border rounded-2xl p-5">
              <Leaf className="w-5 h-5 text-emerald-600 mb-2" />
              <div className="text-2xl font-black tracking-tight">{totalLabel}</div>
              <div className="text-[11px] text-neutral-500">Estimated total</div>
            </div>
            <div className="bg-white border rounded-2xl p-5">
              <Truck className="w-5 h-5 text-[#00b4d8] mb-2" />
              <div className="text-2xl font-black tracking-tight">{count}</div>
              <div className="text-[11px] text-neutral-500">Shipments scored</div>
            </div>
            <div className="bg-white border rounded-2xl p-5 col-span-2 sm:col-span-1">
              <div className="text-[11px] font-bold uppercase text-neutral-400 mb-2">By mode</div>
              <div className="space-y-1">
                {Object.keys(byMode).length === 0 ? (
                  <span className="text-sm text-neutral-500">No data yet</span>
                ) : (
                  Object.entries(byMode).map(([m, kg]) => (
                    <div key={m} className="flex justify-between text-sm">
                      <span className="capitalize text-neutral-600">{m}</span>
                      <span className="font-semibold">{kg.toFixed(1)} kg</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-3xl overflow-hidden">
            {ships.length === 0 ? (
              <div className="p-12 text-center text-sm text-neutral-500">
                No shipments yet. Create distribution shipments to estimate carbon.
              </div>
            ) : (
              <ul className="divide-y">
                {ships.slice(0, 40).map((s) => (
                  <li
                    key={s.id}
                    className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-sm">
                        {s.shipment_number || `Shipment #${s.id}`}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {s.mode} · {s.distanceKm} km · {s.weightTonnes} t · {s.method}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-emerald-700">{s.label}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </RelationshipPage>
  );
}
