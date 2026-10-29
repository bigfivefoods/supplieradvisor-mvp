'use client';

import { useState } from 'react';
import { SA_DEBIT_BANKS } from '@/lib/fitness/member-debit-bank';
import { consentText } from '@/lib/fitness/netcash/validate';
import { formatZar } from '@/lib/fitness/netcash/money';

const field = 'mt-1 w-full min-h-11 rounded-2xl border border-slate-200 px-3 text-sm text-[#0f172a]';

export function MemberMandateCard({
  gymName = 'Harbour Athletic',
  preview = false,
}: {
  gymName?: string;
  preview?: boolean;
}) {
  const [bank, setBank] = useState('Standard Bank');
  const [branch, setBranch] = useState('051001');
  const [signed, setSigned] = useState(preview);
  const consent = consentText(gymName);
  return (
    <form className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-4 sm:p-6" onSubmit={(event) => event.preventDefault()}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">GymAdvisor® · SupplierAdvisor®</p>
      <h1 className="mt-1 text-2xl font-black text-[#0f172a]">Debit order mandate</h1>
      <p className="mt-2 text-sm text-slate-600">{gymName} collects the invoiced membership through Netcash. Test mode does not move money.</p>
      <label className="mt-4 block text-sm font-bold">Account holder
        <input className={field} defaultValue="Amahle Nkosi" readOnly={preview} />
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
          <select className={field} defaultValue="cheque">
            <option value="cheque">Cheque</option>
            <option value="savings">Savings</option>
            <option value="transmission">Transmission</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block text-sm font-bold">Account number
        <input className={field} defaultValue="" placeholder="Account number" inputMode="numeric" autoComplete="off" readOnly={preview} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm font-bold">Debit day
          <input className={field} defaultValue="1" inputMode="numeric" />
        </label>
        <label className="text-sm font-bold">Amount
          <input className={field} defaultValue={formatZar(89000)} readOnly />
        </label>
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={signed} onChange={(event) => setSigned(event.target.checked)} />
        <span>{consent}</span>
      </label>
      <button type="submit" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#00b4d8] text-sm font-black text-[#0f172a]">
        {signed ? 'Sign mandate' : 'Tick the consent to sign'}
      </button>
      {preview && signed ? <p className="mt-3 text-sm font-bold text-[#0f172a]">Sample signature · 2 Oct 2026 · 10:12 SAST · IP recorded with the mandate.</p> : null}
    </form>
  );
}
