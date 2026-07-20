'use client';

/**
 * Seller decision desk — claim detail: POP, bank preview, confirm / reject+reason.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  X,
  Banknote,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export type ClaimRow = {
  id: number;
  invoice_id: number;
  amount: number;
  currency?: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  reference?: string | null;
  proof_url?: string | null;
  notes?: string | null;
  claimed_at?: string;
  ageHours?: number;
  slaBreached?: boolean;
};

type BankSug = {
  bankTxnId: number | string;
  amount: number;
  confidence: number;
  reason: string;
  description?: string | null;
  reference?: string | null;
};

type Props = {
  companyId: number;
  claim: ClaimRow;
  onClose: () => void;
  onResolved: () => void;
};

export default function ClaimDecisionDrawer({
  companyId,
  claim,
  onClose,
  onResolved,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [previewBanks, setPreviewBanks] = useState<BankSug[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);

  const loadBankPreview = useCallback(async () => {
    setLoadingBanks(true);
    try {
      // Soft: use last confirm path by dry-running suggest via payment-claims GET + client estimate
      // Preview by calling bank suggest through a lightweight confirm dry-run is not available;
      // instead hit money-hub isn't enough — call suggest via a soft internal fetch after confirm only.
      // Pre-confirm: use ar ledger empty + optional bank list endpoint if any
      const res = await fetch(
        `/api/customers/payment-claims?companyId=${companyId}&status=pending`,
        { cache: 'no-store' }
      );
      // Bank suggestions only after confirm historically; pre-load via dedicated soft endpoint
      const sug = await fetch(
        `/api/customers/bank-suggest-claim?companyId=${companyId}&claimId=${claim.id}`,
        { cache: 'no-store' }
      ).catch(() => null);
      if (sug && sug.ok) {
        const j = await sug.json();
        setPreviewBanks(j.suggestions || []);
      } else {
        setPreviewBanks([]);
      }
      void res;
    } catch {
      setPreviewBanks([]);
    } finally {
      setLoadingBanks(false);
    }
  }, [companyId, claim.id]);

  useEffect(() => {
    void loadBankPreview();
  }, [loadBankPreview]);

  const resolve = async (action: 'confirm' | 'reject') => {
    setBusy(true);
    try {
      const res = await fetch('/api/customers/payment-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          claimId: claim.id,
          action,
          autoBankMatch: action === 'confirm',
          rejectReason:
            action === 'reject' ? rejectReason.trim().slice(0, 500) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        action === 'confirm'
          ? data.bankAutoApplied?.ok
            ? 'Ledger posted + bank linked'
            : 'Posted to AR ledger'
          : 'Rejected — buyer notified',
        { description: data.bankMatchHint || undefined }
      );
      onResolved();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const isImg =
    claim.proof_url &&
    /\.(png|jpe?g|gif|webp)(\?|$)/i.test(String(claim.proof_url));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 border-0 cursor-pointer"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
              Claim decision
            </p>
            <h2 className="text-lg font-black text-slate-900">
              {Number(claim.amount).toLocaleString()} {claim.currency || 'ZAR'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {claim.invoice_number || `Invoice #${claim.invoice_id}`}
              {claim.customer_name ? ` · ${claim.customer_name}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 text-[11px]">
          {claim.slaBreached ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 text-white font-black px-2 py-0.5 uppercase">
              <AlertTriangle className="w-3 h-3" /> SLA
            </span>
          ) : null}
          {claim.ageHours != null ? (
            <span className="rounded-full bg-amber-100 text-amber-950 font-bold px-2 py-0.5">
              {claim.ageHours}h old
            </span>
          ) : null}
          {claim.reference ? (
            <span className="rounded-full border px-2 py-0.5 font-mono">
              ref {claim.reference}
            </span>
          ) : null}
        </div>

        {claim.notes ? (
          <p className="text-xs text-slate-600 bg-slate-50 rounded-xl border px-3 py-2 mb-4">
            {String(claim.notes).slice(0, 400)}
          </p>
        ) : null}

        <section className="mb-4">
          <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Proof of payment
          </p>
          {claim.proof_url ? (
            <div className="rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50">
              {isImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={String(claim.proof_url)}
                  alt="POP"
                  className="w-full max-h-56 object-contain bg-white"
                />
              ) : (
                <a
                  href={String(claim.proof_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-4 text-sm font-bold text-[#0077b6] underline"
                >
                  Open POP file / URL
                </a>
              )}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">No POP attached</p>
          )}
        </section>

        <section className="mb-6">
          <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5" /> Bank match preview
          </p>
          {loadingBanks ? (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : previewBanks.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No pre-match yet — confirm will still auto-link if confidence ≥ 80%.
            </p>
          ) : (
            <ul className="text-xs space-y-1.5">
              {previewBanks.slice(0, 5).map((b) => (
                <li
                  key={String(b.bankTxnId)}
                  className="rounded-lg border border-sky-100 bg-sky-50/50 px-2.5 py-1.5"
                >
                  <strong>{b.amount.toLocaleString()}</strong> · conf{' '}
                  {b.confidence}% · {b.reason}
                </li>
              ))}
            </ul>
          )}
        </section>

        {!showReject ? (
          <div className="flex flex-col gap-2">
            {previewBanks[0] && previewBanks[0].confidence >= 80 ? (
              <p className="text-[11px] text-sky-900 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
                High-confidence bank match ({previewBanks[0].confidence}% ·{' '}
                {previewBanks[0].reason}) will apply on confirm.
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void resolve('confirm')}
              className="w-full rounded-full bg-teal-700 text-white text-sm font-bold py-2.5 disabled:opacity-50"
            >
              {busy
                ? 'Working…'
                : previewBanks[0] && previewBanks[0].confidence >= 80
                  ? 'Confirm → ledger + bank match'
                  : 'Confirm → ledger (+ bank if match)'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowReject(true)}
              className="w-full rounded-full border text-sm font-bold py-2.5"
            >
              Reject…
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">
              Reason for buyer (optional)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              placeholder="e.g. Amount mismatch — please re-claim with correct ref"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolve('reject')}
                className="flex-1 rounded-full bg-rose-700 text-white text-sm font-bold py-2.5 disabled:opacity-50"
              >
                Confirm reject
              </button>
              <button
                type="button"
                onClick={() => setShowReject(false)}
                className="rounded-full border px-4 text-sm font-bold"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
