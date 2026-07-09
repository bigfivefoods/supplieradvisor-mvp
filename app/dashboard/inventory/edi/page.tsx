'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileJson, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';

export default function EdiPage() {
  const companyId = getSelectedCompanyId();
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [partner, setPartner] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastEdi, setLastEdi] = useState<Record<string, unknown> | null>(null);
  const [parseRaw, setParseRaw] = useState('');
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const res = await fetch(`/api/inventory/edi?companyId=${companyId}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    if (!companyId) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/inventory/edi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'generate_846',
          tradingPartner: partner || 'TRADING_PARTNER',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setLastEdi(data.edi);
      toast.success('EDI 846 inventory advice generated');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setGenerating(false);
    }
  };

  const parse = async () => {
    if (!companyId || !parseRaw.trim()) return;
    const res = await fetch('/api/inventory/edi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, action: 'parse', raw: parseRaw }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Parse failed');
      return;
    }
    setParsed(data.parsed);
    toast.success(`Parsed as ${data.parsed?.symbology}`);
  };

  const download = () => {
    if (!lastEdi?.edifactPreview) return;
    const blob = new Blob([String(lastEdi.edifactPreview)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INVRPT-${lastEdi.controlNumber || 'export'}.edi`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!companyId) {
    return (
      <div className="text-center py-16">
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">Select company</Link>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Inventory
      </Link>
      <h1 className="text-3xl font-black tracking-[-2px] text-[#00b4d8] mb-2">GS1 &amp; EDI</h1>
      <p className="text-neutral-600 text-sm mb-6 max-w-2xl">
        GTIN validation, GS1 Application Identifier parsing, and outbound X12 846 / EDIFACT INVRPT
        inventory advice for trading partners.
      </p>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border rounded-3xl p-6 space-y-3">
          <h2 className="font-bold flex items-center gap-2">
            <FileJson className="w-5 h-5 text-[#00b4d8]" /> Generate inventory advice (846)
          </h2>
          <input
            className="input w-full !p-3 !text-sm"
            placeholder="Trading partner ID / name"
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
          />
          <button type="button" disabled={generating} onClick={() => void generate()} className="btn-primary w-full !py-3">
            {generating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Generate from live stock'}
          </button>
          {lastEdi && (
            <div className="space-y-2">
              <pre className="text-[10px] bg-slate-900 text-emerald-300 p-4 rounded-2xl overflow-x-auto max-h-48">
                {String(lastEdi.edifactPreview)}
              </pre>
              <button type="button" onClick={download} className="btn-secondary w-full !py-2 text-sm">
                <Download className="w-4 h-4" /> Download EDI file
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border rounded-3xl p-6 space-y-3">
          <h2 className="font-bold">Parse GS1 barcode / AI string</h2>
          <textarea
            className="input w-full !p-3 !text-sm min-h-[100px] font-mono"
            placeholder="(01)09501101530003(17)250101(10)LOT99"
            value={parseRaw}
            onChange={(e) => setParseRaw(e.target.value)}
          />
          <button type="button" onClick={() => void parse()} className="btn-primary w-full !py-3">
            Parse
          </button>
          {parsed && (
            <pre className="text-xs bg-neutral-50 p-4 rounded-2xl overflow-x-auto">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold text-sm">Message history</div>
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" /></div>
        ) : messages.length === 0 ? (
          <div className="p-10 text-center text-neutral-500 text-sm">No EDI messages yet</div>
        ) : (
          <ul className="divide-y">
            {messages.map((m) => (
              <li key={String(m.id)} className="px-5 py-3 text-sm flex justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {String(m.transaction_set)} · {String(m.control_number)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {String(m.trading_partner)} · {String(m.status)} · {String(m.created_at || '').slice(0, 19)}
                  </div>
                </div>
                <span className="text-xs capitalize text-neutral-500">{String(m.direction)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
