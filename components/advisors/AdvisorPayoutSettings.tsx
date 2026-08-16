'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import { formatZar } from '@/lib/b2c/member-account-types';
import type { AdvisorPayoutPublic, AdvisorPayoutSplit } from '@/lib/billing/advisor-payout';

type Bank = { name: string; code: string };

export function AdvisorPayoutSettings({
  compact,
  onChange,
}: {
  compact?: boolean;
  onChange?: (payout: AdvisorPayoutPublic) => void;
}) {
  const { companyId, withAuthJson } = useApiAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payout, setPayout] = useState<AdvisorPayoutPublic | null>(null);
  const [preview, setPreview] = useState<AdvisorPayoutSplit | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [form, setForm] = useState({
    business_name: '',
    bank_code: '',
    account_number: '',
    account_name: '',
  });
  const [editing, setEditing] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{
      payout?: AdvisorPayoutPublic;
      preview?: AdvisorPayoutSplit;
      banks?: Bank[];
      prefill?: {
        business_name?: string;
        bank_name?: string;
        account_number?: string;
      };
    }>(`/api/advisors/payouts?companyId=${companyId}&banks=1`);
    setPayout(data.payout || null);
    if (data.payout) onChangeRef.current?.(data.payout);
    setPreview(data.preview || null);
    setBanks(data.banks || []);
    const listed = data.banks || [];
    let bankCode = '';
    const needle = String(data.prefill?.bank_name || '').toLowerCase();
    if (needle && listed.length) {
      const hit = listed.find(
        (b) =>
          b.name.toLowerCase() === needle ||
          b.name.toLowerCase().includes(needle) ||
          needle.includes(b.name.toLowerCase())
      );
      if (hit) bankCode = hit.code;
    }
    setForm((f) => ({
      business_name: data.prefill?.business_name || f.business_name,
      bank_code: f.bank_code || bankCode,
      account_number: data.payout?.ready ? '' : data.prefill?.account_number || '',
      account_name: data.payout?.account_name || '',
    }));
    if (!data.payout?.ready) setEditing(true);
  }, [companyId, withAuthJson]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load payout');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const save = async () => {
    if (!companyId) return;
    setBusy(true);
    try {
      const data = await withAuthJson<{
        message?: string;
        payout?: AdvisorPayoutPublic;
        preview?: AdvisorPayoutSplit;
      }>('/api/advisors/payouts', {
        method: 'POST',
        jsonBody: {
          companyId,
          action: 'save',
          business_name: form.business_name,
          bank_code: form.bank_code,
          account_number: form.account_number,
          account_name: form.account_name,
        },
      });
      if (data.payout) {
        setPayout(data.payout);
        onChangeRef.current?.(data.payout);
      }
      if (data.preview) setPreview(data.preview);
      setForm((f) => ({ ...f, account_number: '' }));
      setEditing(false);
      toast.success(data.message || 'Payout connected');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not connect payout');
    } finally {
      setBusy(false);
    }
  };

  const resolveName = async () => {
    if (!companyId || !form.bank_code || form.account_number.replace(/\s/g, '').length < 6) {
      return;
    }
    try {
      const data = await withAuthJson<{
        account?: { account_name?: string };
      }>('/api/advisors/payouts', {
        method: 'POST',
        jsonBody: {
          companyId,
          action: 'resolve',
          bank_code: form.bank_code,
          account_number: form.account_number,
        },
      });
      if (data.account?.account_name) {
        setForm((f) => ({ ...f, account_name: data.account!.account_name || '' }));
      }
    } catch {
      /* optional — save will still try */
    }
  };

  const disconnect = async () => {
    if (!companyId) return;
    if (!window.confirm('Pause card / Apple Pay settlement to this bank? Proof of payment still works.')) {
      return;
    }
    setBusy(true);
    try {
      const data = await withAuthJson<{
        message?: string;
        payout?: AdvisorPayoutPublic;
      }>('/api/advisors/payouts', {
        method: 'POST',
        jsonBody: { companyId, action: 'disconnect' },
      });
      if (data.payout) {
        setPayout(data.payout);
        onChangeRef.current?.(data.payout);
      }
      setEditing(true);
      toast.success(data.message || 'Payout paused');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not pause payout');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading payout…
      </div>
    );
  }

  const ready = Boolean(payout?.ready);

  return (
    <section
      className={`rounded-2xl border p-4 ${
        ready
          ? 'border-emerald-200 bg-emerald-50/60'
          : 'border-amber-200 bg-amber-50/70'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="inline-flex items-center gap-1.5 text-sm font-black text-slate-900">
            <Landmark className="h-4 w-4" /> Card / Apple Pay payout
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Members pay the listed price. You receive settlement minus a{' '}
            {payout?.percentage_charge ?? 1}% admin fee and Paystack card fees.
            Proof of payment and cash stay off-platform.
          </p>
        </div>
        {ready ? (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
            Connected
          </span>
        ) : (
          <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
            Required for cards
          </span>
        )}
      </div>

      {ready && !editing ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
          <div>
            <p className="font-bold text-slate-900">
              {payout?.account_name || payout?.business_name || 'Payout account'}
            </p>
            <p className="text-[11px] text-slate-500">
              {payout?.settlement_bank_name || 'Bank'}
              {payout?.account_last4 ? ` · •••• ${payout.account_last4}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700"
              onClick={() => setEditing(true)}
            >
              Change bank
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-50"
              onClick={() => void disconnect()}
            >
              Pause
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Business name on the bank account"
            value={form.business_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, business_name: e.target.value }))
            }
          />
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={form.bank_code}
            onChange={(e) => setForm((f) => ({ ...f, bank_code: e.target.value }))}
          >
            <option value="">
              {banks.length ? 'Select bank' : 'Banks unavailable — check Paystack keys'}
            </option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Account number"
            inputMode="numeric"
            autoComplete="off"
            value={form.account_number}
            onChange={(e) =>
              setForm((f) => ({ ...f, account_number: e.target.value }))
            }
            onBlur={() => void resolveName()}
          />
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Account name (auto-filled)"
            value={form.account_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, account_name: e.target.value }))
            }
          />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : ready ? 'Update payout' : 'Connect payout'}
            </button>
            {ready ? (
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      )}

      {!compact && preview ? (
        <p className="mt-3 text-[11px] text-slate-600">
          Example on {formatZar(preview.member_pays_zar)}: member pays{' '}
          {formatZar(preview.member_pays_zar)} · admin fee{' '}
          {formatZar(preview.platform_fee_zar)} · you receive{' '}
          {formatZar(preview.advisor_gross_zar)} before Paystack card fees.
        </p>
      ) : null}
    </section>
  );
}
