'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banknote, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { apiJson } from '@/lib/client/api-fetch';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  formatZar,
  kindAccountLabel,
  type AdvisorAccountKind,
  type MemberAccountCharge,
  type MemberAccountPayment,
  type MemberAccountSummary,
} from '@/lib/b2c/member-account-types';

export type B2cAccountRow = {
  company_id: number;
  brand: string;
  kind: AdvisorAccountKind;
  ref_id: string;
  summary: MemberAccountSummary;
  charges: MemberAccountCharge[];
  payments: MemberAccountPayment[];
};

export function B2cMemberAccounts({
  focusCompanyId,
  onLoaded,
}: {
  focusCompanyId?: number | null;
  onLoaded?: (rows: B2cAccountRow[]) => void;
}) {
  const { getAccessToken, user } = usePrivy();
  const [rows, setRows] = useState<B2cAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(focusCompanyId ?? null);
  const [pop, setPop] = useState<Record<number, { reference: string; notes: string; file: File | null }>>(
    {}
  );

  const authOpts = useCallback(async () => {
    let accessToken: string | null = null;
    try {
      accessToken = await getAccessToken();
    } catch {
      accessToken = null;
    }
    return {
      accessToken,
      privyUserId: getCanonicalUserId(user?.id),
    };
  }, [getAccessToken, user?.id]);

  const load = useCallback(async () => {
    const auth = await authOpts();
    const data = await apiJson<{ accounts?: B2cAccountRow[] }>(
      '/api/b2c/accounts',
      auth
    );
    const next = data.accounts || [];
    setRows(next);
    onLoaded?.(next);
    return next;
  }, [authOpts, onLoaded]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Load failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (focusCompanyId) setOpenId(focusCompanyId);
  }, [focusCompanyId]);

  const selectedOpen = (row: B2cAccountRow) =>
    row.charges.filter((c) => c.status === 'open');

  const pay = async (row: B2cAccountRow) => {
    const ids = selectedOpen(row).map((c) => c.id);
    if (!ids.length) {
      toast.error('Nothing open to pay');
      return;
    }
    setBusy(`pay-${row.company_id}`);
    try {
      const auth = await authOpts();
      const data = await apiJson<{
        authorization_url?: string;
        error?: string;
      }>('/api/b2c/accounts', {
        ...auth,
        method: 'POST',
        jsonBody: {
          action: 'pay',
          companyId: row.company_id,
          charge_ids: ids,
        },
      });
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      throw new Error(data.error || 'Could not start payment');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Pay failed');
    } finally {
      setBusy(null);
    }
  };

  const sendPop = async (row: B2cAccountRow) => {
    const ids = selectedOpen(row).map((c) => c.id);
    if (!ids.length) {
      toast.error('Nothing open to settle');
      return;
    }
    const form = pop[row.company_id] || { reference: '', notes: '', file: null };
    setBusy(`pop-${row.company_id}`);
    try {
      const fd = new FormData();
      fd.set('action', 'pop');
      fd.set('companyId', String(row.company_id));
      fd.set('charge_ids', ids.join(','));
      fd.set('reference', form.reference);
      fd.set('notes', form.notes);
      if (form.file) fd.set('file', form.file);
      const auth = await authOpts();
      const data = await apiJson<{ message?: string }>('/api/b2c/accounts', {
        ...auth,
        method: 'POST',
        body: fd,
      });
      toast.success(data.message || 'Proof sent');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not send proof');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <p className="rounded-2xl bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        When a clinic or gym sends you an invoice, it appears here — and in
      your email. Open it to pay by card or send proof of payment.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const open = selectedOpen(row);
        const due = row.summary.open_zar;
        const expanded = openId === row.company_id;
        return (
          <li
            key={`${row.company_id}-${row.kind}-${row.ref_id}`}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() =>
                setOpenId((id) => (id === row.company_id ? null : row.company_id))
              }
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">
                  {row.brand}
                </p>
                <p className="text-[11px] text-slate-500">
                  {kindAccountLabel(row.kind)}
                  {row.summary.pending_zar > 0
                    ? ` · ${formatZar(row.summary.pending_zar)} proof sent`
                    : ''}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-black ${
                  due > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {due > 0 ? `${formatZar(due)} due` : 'Settled'}
              </span>
            </button>
            {expanded ? (
              <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                <ul className="space-y-1.5">
                  {row.charges.filter((c) => c.status !== 'void').length === 0 ? (
                    <li className="text-[12px] text-slate-500">
                      No charges yet from this Advisor.
                    </li>
                  ) : (
                    row.charges
                      .filter((c) => c.status !== 'void')
                      .map((c) => (
                        <li
                          key={c.id}
                          className="flex items-start justify-between gap-2 text-[12px]"
                        >
                          <span className="min-w-0">
                            <span className="font-semibold text-slate-800">
                              {c.description}
                            </span>
                            <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                              {c.status}
                              {c.invoice_number ? ` · ${c.invoice_number}` : ''}
                            </span>
                          </span>
                          <span className="shrink-0 font-bold">
                            {formatZar(c.amount_zar)}
                          </span>
                        </li>
                      ))
                  )}
                </ul>
                {open.length > 0 ? (
                  <>
                    <button
                      type="button"
                      disabled={busy === `pay-${row.company_id}`}
                      onClick={() => void pay(row)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0077b6] px-3 py-2.5 text-sm font-black text-white disabled:opacity-50"
                    >
                      {busy === `pay-${row.company_id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Banknote className="h-4 w-4" />
                      )}
                      Pay {formatZar(due)}
                    </button>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] font-black text-slate-700">
                        Or send proof of payment
                      </p>
                      <input
                        className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                        placeholder="Bank reference"
                        value={pop[row.company_id]?.reference || ''}
                        onChange={(e) =>
                          setPop((p) => ({
                            ...p,
                            [row.company_id]: {
                              reference: e.target.value,
                              notes: p[row.company_id]?.notes || '',
                              file: p[row.company_id]?.file || null,
                            },
                          }))
                        }
                      />
                      <input
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                        placeholder="Note (optional)"
                        value={pop[row.company_id]?.notes || ''}
                        onChange={(e) =>
                          setPop((p) => ({
                            ...p,
                            [row.company_id]: {
                              reference: p[row.company_id]?.reference || '',
                              notes: e.target.value,
                              file: p[row.company_id]?.file || null,
                            },
                          }))
                        }
                      />
                      <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-600">
                        <Upload className="h-3.5 w-3.5" />
                        {pop[row.company_id]?.file?.name || 'Attach slip / screenshot'}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) =>
                            setPop((p) => ({
                              ...p,
                              [row.company_id]: {
                                reference: p[row.company_id]?.reference || '',
                                notes: p[row.company_id]?.notes || '',
                                file: e.target.files?.[0] || null,
                              },
                            }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy === `pop-${row.company_id}`}
                        onClick={() => void sendPop(row)}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-black text-slate-800 disabled:opacity-50"
                      >
                        {busy === `pop-${row.company_id}`
                          ? 'Sending…'
                          : 'Send proof to Advisor'}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
