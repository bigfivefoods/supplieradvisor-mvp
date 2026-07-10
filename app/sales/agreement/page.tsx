'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, FileSignature, CheckCircle2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  DEFAULT_COMMISSION_TIERS,
  formatZar,
  formatZarPrecise,
  calculateCommission,
} from '@/lib/sales-contractor/commission';
import type { SalesContractorAgreement } from '@/lib/sales-contractor/types';

export default function SalesAgreementPage() {
  const router = useRouter();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [html, setHtml] = useState('');
  const [signed, setSigned] = useState(false);
  const [agreement, setAgreement] = useState<SalesContractorAgreement | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [signatureName, setSignatureName] = useState('');

  const load = useCallback(async () => {
    if (!companyId || !privyUserId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/sales/agreement?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load agreement');
      setHtml(data.html || '');
      setSigned(Boolean(data.signed));
      setAgreement(data.agreement || null);
      setCompanyName(data.companyName || '');
      if (data.agreement?.signature_name) setSignatureName(data.agreement.signature_name);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sign = async () => {
    if (!accepted) {
      toast.error('Please confirm you have read the agreement');
      return;
    }
    if (signatureName.trim().length < 2) {
      toast.error('Type your full legal name');
      return;
    }
    setSigning(true);
    try {
      const res = await fetch('/api/sales/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          accepted: true,
          signatureName: signatureName.trim(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign failed');
      toast.success('Agreement signed — next: activate your 6-month subscription');
      setSigned(true);
      setAgreement(data.agreement);
      router.push('/sales/subscribe');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Sign failed');
    } finally {
      setSigning(false);
    }
  };

  const tiers = agreement?.commission_tiers?.length
    ? agreement.commission_tiers
    : DEFAULT_COMMISSION_TIERS;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 border border-amber-400/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200 mb-3">
          <FileSignature className="w-3.5 h-3.5" />
          Independent Sales Contractor Agreement
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Join the {companyName || 'company'} sales team
        </h1>
        <p className="mt-2 text-slate-400 max-w-2xl">
          Sign the agreement, then subscribe (R199/mo · 6 months). Commission grows with deal size
          from 3% up to 5%. All customers and deals are saved under the company.
        </p>
      </div>

      {signed && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-100">Agreement signed</p>
            <p className="text-sm text-emerald-200/80">
              {agreement?.signature_name} ·{' '}
              {agreement?.signed_at
                ? new Date(agreement.signed_at).toLocaleString('en-ZA')
                : ''}{' '}
              · version {agreement?.contract_version}
            </p>
          </div>
        </div>
      )}

      {/* Commission snapshot */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-bold text-white mb-3">Commission schedule</h2>
          <table className="w-full text-sm">
            <tbody>
              {tiers.map((t, i) => {
                const from = i === 0 ? 0 : Number(tiers[i - 1].upTo || 0);
                return (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 text-slate-400">
                      {formatZar(from)}
                      {t.upTo == null ? '+' : ` – ${formatZar(t.upTo)}`}
                    </td>
                    <td className="py-2 text-right font-bold text-amber-300">{t.ratePct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/15 to-orange-500/5 p-5">
          <h2 className="text-sm font-bold text-white mb-3">Example earnings</h2>
          <ul className="space-y-2">
            {[50_000, 250_000, 1_000_000].map((amt) => {
              const r = calculateCommission(amt, { tiers });
              return (
                <li key={amt} className="flex justify-between text-sm">
                  <span className="text-slate-300">{formatZar(amt)} deal</span>
                  <span className="font-bold text-amber-200">
                    {formatZarPrecise(r.commissionAmount)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-slate-500 mt-3">
            Progressive bands — not a flat rate on the whole deal.
          </p>
        </div>
      </div>

      {/* Full agreement HTML */}
      <div className="rounded-3xl border border-white/10 bg-white text-slate-800 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#00b4d8]" />
          <span className="text-sm font-semibold text-slate-700">Legal agreement</span>
        </div>
        <div
          className="px-6 py-6 max-h-[480px] overflow-y-auto prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {!signed && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-600 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-sm text-slate-200">
              I have read and agree to the Independent Sales Contractor Agreement, including the
              commission schedule (3% → 5% as deals grow, max 5%), the R199/month 6-month portal
              subscription, and that all CRM data belongs to{' '}
              <strong>{companyName || 'the Company'}</strong>.
            </span>
          </label>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              Full legal name (electronic signature)
            </label>
            <input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Type your name as signature"
              className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>
          <button
            type="button"
            disabled={signing || !accepted}
            onClick={() => void sign()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg shadow-orange-500/30 disabled:opacity-50"
          >
            {signing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileSignature className="w-5 h-5" />
            )}
            Sign &amp; join sales team
          </button>
        </div>
      )}
    </div>
  );
}
