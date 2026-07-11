'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { AlertTriangle, Loader2, Search, ShieldAlert } from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

/**
 * Recall readiness: search a lot and surface stock, inspections, HACCP breaches, movements.
 */
export default function RecallSimulatorPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [lot, setLot] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [lots, setLots] = useState<Record<string, unknown>[]>([]);
  const [inspections, setInspections] = useState<Record<string, unknown>[]>([]);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);

  const run = useCallback(async () => {
    if (!companyId || !q.trim()) return;
    setLoading(true);
    setLot(q.trim());
    try {
      const base = `companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId || '')}`;
      const [lotsRes, inspRes, haccpRes] = await Promise.all([
        fetch(`/api/inventory/lots?${base}`),
        fetch(`/api/quality/inspections?${base}`),
        fetch(`/api/quality/haccp?${base}&kind=logs`),
      ]);
      const lj = await lotsRes.json();
      const ij = await inspRes.json();
      const hj = await haccpRes.json();
      const needle = q.trim().toLowerCase();
      setLots(
        (lj.lots || []).filter((r: { lot_number?: string }) =>
          String(r.lot_number || '')
            .toLowerCase()
            .includes(needle)
        )
      );
      setInspections(
        (ij.inspections || []).filter((r: { lot_number?: string }) =>
          String(r.lot_number || '')
            .toLowerCase()
            .includes(needle)
        )
      );
      setLogs(
        (hj.logs || []).filter((r: { lot_number?: string }) =>
          String(r.lot_number || '')
            .toLowerCase()
            .includes(needle)
        )
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, q]);

  useEffect(() => {
    /* no auto */
  }, []);

  const severity = useMemo(() => {
    const failed = inspections.some((i) => i.status === 'failed' || i.status === 'open');
    const breach = logs.some((l) => l.result === 'breach' || l.within_limit === false);
    if (failed || breach) return 'critical';
    if (lots.length) return 'clear';
    return 'unknown';
  }, [inspections, logs, lots]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/quality"
        backLabel="Quality"
        eyebrow="Recall readiness"
        title="Recall"
        titleAccent="simulator"
        description="Search a lot number to pull inventory pedigree, open QA holds, and HACCP breaches — practice before you need it."
      />

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !pl-10 !py-3 !text-sm font-mono"
            placeholder="Lot number…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void run()}
          />
        </div>
        <button type="button" onClick={() => void run()} className="btn-primary !py-3 !px-5 text-sm">
          Simulate
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      ) : lot ? (
        <div className="space-y-4">
          <div
            className={`rounded-3xl border p-5 flex items-start gap-3 ${
              severity === 'critical'
                ? 'border-red-200 bg-red-50'
                : severity === 'clear'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-neutral-200 bg-white'
            }`}
          >
            {severity === 'critical' ? (
              <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            )}
            <div>
              <div className="font-bold text-lg">
                Lot <span className="font-mono">{lot}</span> —{' '}
                {severity === 'critical'
                  ? 'HOLD / investigate'
                  : severity === 'clear'
                    ? 'No open holds found'
                    : 'No matching lot records'}
              </div>
              <p className="text-sm text-neutral-600 mt-1">
                {lots.length} lot row(s) · {inspections.length} inspection(s) · {logs.length} HACCP
                log(s)
              </p>
            </div>
          </div>

          <Section title="Inventory lots" empty={!lots.length}>
            {lots.map((r) => (
              <li key={String(r.id)} className="px-4 py-2 text-sm">
                <span className="font-mono">{String(r.lot_number)}</span>
                {r.product_id != null && ` · product #${r.product_id}`}
                {r.quantity != null && ` · qty ${r.quantity}`}
                {r.status != null && ` · ${r.status}`}
              </li>
            ))}
          </Section>

          <Section title="Quality inspections" empty={!inspections.length}>
            {inspections.map((r) => (
              <li key={String(r.id)} className="px-4 py-2 text-sm">
                #{String(r.id)} · <strong>{String(r.status)}</strong>
                {r.defects_found != null && ` · defects ${r.defects_found}`}
              </li>
            ))}
          </Section>

          <Section title="HACCP monitoring" empty={!logs.length}>
            {logs.map((r) => (
              <li key={String(r.id)} className="px-4 py-2 text-sm">
                {String(r.result || 'ok')} · {String(r.measured_value || '—')}
                {r.operator_name != null && ` · ${r.operator_name}`}
              </li>
            ))}
          </Section>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
            <strong className="text-slate-900">Recommended next steps:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Quarantine matching lots in warehouse / containers</li>
              <li>Fail open inspections if not already failed</li>
              <li>Notify customers with open orders for this SKU/lot</li>
              <li>Document CAPA in HACCP plan corrective actions</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded-3xl p-12 text-center text-sm text-neutral-500">
          Enter a lot number to run a recall drill against live company data.
        </div>
      )}
    </RelationshipPage>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border rounded-3xl overflow-hidden">
      <div className="px-4 py-2.5 border-b font-bold text-sm">{title}</div>
      {empty ? (
        <div className="p-6 text-xs text-neutral-400">None</div>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </div>
  );
}
