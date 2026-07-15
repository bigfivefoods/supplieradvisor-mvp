'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  FileSignature,
  CheckCircle2,
  Shield,
  Download,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  DEFAULT_COMMISSION_TIERS,
  formatZar,
  formatZarPrecise,
  calculateCommission,
  type CommissionTier,
} from '@/lib/sales-contractor/commission';
import {
  SALES_CONTRACTOR_EMAIL_DOMAIN,
  SALES_CONTRACTOR_KPIS,
  SUPER_LINK_TONNES,
  SUPER_LINK_UNITS,
  SUPER_LINK_UNIT_PRICE_ZAR,
  superLinkExampleDealValue,
} from '@/lib/sales-contractor/agreement';
import type { SalesContractorAgreement } from '@/lib/sales-contractor/types';
import type { ProgramCriterion } from '@/lib/sales-program';

type ProgramBrief = {
  program_name?: string;
  program_summary?: string;
  contract_version?: string;
  commission_tiers?: CommissionTier[];
  sales_criteria?: ProgramCriterion[];
  email_domain?: string | null;
};

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
  const [downloading, setDownloading] = useState(false);
  const [contractVersion, setContractVersion] = useState('');
  const [program, setProgram] = useState<ProgramBrief | null>(null);
  /** True only after real e-sign — not owner/admin portal access. */
  const [agreementSigned, setAgreementSigned] = useState(false);

  const load = useCallback(async () => {
    if (!companyId || !privyUserId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/sales/agreement?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load agreement');
      setHtml(data.html || '');
      setSigned(Boolean(data.signed));
      setAgreementSigned(
        Boolean(
          data.agreementSigned ?? data.agreement?.status === 'signed'
        )
      );
      setAgreement(data.agreement || null);
      setCompanyName(data.companyName || '');
      setContractVersion(
        data.program?.contract_version || data.contractVersion || ''
      );
      setProgram(data.program || null);
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

  const downloadAgreement = async () => {
    if (!companyId || !privyUserId) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
        format: 'pdf',
      });
      const res = await fetch(`/api/sales/agreement?${params}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Download failed');
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = /filename="([^"]+)"/.exec(cd);
      const filename =
        match?.[1] ||
        (signed
          ? 'sales-contractor-agreement-signed.pdf'
          : 'sales-contractor-agreement-draft.pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        signed
          ? 'Signed agreement PDF downloaded'
          : 'Draft agreement PDF downloaded'
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const printAgreement = async () => {
    if (!companyId || !privyUserId) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
        format: 'html',
      });
      const res = await fetch(`/api/sales/agreement?${params}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Could not open print view');
      const docHtml = await res.text();
      const w = window.open('', '_blank');
      if (!w) {
        toast.error('Allow pop-ups to print, or use Download PDF instead');
        return;
      }
      w.document.open();
      w.document.write(docHtml);
      w.document.close();
      // Give styles a moment to load
      setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch {
          /* user can print manually */
        }
      }, 400);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Print failed');
    } finally {
      setDownloading(false);
    }
  };

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

  /**
   * Commission always follows company Sales program for display/signing,
   * except after a real e-sign freeze (agreementSigned — not owner exempt).
   */
  const tiers: CommissionTier[] = (() => {
    if (
      agreementSigned &&
      agreement?.status === 'signed' &&
      agreement?.commission_tiers?.length
    ) {
      return agreement.commission_tiers;
    }
    if (program?.commission_tiers?.length) return program.commission_tiers;
    if (agreement?.commission_tiers?.length) return agreement.commission_tiers;
    return DEFAULT_COMMISSION_TIERS;
  })();
  const ratesLabel = tiers.map((t) => `${t.ratePct}%`).join(' · ');
  const minRate = Math.min(...tiers.map((t) => t.ratePct));
  const maxRate = Math.max(...tiers.map((t) => t.ratePct));
  const rateBandLabel =
    minRate === maxRate ? `${minRate}%` : `${minRate}% – ${maxRate}%`;
  const kpis =
    program?.sales_criteria?.length
      ? program.sales_criteria
      : SALES_CONTRACTOR_KPIS.map((k) => ({
          key: k.key,
          title: k.title,
          detail: k.detail,
        }));
  const emailDomain =
    (program?.email_domain || SALES_CONTRACTOR_EMAIL_DOMAIN).replace(/^@/, '') ||
    SALES_CONTRACTOR_EMAIL_DOMAIN;
  const linkDealValue = superLinkExampleDealValue();
  const halfLinkValue = linkDealValue / 2;

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
          Sole agreement · NDA · Independent contractor (SA)
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Join the {companyName || 'company'} sales team
        </h1>
        <p className="mt-2 text-neutral-500 max-w-2xl">
          This is the <strong className="text-slate-700">only agreement</strong> governing your
          engagement — a sole Independent Sales Contractor Agreement and non-disclosure undertaking
          under South African law. Sign it, then subscribe (R199/mo · 6 months). Commission is{' '}
          <strong>personal sales only</strong> — <strong>not multi-level marketing</strong> — on a
          stepped <strong>{rateBandLabel}</strong> scale (
          <strong className="text-amber-700">{ratesLabel || '4% · 5% · 6%'}</strong>) for deals{' '}
          <em>you</em> bring. Full super-link (~R1.5m) pays at the top rate. On acceptance you may
          receive <strong className="text-slate-700">@{emailDomain}</strong>. All customers and
          deals belong to the company.
        </p>
      </div>

      {/* Clear 4–6% commission structure banner */}
      <div className="rounded-3xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 px-5 py-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">
              Commission structure
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {rateBandLabel}{' '}
              <span className="text-base font-bold text-slate-500">stepped · whole deal</span>
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Rates: <strong className="text-amber-800">{ratesLabel || '4% · 5% · 6%'}</strong>
              {' '}— personal origin only (not multi-level marketing)
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-amber-500 text-white px-4 py-3 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide opacity-90">
              Super-link (~R1.5m)
            </div>
            <div className="text-2xl font-black">
              {tiers[tiers.length - 1]?.ratePct ?? 6}%
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          {tiers.map((t, i) => {
            const from = i === 0 ? 0 : Number(tiers[i - 1].upTo || 0);
            const range =
              t.upTo == null
                ? `${formatZar(from)}+`
                : i === 0
                  ? `Under ${formatZar(t.upTo)}`
                  : `${formatZar(from)} – under ${formatZar(t.upTo)}`;
            return (
              <div
                key={i}
                className="rounded-2xl border border-amber-200/80 bg-white px-3 py-3 text-center"
              >
                <div className="text-2xl font-black text-amber-600">{t.ratePct}%</div>
                <div className="text-[11px] font-semibold text-slate-700 mt-0.5">
                  {t.label || `Band ${i + 1}`}
                </div>
                <div className="text-[10px] text-neutral-500 mt-1 leading-snug">{range}</div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-neutral-500 mt-3 mb-0">
          Illustrative anchors: ½ super-link ≈ {formatZar(halfLinkValue)} · full super-link ≈{' '}
          {formatZar(linkDealValue)} ({SUPER_LINK_UNITS.toLocaleString('en-ZA')} units ×{' '}
          {formatZar(SUPER_LINK_UNIT_PRICE_ZAR)}). Live catalogue prices may differ.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={downloading || !html}
          onClick={() => void downloadAgreement()}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:border-[#00b4d8] disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4 text-[#00b4d8]" />
          )}
          {signed ? 'Download signed PDF' : 'Download agreement PDF (draft)'}
        </button>
        <button
          type="button"
          disabled={downloading || !html}
          onClick={() => void printAgreement()}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-slate-300 disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
        {contractVersion && (
          <span className="inline-flex items-center text-[11px] font-semibold text-slate-400 px-2">
            Version {contractVersion}
          </span>
        )}
      </div>

      {signed && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3">
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
              <p className="text-xs text-emerald-700 mt-1">
                Keep a downloaded copy for your records. You can re-download anytime from this page.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={downloading}
            onClick={() => void downloadAgreement()}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
          >
            <Download className="w-4 h-4" />
            Download signed PDF
          </button>
        </div>
      )}

      {/* Example earnings with 4–6% structure */}
      <div className="rounded-3xl border border-neutral-200 bg-gradient-to-br from-amber-500/15 to-orange-500/5 p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-1">
          Example earnings at {ratesLabel || '4% · 5% · 6%'}
        </h2>
        <p className="text-xs text-neutral-500 mb-3">
          Stepped scale — the whole deal is paid at one rate for its size band.
        </p>
        <ul className="space-y-2">
          {(() => {
            const linkRes = calculateCommission(linkDealValue, { tiers });
            return (
              <li className="rounded-2xl border border-amber-200/80 bg-white/70 px-3 py-2.5 mb-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-1">
                  Super-link load (~{SUPER_LINK_TONNES} t ·{' '}
                  {SUPER_LINK_UNITS.toLocaleString('en-ZA')} units) → top rate
                </div>
                <div className="flex justify-between text-sm gap-2">
                  <span className="text-neutral-600">
                    {SUPER_LINK_UNITS.toLocaleString('en-ZA')} ×{' '}
                    {formatZar(SUPER_LINK_UNIT_PRICE_ZAR)} ={' '}
                    <strong className="text-slate-800">{formatZar(linkDealValue)}</strong>
                  </span>
                  <span className="font-bold text-amber-700 shrink-0">
                    {formatZarPrecise(linkRes.commissionAmount)}{' '}
                    <span className="text-xs font-semibold">
                      @ {linkRes.appliedRatePct}%
                    </span>
                  </span>
                </div>
              </li>
            );
          })()}
          {[50_000, halfLinkValue, 1_000_000].map((amt) => {
            const r = calculateCommission(amt, { tiers });
            return (
              <li key={amt} className="flex justify-between text-sm gap-2">
                <span className="text-neutral-600">
                  {formatZar(amt)} deal
                  <span className="text-[10px] text-neutral-400 ml-1">
                    → {r.appliedRatePct}%
                  </span>
                </span>
                <span className="font-bold text-amber-700">
                  {formatZarPrecise(r.commissionAmount)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-neutral-500 mt-3 mb-0">
          Personal sales only — not MLM. No downline or connection-of-connection commission.
        </p>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-4 text-sm text-slate-700">
        <div className="text-[10px] font-black uppercase tracking-widest text-violet-800 mb-2">
          The only KPIs / sales criteria under this agreement
        </div>
        <ol className="list-decimal pl-5 space-y-1.5">
          {kpis.map((k) => (
            <li key={k.key}>
              <strong className="text-slate-900">{k.title}</strong>
              <span className="text-slate-600"> — {k.detail}</span>
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-slate-500 mt-2 mb-0">
          Set by the company sales program. No other contractual performance KPIs apply unless
          agreed in a written variation.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-950">
        <strong className="text-rose-900">Not multi-level marketing.</strong> You earn commission
        only on sales <em>you</em> personally generate and close for the company. No overrides,
        downlines, residuals on other contractors, or “connections of connections”. This is not an
        MLM, pyramid, or network-marketing pay plan.
      </div>

      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-slate-700">
        <strong className="text-slate-900">After you accept:</strong> you will be allocated a
        company email address of the form{' '}
        <code className="text-xs font-bold text-[#0077b6]">
          yourname@{emailDomain}
        </code>{' '}
        for authorised sales communication (where configured). The mailbox remains company property
        and is revoked on termination.
      </div>

      {/* Full agreement HTML */}
      <div className="rounded-3xl border border-neutral-200 bg-white text-slate-800 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00b4d8]" />
            <span className="text-sm font-semibold text-slate-700">
              Sole agreement &amp; NDA (binding)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={downloading || !html}
              onClick={() => void downloadAgreement()}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0077b6] hover:underline disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {signed ? 'Download signed PDF' : 'Download draft PDF'}
            </button>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Confidential · Scroll to read in full
            </span>
          </div>
        </div>
        <div
          className="px-6 py-6 max-h-[min(70vh,560px)] overflow-y-auto prose prose-sm max-w-none"
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
              I have read and agree to this <strong>sole and entire</strong> Independent Sales
              Contractor Agreement and Non-Disclosure Undertaking (South Africa). I understand it is
              the <strong>only agreement</strong> on this subject (no other oral or WhatsApp side
              deals apply), includes a binding NDA and fair non-solicit, and that the{' '}
              <strong>only KPIs / sales criteria</strong> are those in clause 4A for this company
              program. I accept that commission is{' '}
              <strong>personal sales only — not multi-level marketing</strong> (no downline or
              connection-of-connection pay) on the stepped schedule{' '}
              <strong>{ratesLabel || '4% · 5% · 6%'}</strong> ({rateBandLabel}), R199/month 6-month
              portal subscription, <strong>@{emailDomain}</strong> mailbox (where configured), POPIA
              duties, and that all CRM data and customers belong to{' '}
              <strong>{companyName || 'the Company'}</strong>. I am an independent contractor (not an
              employee) and am responsible for my own tax compliance unless the law provides
              otherwise.
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
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
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
            <button
              type="button"
              disabled={downloading || !html}
              onClick={() => void downloadAgreement()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-800 font-bold text-sm hover:border-[#00b4d8] disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Download PDF before signing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
