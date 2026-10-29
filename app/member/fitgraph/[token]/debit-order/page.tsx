'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { SA_DEBIT_BANKS } from '@/lib/fitness/member-debit-bank';
import { consentText } from '@/lib/fitness/netcash/validate';

const field = 'mt-1 w-full min-h-11 rounded-2xl border border-slate-200 px-3 text-sm';

export default function MemberDebitOrderPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || '');
  const [bank, setBank] = useState('Standard Bank');
  const [branch, setBranch] = useState('051001');
  const [holder, setHolder] = useState('');
  const [account, setAccount] = useState('');
  const [accountType, setAccountType] = useState('cheque');
  const [debitDay, setDebitDay] = useState('1');
  const [amount, setAmount] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const consent = consentText('this gym');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const rands = Number(String(amount).replace(/[^\d.]/g, ''));
    const response = await fetch('/api/public/fitgraph/debit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        accountHolder: holder,
        bankName: bank,
        branchCode: branch,
        accountNumber: account,
        accountType,
        debitDay: Number(debitDay),
        amountCents: Math.round(rands * 100),
        accepted,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; mandate?: { accountNumberMasked?: string; status?: string } };
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error || 'The mandate was not saved.');
      return;
    }
    setAccount('');
    setMessage(`Mandate ${data.mandate?.status || 'saved'} for ${data.mandate?.accountNumberMasked || 'your account'}.`);
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 text-[#0f172a]">
      <form onSubmit={(event) => void submit(event)} className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">GymAdvisor® · SupplierAdvisor®</p>
        <h1 className="mt-1 text-2xl font-black">Debit order mandate</h1>
        <p className="mt-2 text-sm text-slate-600">Sign the bank account this gym may debit. The full account number is sealed and is not shown again.</p>
        <label className="mt-4 block text-sm font-bold">Account holder
          <input className={field} value={holder} onChange={(event) => setHolder(event.target.value)} required />
        </label>
        <label className="mt-3 block text-sm font-bold">Bank
          <select className={field} value={bank} onChange={(event) => {
            const next = event.target.value;
            setBank(next);
            const match = SA_DEBIT_BANKS.find((item) => item.name === next);
            if (match?.branch_code) setBranch(match.branch_code);
          }}>
            {SA_DEBIT_BANKS.map((item) => <option key={item.name}>{item.name}</option>)}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm font-bold">Branch
            <input className={field} value={branch} onChange={(event) => setBranch(event.target.value)} inputMode="numeric" />
          </label>
          <label className="text-sm font-bold">Account type
            <select className={field} value={accountType} onChange={(event) => setAccountType(event.target.value)}>
              <option value="cheque">Cheque</option>
              <option value="savings">Savings</option>
              <option value="transmission">Transmission</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm font-bold">Account number
          <input className={field} value={account} onChange={(event) => setAccount(event.target.value)} inputMode="numeric" autoComplete="off" required />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm font-bold">Debit day
            <input className={field} value={debitDay} onChange={(event) => setDebitDay(event.target.value)} inputMode="numeric" />
          </label>
          <label className="text-sm font-bold">Amount (rand)
            <input className={field} value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
          </label>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>{consent}</span>
        </label>
        <button type="submit" disabled={busy} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#00b4d8] text-sm font-black text-[#0f172a] disabled:opacity-60">
          {busy ? 'Saving…' : 'Sign mandate'}
        </button>
        {message ? <p className="mt-3 text-sm font-bold">{message}</p> : null}
      </form>
    </main>
  );
}
