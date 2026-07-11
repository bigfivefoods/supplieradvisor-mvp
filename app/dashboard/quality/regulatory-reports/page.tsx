'use client';

import { useCallback, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Download, FileCheck, Loader2, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pack = any;

export default function RegulatoryReportsPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<Pack | null>(null);
  const [days, setDays] = useState(90);

  const load = useCallback(async () => {
    if (!companyId) {
      toast.error('Select a company');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        days: String(days),
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/quality/regulatory-pack?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setPack(json.pack);
      toast.success('Regulatory pack ready');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, days]);

  const download = () => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality-regulatory-pack-${companyId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPack = () => {
    if (!pack) return;
    const s = pack.summary || {};
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Quality Regulatory Pack</title>
      <style>body{font-family:system-ui;max-width:720px;margin:40px auto;color:#0f172a;line-height:1.5}
      h1{color:#0ea5e9}.muted{color:#64748b;font-size:13px}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      td,th{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}
      .warn{color:#b45309}</style></head><body>
      <h1>Quality & food-safety pack</h1>
      <p class="muted">${pack.company?.trading_name || 'Company'} · last ${pack.period_days} days · ${pack.generated_at}</p>
      <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Inspections</td><td>${s.inspections_total ?? 0} (pass rate ${s.pass_rate ?? '—'}%)</td></tr>
        <tr><td>Failed / open</td><td>${s.inspections_failed ?? 0} / ${s.inspections_open ?? 0}</td></tr>
        <tr><td>HACCP plans / approved</td><td>${s.haccp_plans ?? 0} / ${s.haccp_plans_approved ?? 0}</td></tr>
        <tr><td>HACCP breaches</td><td class="warn">${s.haccp_breaches ?? 0}</td></tr>
        <tr><td>Lots on QA hold</td><td class="warn">${s.lots_on_hold ?? 0}</td></tr>
      </table>
      <p class="muted">${pack.disclaimer || ''}</p>
      <script>onload=()=>print()</script></body></html>`);
    w.document.close();
  };

  const s = pack?.summary;

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/quality"
        backLabel="Quality"
        eyebrow="Compliance export"
        title="Regulatory"
        titleAccent="reports"
        description="Auditor-ready operating pack from live inspections, HACCP, and lot holds — JSON + print."
        action={
          <div className="flex flex-wrap gap-2">
            <select
              className="input !py-2 !text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[30, 90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void load()} className="btn-primary !py-2 !px-4 text-sm">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Generate
            </button>
            <button
              type="button"
              disabled={!pack}
              onClick={download}
              className="btn-secondary !py-2 !px-3 text-sm"
            >
              <Download className="w-4 h-4" /> JSON
            </button>
            <button
              type="button"
              disabled={!pack}
              onClick={printPack}
              className="btn-secondary !py-2 !px-3 text-sm"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        }
      />

      {!pack && !loading && (
        <div className="bg-white border rounded-3xl p-12 text-center">
          <FileCheck className="w-10 h-10 text-[#00b4d8] mx-auto mb-3" />
          <p className="text-sm text-neutral-600">
            Generate a pack to export inspection pass rates, HACCP status, and open holds for the
            selected period.
          </p>
        </div>
      )}

      {pack && s && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Inspections', v: s.inspections_total },
              { label: 'Pass rate', v: s.pass_rate != null ? `${s.pass_rate}%` : '—' },
              { label: 'HACCP breaches', v: s.haccp_breaches },
              { label: 'Lots on hold', v: s.lots_on_hold },
            ].map((k) => (
              <div key={k.label} className="bg-white border rounded-3xl p-5">
                <div className="text-2xl font-black tracking-tight">{k.v}</div>
                <div className="text-[11px] text-neutral-500">{k.label}</div>
              </div>
            ))}
          </div>
          <div className="bg-white border rounded-3xl p-5 text-sm text-neutral-600">
            <p>
              <strong className="text-slate-900">{pack.company?.trading_name}</strong>
              {pack.company?.country ? ` · ${pack.company.country}` : ''}
            </p>
            <p className="text-xs text-neutral-400 mt-2">
              Generated {pack.generated_at} · period {pack.period_days} days
            </p>
            <p className="text-xs text-amber-800 mt-3">{pack.disclaimer}</p>
          </div>
          {Array.isArray(pack.holds) && pack.holds.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4">
              <div className="font-bold text-sm text-amber-900 mb-2">Open holds</div>
              <ul className="text-sm space-y-1">
                {pack.holds.map((h: { lot_number: string; status: string; inspection_id: number }) => (
                  <li key={`${h.lot_number}-${h.inspection_id}`}>
                    Lot <span className="font-mono">{h.lot_number}</span> · {h.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </RelationshipPage>
  );
}
