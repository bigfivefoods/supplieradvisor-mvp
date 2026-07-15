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
import {
  SALES_CONTRACTOR_EMAIL_DOMAIN,
  SUPER_LINK_TONNES,
  SUPER_LINK_EXAMPLE_ZAR_PER_TONNE,
  superLinkExampleDealValue,
} from '@/lib/sales-contractor/agreement';
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
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 border border-amber-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-3">
          <FileSignature className="w-3.5 h-3.5" />
          Independent Sales Contractor Agreement
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Join the {companyName || 'company'} sales team
        </h1>
        <p className="mt-2 text-neutral-500 max-w-2xl">
          Sign the Independent Sales Contractor Agreement (South African law), then subscribe
          (R199/mo · 6 months). Commission is <strong>4% · 5% · 6%</strong> (a super-link load of 32 t
          earns <strong>6%</strong>). On acceptance you receive a corporate mailbox on{' '}
          <strong className="text-slate-700">@{SALES_CONTRACTOR_EMAIL_DOMAIN}</strong>. All
          customers and deals are saved under the company.
        </p>
      </div>

      {signed && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-900">Agreement signed</p>
            <p className="text-sm text-emerald-800">
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
        <div className="rounded-3xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Commission schedule</h2>
          <table className="w-full text-sm">
            <tbody>
              {tiers.map((t, i) => {
                const from = i === 0 ? 0 : Number(tiers[i - 1].upTo || 0);
                const range =
                  t.upTo == null
                    ? `${formatZar(from)}+ (super-link 32 t)`
                    : i === 0
                      ? `Below ${formatZar(t.upTo)}`
                      : `${formatZar(from)} – under ${formatZar(t.upTo)}`;
                return (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-2 text-neutral-500 text-xs sm:text-sm">{range}</td>
                    <td className="py-2 text-right font-bold text-amber-600">
                      {t.ratePct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-gradient-to-br from-amber-500/15 to-orange-500/5 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Example earnings</h2>
          <ul className="space-y-2">
            {(() => {
              const linkDeal = superLinkExampleDealValue();
              const linkRes = calculateCommission(linkDeal, { tiers });
              return (
                <li className="rounded-2xl border border-amber-200/80 bg-white/70 px-3 py-2.5 mb-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-1">
                    Super-link load ({SUPER_LINK_TONNES} t)
                  </div>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-neutral-600">
                      {SUPER_LINK_TONNES} t × {formatZar(SUPER_LINK_EXAMPLE_ZAR_PER_TONNE)}/t ={' '}
                      <strong className="text-slate-800">{formatZar(linkDeal)}</strong>
                    </span>
                    <span className="font-bold text-amber-700 shrink-0">
                      {formatZarPrecise(linkRes.commissionAmount)}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Illustrative only · progressive commission (~
                    {linkRes.effectiveRatePct.toFixed(2)}% effective)
                  </p>
                </li>
              );
            })()}
            {[50_000, 250_000, 1_000_000].map((amt) => {
              const r = calculateCommission(amt, { tiers });
              return (
                <li key={amt} className="flex justify-between text-sm">
                  <span className="text-neutral-600">{formatZar(amt)} deal</span>
                  <span className="font-bold text-amber-700">
                    {formatZarPrecise(r.commissionAmount)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-neutral-500 mt-3">
            Stepped rates on the whole deal: under ½ link 4% · ½ to under 1 link 5% · full
            super-link ({SUPER_LINK_TONNES} t) and above 6%.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-slate-700">
        <strong className="text-slate-900">After you accept:</strong> you will be allocated a
        company email address of the form{' '}
        <code className="text-xs font-bold text-[#0077b6]">
          yourname@{SALES_CONTRACTOR_EMAIL_DOMAIN}
        </code>{' '}
        for authorised sales communication. The mailbox remains company property and is revoked on
        termination.
      </div>

      {/* Full agreement HTML */}
      <div className="rounded-3xl border border-neutral-200 bg-white text-slate-800 overflow-hidden shadow-2xl">
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
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-600 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-sm text-slate-700">
              I have read and agree to the Independent Sales Contractor Agreement (South Africa),
              including the commission schedule (4% · 5% · 6%, super-link 32 t at 6%), the
              R199/month 6-month portal subscription, allocation of a{' '}
              <strong>@{SALES_CONTRACTOR_EMAIL_DOMAIN}</strong> email address, POPIA duties, and
              that all CRM data belongs to{' '}
              <strong>{companyName || 'the Company'}</strong>. I understand I am an independent
              contractor (not an employee) and am responsible for my own tax compliance unless the
              law provides otherwise.
            </span>
          </label>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">
              Full legal name (electronic signature under ECTA)
            </label>
            <input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Type your name as signature"
              className="w-full rounded-2xl bg-slate-50 border border-neutral-200 px-4 py-3 text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>
          <button
            type="button"
            disabled={signing || !accepted}
            onClick={() => void sign()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white font-bold shadow-sm shadow-sky-200/50 disabled:opacity-50"
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
