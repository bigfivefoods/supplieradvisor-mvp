'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Nfc, X } from 'lucide-react';
import { TillPresentPay } from '@/components/till/TillPresentPay';
import { AdvisorPayoutSettings } from '@/components/advisors/AdvisorPayoutSettings';
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

type MemberOpt = {
  ref_id: string;
  name: string;
  email?: string | null;
  group?: 'member' | 'private' | 'left';
  private_client?: boolean;
  membership?: boolean;
  active?: boolean;
  status?: string | null;
};

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
  const [tillChargeIds, setTillChargeIds] = useState<string[]>([]);
  const [presentTill, setPresentTill] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'eft'>('eft');
  const [payRef, setPayRef] = useState('');
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
    if (!companyId) return false;
    setBusy(true);
    try {
      const data = await withAuthJson<{ message?: string }>('/api/advisors/member-accounts', {
        method: 'POST',
        jsonBody: { companyId, module, ...body },
      });
      toast.success(data.message || 'Saved');
      await load();
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const selected = members.find((m) => m.ref_id === selectedRef) || null;

  const peopleHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? members.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            String(m.email || '')
              .toLowerCase()
              .includes(q)
        )
      : members;
    const groups: Record<'member' | 'private' | 'left', MemberOpt[]> = {
      member: [],
      private: [],
      left: [],
    };
    for (const m of rows) {
      const g = m.group || 'member';
      groups[g].push(m);
    }
    return groups;
  }, [members, query]);

  const personCharges = useMemo(() => {
    if (!selectedRef) return charges;
    return charges.filter((c) => c.ref_id === selectedRef);
  }, [charges, selectedRef]);

  const personPayments = useMemo(() => {
    if (!selectedRef) return payments;
    const ids = new Set(personCharges.map((c) => c.id));
    return payments.filter(
      (p) =>
        p.ref_id === selectedRef ||
        (p.charge_ids || []).some((id) => ids.has(id))
    );
  }, [payments, personCharges, selectedRef]);

  const shown = useMemo(() => {
    if (filter === 'all') return personCharges;
    if (filter === 'pending')
      return personCharges.filter((c) => c.status === 'pending_pop');
    if (filter === 'paid') return personCharges.filter((c) => c.status === 'paid');
    return personCharges.filter((c) => c.status === 'open');
  }, [personCharges, filter]);

  const personSuggestions = useMemo(
    () =>
      selectedRef
        ? suggestions.filter((s) => s.ref_id === selectedRef)
        : suggestions,
    [suggestions, selectedRef]
  );

  const pendingPops = payments.filter(
    (p) => p.status === 'pending' && p.method === 'pop'
  );

  const tillCharges = shown.filter(
    (c) => tillChargeIds.includes(c.id) && c.status === 'open'
  );
  const tillAmount = tillCharges.reduce(
    (n, c) => n + (Number(c.amount_zar) || 0),
    0
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
      <AdvisorPayoutSettings />
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

      {tillCharges.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
          <p className="text-sm font-bold text-orange-950">
            {tillCharges.length} bill{tillCharges.length === 1 ? '' : 's'} ·{' '}
            {formatZar(tillAmount)}
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-xl bg-orange-600 px-3 py-2 text-xs font-black text-white"
            onClick={() => setPresentTill(true)}
          >
            <Nfc className="h-3.5 w-3.5" /> Present QR / NFC
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-black text-slate-900">Accounts</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {members.length} people · members, private clients, and people who
            left stay on file.
          </p>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-2 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {(
              [
                ['member', 'Members'],
                ['private', 'Private'],
                ['left', 'Left'],
              ] as const
            ).map(([g, label]) =>
              peopleHits[g].length ? (
                <div key={g}>
                  <p className="px-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                    {label} · {peopleHits[g].length}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {peopleHits[g].map((m) => {
                      const on = selectedRef === m.ref_id;
                      return (
                        <li key={m.ref_id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRef(m.ref_id);
                              setForm((f) => ({ ...f, ref_id: m.ref_id }));
                            }}
                            className={`w-full rounded-xl px-2.5 py-2 text-left text-sm ${
                              on
                                ? 'bg-slate-900 text-white'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <span className="block truncate font-bold">
                              {m.name}
                            </span>
                            <span
                              className={`block truncate text-[10px] ${
                                on ? 'text-white/70' : 'text-slate-500'
                              }`}
                            >
                              {m.private_client && m.membership
                                ? 'Member + private'
                                : m.private_client
                                  ? 'Private client'
                                  : m.email || 'Member'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null
            )}
            {!peopleHits.member.length &&
            !peopleHits.private.length &&
            !peopleHits.left.length ? (
              <p className="px-2 py-6 text-center text-xs text-slate-500">
                No people match that search.
              </p>
            ) : null}
          </div>
        </section>

        <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-black text-slate-900">
          {selected
            ? `Charge · ${selected.name}`
            : 'Raise a charge'}
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Adds a line to the {kindAccountLabel(MODULE_KIND[module])}
          {selected ? ` for ${selected.name}` : ''} and an invoice in Customers
          → Invoices. Select a person on the left first.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
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
          disabled={busy || !selectedRef}
          onClick={() =>
            void act({
              action: 'raise',
              ref_id: selectedRef || form.ref_id,
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

      {selectedRef ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-black text-slate-900">
            Allocate a payment
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Cash or EFT onto this account — covers the oldest open charges that
            the amount can pay in full.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Amount ZAR"
              inputMode="decimal"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={payMethod}
              onChange={(e) =>
                setPayMethod(e.target.value === 'cash' ? 'cash' : 'eft')
              }
            >
              <option value="eft">EFT</option>
              <option value="cash">Cash</option>
            </select>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Bank / receipt ref"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={busy || !Number(payAmount)}
            onClick={() => {
              void act({
                action: 'record_member_payment',
                ref_id: selectedRef,
                amount_zar: Number(payAmount),
                method: payMethod,
                reference: payRef || null,
              }).then((ok) => {
                if (ok) {
                  setPayAmount('');
                  setPayRef('');
                }
              });
            }}
            className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            Allocate to account
          </button>
        </section>
      ) : null}

      {personSuggestions.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900">
              {module === 'fitgraph'
                ? `Unbilled this month (${personSuggestions.length})`
                : `Unbilled visits / fees (${personSuggestions.length})`}
            </h3>
            {!selectedRef ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void act({ action: 'bill_all_suggestions' })}
                className="text-xs font-black text-sky-800"
              >
                Bill all
              </button>
            ) : null}
          </div>
          <ul className="mt-2 space-y-1.5">
            {personSuggestions.slice(0, selectedRef ? 40 : 12).map((s) => (
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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-slate-900">
            {selected ? `Account history · ${selected.name}` : 'Charges'}
          </h3>
        <div className="flex flex-wrap gap-2">
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
                {c.status === 'open' ? (
                  <input
                    type="checkbox"
                    checked={tillChargeIds.includes(c.id)}
                    onChange={() =>
                      setTillChargeIds((ids) =>
                        ids.includes(c.id)
                          ? ids.filter((x) => x !== c.id)
                          : [...ids, c.id]
                      )
                    }
                    aria-label={`Select ${c.description}`}
                  />
                ) : null}
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
        {selectedRef && personPayments.length ? (
          <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
            {personPayments.slice(0, 24).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 text-[12px] text-slate-600"
              >
                <span>
                  {String(p.paid_at || '').slice(0, 10)} ·{' '}
                  {p.method === 'eft' ? 'EFT' : p.method} · {p.status}
                  {p.reference ? ` · ${p.reference}` : ''}
                </span>
                <span className="font-black text-slate-900">
                  {formatZar(p.amount_zar)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
        </div>
      </div>

      {presentTill && tillAmount > 0 ? (
        <TillPresentPay
          module={module}
          kind="bill"
          amountZar={tillAmount}
          label={`Bills · ${tillCharges.length}`}
          chargeIds={tillCharges.map((c) => c.id)}
          onPaid={() => {
            setPresentTill(false);
            setTillChargeIds([]);
            void load();
          }}
          onClose={() => setPresentTill(false)}
        />
      ) : null}
    </div>
  );
}

const MODULE_KIND: Record<AdvisorAccountModule, string> = {
  fitgraph: 'gym',
  physiograph: 'physio',
  dentalgraph: 'dental',
  medicalgraph: 'medical',
  psychiatrygraph: 'psychiatry',
  vetgraph: 'vet',
  hiregraph: 'hire',
  retailgraph: 'retail',
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
