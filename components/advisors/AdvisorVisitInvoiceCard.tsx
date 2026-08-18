'use client';

/**
 * Raise a visit / hire invoice from an Advisor calendar appointment.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import {
  formatZar,
  type AdvisorAccountModule,
} from '@/lib/b2c/member-account-types';

export function AdvisorVisitInvoiceCard({
  companyId,
  module,
  refId,
  memberName,
  memberEmail,
  description,
  amountZar,
  dueDate,
  sourceId,
  accountsHref,
  accentClass = 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20',
  btnClass = 'bg-amber-700 hover:bg-amber-800',
}: {
  companyId: number;
  module: AdvisorAccountModule;
  refId: string;
  memberName: string;
  memberEmail?: string | null;
  description: string;
  amountZar: number;
  dueDate?: string | null;
  sourceId: string;
  accountsHref: string;
  accentClass?: string;
  btnClass?: string;
}) {
  const [desc, setDesc] = useState(description);
  const [amount, setAmount] = useState(
    amountZar > 0 ? String(amountZar) : ''
  );
  const [due, setDue] = useState(dueDate || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const send = async () => {
    const n = Number(amount);
    if (!refId || !desc.trim() || !(n > 0)) {
      toast.error('Need a person, description and amount');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/advisors/member-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          module,
          action: 'raise',
          ref_id: refId,
          member_name: memberName,
          member_email: memberEmail || null,
          description: desc.trim(),
          amount_zar: n,
          due_date: due || dueDate || null,
          source: 'visit',
          source_id: sourceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invoice failed');
      const num = data.charge?.invoice_number
        ? String(data.charge.invoice_number)
        : 'created';
      setDone(num);
      toast.success(data.message || 'Invoice sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invoice failed');
    } finally {
      setBusy(false);
    }
  };

  const inp =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';

  return (
    <div className={`rounded-2xl border px-4 py-3 space-y-2 ${accentClass}`}>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          After the appointment
        </p>
        <p className="text-sm font-black text-slate-900 dark:text-white">
          Send invoice · {memberName}
        </p>
      </div>
      <input
        className={inp}
        placeholder="Description"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] font-black uppercase text-slate-400">
          Amount (ZAR)
          <input
            className={inp + ' mt-0.5'}
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="text-[10px] font-black uppercase text-slate-400">
          Due
          <input
            className={inp + ' mt-0.5'}
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
      </div>
      {done ? (
        <p className="text-[12px] font-bold text-emerald-700">
          Invoice {done === 'created' ? 'raised' : done}
          {Number(amount) > 0 ? ` · ${formatZar(Number(amount))}` : ''}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void send()}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-white disabled:opacity-50 ${btnClass}`}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Receipt className="h-3.5 w-3.5" />
          )}
          Send invoice
        </button>
        <Link
          href={accountsHref}
          className="text-[11px] font-bold text-slate-500 underline"
        >
          Open accounts
        </Link>
      </div>
    </div>
  );
}
