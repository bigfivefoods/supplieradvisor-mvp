'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Download, FileJson, Leaf, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pack = any;

export default function EsgReportsPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [pack, setPack] = useState<Pack | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/sustainability/esg-pack?${params}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to build pack');
        return;
      }
      setPack(json.pack);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadJson = () => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esg-pack-${companyId}-${pack.period?.end || 'now'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('ESG pack downloaded');
  };

  const printPack = () => {
    if (!pack) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const bullets = (pack.narrative?.bullets || [])
      .map((b: string) => `<li>${b}</li>`)
      .join('');
    w.document.write(`<!DOCTYPE html><html><head><title>ESG Pack</title>
      <style>body{font-family:system-ui;max-width:720px;margin:40px auto;color:#0f172a;line-height:1.5}
      h1{color:#059669}.muted{color:#64748b;font-size:13px}section{margin:24px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px}</style></head>
      <body>
      <h1>ESG Operating Pack</h1>
      <p class="muted">${pack.company?.name} · ${pack.period?.start} → ${pack.period?.end} · generated ${pack.generated_at}</p>
      <section><h2>Environment</h2>
      <p><strong>${pack.environment?.total_label}</strong> estimated logistics CO₂e (${pack.environment?.shipment_count} shipments)</p>
      <p class="muted">${pack.environment?.disclaimer}</p></section>
      <section><h2>Social</h2>
      <p>Network connections: ${pack.social?.network_connections}</p>
      <p>Suppliers: ${pack.social?.suppliers_total} (${pack.social?.suppliers_verified} verified)</p>
      <p>Avg OTIFEF: ${pack.social?.avg_otifef_pct ?? '—'}%</p>
      <p>QA pass rate: ${pack.social?.quality_inspections?.pass_rate ?? '—'}%</p></section>
      <section><h2>Governance</h2>
      <p>HACCP plans: ${pack.governance?.haccp_plans} (${pack.governance?.haccp_approved} approved)</p>
      <p>On-chain product passports minted: ${pack.governance?.products_onchain_minted}/${pack.governance?.products_total}</p></section>
      <section><h2>Summary</h2><ul>${bullets}</ul></section>
      <p class="muted">SupplierAdvisor® — operational ESG pack, not a formal audit opinion.</p>
      <script>onload=()=>print()</script></body></html>`);
    w.document.close();
  };

  const snapshot = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/sustainability/esg-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Snapshot failed');
        return;
      }
      if (json.warning) toast.message('Pack ready', { description: json.warning });
      else toast.success('Snapshot saved');
      if (json.pack) setPack(json.pack);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sustainability"
        backLabel="Sustainability"
        eyebrow="ESG pack"
        title="Reports"
        titleAccent="live"
        description="90-day operating pack from carbon, suppliers, quality, HACCP, and network — export JSON or print."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="btn-secondary !py-2 !px-3 text-sm">
              Refresh
            </button>
            <button type="button" onClick={downloadJson} disabled={!pack} className="btn-secondary !py-2 !px-3 text-sm">
              <Download className="w-4 h-4" /> JSON
            </button>
            <button type="button" onClick={printPack} disabled={!pack} className="btn-secondary !py-2 !px-3 text-sm">
              <FileJson className="w-4 h-4" /> Print
            </button>
            <button
              type="button"
              onClick={() => void snapshot()}
              disabled={saving || !pack}
              className="btn-primary !py-2 !px-3 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Snapshot
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : !pack ? (
        <div className="p-12 text-center text-sm text-neutral-500">Could not build pack.</div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <Leaf className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-lg">{pack.narrative?.headline}</h2>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Period {pack.period?.start} → {pack.period?.end} · generated{' '}
              {pack.generated_at ? new Date(pack.generated_at).toLocaleString() : ''}
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              {(pack.narrative?.bullets || []).map((b: string, i: number) => (
                <li key={i} className="flex gap-2">
                  <span className="text-emerald-600">•</span> {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white border rounded-3xl p-5">
              <div className="text-[11px] font-bold uppercase text-neutral-400">Environment</div>
              <div className="text-xl font-black mt-1">{pack.environment?.total_label}</div>
              <div className="text-xs text-neutral-500 mt-1">
                {pack.environment?.shipment_count} shipments scored
              </div>
            </div>
            <div className="bg-white border rounded-3xl p-5">
              <div className="text-[11px] font-bold uppercase text-neutral-400">Social</div>
              <div className="text-xl font-black mt-1">
                {pack.social?.quality_inspections?.pass_rate ?? '—'}%
              </div>
              <div className="text-xs text-neutral-500 mt-1">QA pass rate · OTIFEF{' '}
                {pack.social?.avg_otifef_pct ?? '—'}%</div>
            </div>
            <div className="bg-white border rounded-3xl p-5">
              <div className="text-[11px] font-bold uppercase text-neutral-400">Governance</div>
              <div className="text-xl font-black mt-1">{pack.governance?.haccp_plans ?? 0}</div>
              <div className="text-xs text-neutral-500 mt-1">
                HACCP plans · {pack.governance?.products_onchain_minted ?? 0} passports minted
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-500 px-1">
            {pack.environment?.disclaimer}
          </p>
        </div>
      )}
    </RelationshipPage>
  );
}
