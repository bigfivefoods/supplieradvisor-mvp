'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import {
  formatZar,
  kindAccountLabel,
  type AdvisorAccountModule,
  type MemberAccountCharge,
  type MemberAccountPayment,
  type MemberAccountSuggestion,
} from '@/lib/b2c/member-account-types';

type MemberOpt = { ref_id: string; name: string; email?: string | null };

export function AdvisorMemberAccounts({
  module,
}: {
  module: AdvisorAccountModule;
}) {
  const { companyId, withAuthJson } = useApiAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [charges, setCharges] = useState<MemberAccountCharge[]>([]);
  const [payments, setPayments] = useState<MemberAccountPayment[]>([]);
  const [suggestions, setSuggestions] = useState<MemberAccountSuggestion[]>([]);
  const [members, setMembers] = useState<MemberOpt[]>([]);
  const [kpis, setKpis] = useState({
    open_zar: 0,
    pending_zar: 0,
    paid_zar: 0,
    pending_pops: 0,
  });
  const [filter, setFilter] = useState('open');
  const [form, setForm] = useState({
    ref_id: '',
    description: '',
    amount_zar: '',
    due_date: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{
      charges?: MemberAccountCharge[];
      payments?: MemberAccountPayment[];
      suggestions?: MemberAccountSuggestion[];
      members?: MemberOpt[];
      kpis?: typeof kpis;
    }>(
      `/api/advisors/member-accounts?companyId=${companyId}&module=${module}`
    );
    setCharges(data.charges || []);
    setPayments(data.payments || []);
    setSuggestions(data.suggestions || []);
    setMembers(data.members || []);
    if (data.kpis) setKpis(data.kpis);
  }, [companyId, module, withAuthJson]);

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

  const act = async (body: Record<string, unknown>) => {
    if (!companyId) return;
    setBusy(true);
    try {
      const data = await withAuthJson<{ message?: string }>('/api/advisors/member-accounts', {
        method: 'POST',
        jsonBody: { companyId, module, ...body },
      });
      toast.success(data.message || 'Saved');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(() => {
    if (filter === 'all') return charges;
    if (filter === 'pending') return charges.filter((c) => c.status === 'pending_pop');
    if (filter === 'paid') return charges.filter((c) => c.status === 'paid');
    return charges.filter((c) => c.status === 'open');
  }, [charges, filter]);

  const pendingPops = payments.filter(
    (p) => p.status === 'pending' && p.method === 'pop'
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Open" value={formatZar(kpis.open_zar)} />
        <Kpi label="Proof waiting" value={formatZar(kpis.pending_zar)} />
        <Kpi label="Paid" value={formatZar(kpis.paid_zar)} />
      </div>

      {pendingPops.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <h3 className="text-sm font-black text-amber-950">
            Proof of payment to confirm
          </h3>
          <ul className="mt-3 space-y-2">
            {pendingPops.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">
                    {p.member_name || 'Member'} · {formatZar(p.amount_zar)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {p.reference ? `Ref ${p.reference}` : 'No bank reference'}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </p>
                </div>
                {p.proof_url ? (
                  <a
                    href={p.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-sky-700"
                  >
                    View proof
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act({ action: 'confirm_pop', payment_id: p.id })}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-black text-white"
                >
                  <Check className="h-3.5 w-3.5" /> Confirm
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act({ action: 'reject_pop', payment_id: p.id })}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-black text-slate-900">Raise a charge</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Adds a line to the member’s {kindAccountLabel(MODULE_KIND[module])} and
          an invoice in Customers → Invoices.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.ref_id}
            onChange={(e) => setForm((f) => ({ ...f, ref_id: e.target.value }))}
          >
            <option value="">Select member</option>
            {members.map((m) => (
              <option key={m.ref_id} value={m.ref_id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Description (e.g. April membership)"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Amount ZAR"
            inputMode="decimal"
            value={form.amount_zar}
            onChange={(e) =>
              setForm((f) => ({ ...f, amount_zar: e.target.value }))
            }
          />
          <input
            type="date"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void act({
              action: 'raise',
              ref_id: form.ref_id,
              description: form.description,
              amount_zar: Number(form.amount_zar),
              due_date: form.due_date || null,
            })
          }
          className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
        >
          Add to account
        </button>
      </section>

      {suggestions.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900">
              Unbilled visits / fees ({suggestions.length})
            </h3>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act({ action: 'bill_all_suggestions' })}
              className="text-xs font-black text-sky-800"
            >
              Bill all
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {suggestions.slice(0, 12).map((s) => (
              <li
                key={s.source_id}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">
                    {s.member_name} · {s.description}
                  </p>
                </div>
                <span className="text-xs font-bold">{formatZar(s.amount_zar)}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act({ action: 'bill_suggestion', source_id: s.source_id })
                  }
                  className="text-xs font-black text-sky-800"
                >
                  Bill
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex flex-wrap gap-2">
          {(['open', 'pending', 'paid', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-[11px] font-black capitalize ${
                filter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {shown.length === 0 ? (
            <li className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No charges in this view
            </li>
          ) : (
            shown.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">
                    {c.member_name} · {c.description}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {c.invoice_number || 'No invoice yet'} · {c.status}
                    {c.due_date ? ` · due ${c.due_date}` : ''}
                  </p>
                </div>
                <span className="text-sm font-black">{formatZar(c.amount_zar)}</span>
                {c.status === 'open' || c.status === 'pending_pop' ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act({ action: 'record_cash', charge_id: c.id })
                      }
                      className="text-[11px] font-black text-emerald-800"
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act({ action: 'void', charge_id: c.id })}
                      className="text-[11px] font-bold text-slate-400"
                    >
                      Void
                    </button>
                  </>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

const MODULE_KIND: Record<AdvisorAccountModule, string> = {
  fitgraph: 'gym',
  physiograph: 'physio',
  dentalgraph: 'dental',
  medicalgraph: 'medical',
  psychiatrygraph: 'psychiatry',
  hiregraph: 'hire',
};

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}
