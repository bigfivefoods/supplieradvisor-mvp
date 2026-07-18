'use client';

/**
 * Open-to-trade ranked discovery + request-to-trade modal.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, ShieldCheck, Send } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';

type Ranked = {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
  industry: string | null;
  city: string | null;
  verification_status: string | null;
  trust_score: number | null;
  otifef_average: number | null;
  rankScore: number;
  reasons: string[];
};

export default function OpenToTradeDiscoverPage() {
  const companyId = getSelectedCompanyId();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [rows, setRows] = useState<Ranked[]>([]);
  const [loading, setLoading] = useState(true);
  const [peerId, setPeerId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/business/request-trade?companyId=${companyId}&limit=40`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRows(data.companies || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestTrade = async () => {
    if (!companyId || !peerId || !note.trim()) {
      toast.message('Write a short personal note');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/business/request-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          peerId,
          message: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || 'Request sent');
      setPeerId(null);
      setNote('');
      if (data.alreadyConnected && data.firstTradeHref) {
        window.location.href = data.firstTradeHref;
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) {
    return (
      <RelationshipPage>
        <p className="text-center py-16 text-sm text-neutral-500">
          Select a company first.
        </p>
      </RelationshipPage>
    );
  }

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Open to trade"
        description="Ranked discoverable companies (CIPC, trust, OTIFEF). Request to trade with a personal note — when they accept, start first trade."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const name = r.trading_name || r.legal_name || `#${r.id}`;
            const verified =
              String(r.verification_status || '').toLowerCase() === 'verified';
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    {name}
                    {verified ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    ) : null}
                    <span className="text-[10px] font-bold text-sky-700 bg-sky-50 rounded-full px-2 py-0.5">
                      rank {r.rankScore}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {[r.industry, r.city].filter(Boolean).join(' · ')}
                    {r.trust_score != null
                      ? ` · trust ${Math.round(r.trust_score)}`
                      : ''}
                    {r.otifef_average != null
                      ? ` · OTIFEF ${Math.round(r.otifef_average)}`
                      : ''}
                    {r.reasons?.length
                      ? ` · ${r.reasons.slice(0, 2).join(', ')}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/c/${r.id}`}
                    className="btn-secondary !py-1.5 !px-3 text-xs"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    onClick={() => {
                      setPeerId(r.id);
                      setNote(
                        `Hi — we'd like to trade with ${name} on SupplierAdvisor.`
                      );
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Request trade
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {peerId != null ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/40">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-5 shadow-xl">
            <p className="text-sm font-black text-slate-900">Request to trade</p>
            <p className="text-xs text-neutral-500 mt-1">
              Personal note is required (quality gate).
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <div className="mt-3 flex gap-2 justify-end">
              <button
                type="button"
                className="btn-secondary !py-2 !px-3 text-xs"
                onClick={() => setPeerId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="btn-primary !py-2 !px-3 text-xs"
                onClick={() => void requestTrade()}
              >
                {busy ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-xs text-neutral-500">
        <Link href="/dashboard/connections" className="font-bold text-[#0077b6]">
          ← Connections
        </Link>
        {' · '}
        <Link href="/directory" className="font-bold text-[#0077b6]">
          Public directory
        </Link>
      </p>
    </RelationshipPage>
  );
}
