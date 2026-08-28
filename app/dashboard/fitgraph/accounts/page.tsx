'use client';

import { toast } from 'sonner';
import { FitgraphWorkbench, useFitgraph } from '@/components/fitness/FitgraphWorkbench';
import { AdvisorMemberAccounts } from '@/components/advisors/AdvisorMemberAccounts';
import {
  gymCollectsDebitBank,
  maskAccountNumber,
  memberDebitBankComplete,
} from '@/lib/fitness/member-debit-bank';

export default function FitgraphAccountsPage() {
  const { store } = useFitgraph();
  const collect = store ? gymCollectsDebitBank(store) : false;
  const rows = (store?.clients || []).filter((c) => c.active !== false);
  const ready = rows.filter((c) => memberDebitBankComplete(c));
  const missing = rows.filter((c) => !memberDebitBankComplete(c));

  const copyLine = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  return (
    <FitgraphWorkbench
      title="Member accounts"
      titleAccent="pay & proof"
      description="Search a member or private client, raise a charge on their account, and allocate cash or EFT against it. People who leave stay on the list so history is kept. Members see the same statements under You → History."
    >
      {collect ? (
        <div className="mb-6 rounded-2xl border border-yellow-200 bg-white p-4 space-y-3 dark:border-yellow-700 dark:bg-yellow-950/30">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Debit orders
            </p>
            <p className="text-sm font-black">
              {ready.length} bank details on file · {missing.length} still
              needed
            </p>
            <p className="text-[11px] text-slate-500">
              Members submit these on their profile. You set up the debit
              order at your bank — this is not Apple Pay or Paystack.
            </p>
          </div>
          {ready.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-2 font-black uppercase text-[10px]">
                      Member
                    </th>
                    <th className="py-1 pr-2 font-black uppercase text-[10px]">
                      Bank
                    </th>
                    <th className="py-1 pr-2 font-black uppercase text-[10px]">
                      Account
                    </th>
                    <th className="py-1 pr-2 font-black uppercase text-[10px]">
                      Branch
                    </th>
                    <th className="py-1 font-black uppercase text-[10px]">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ready.map((c) => {
                    const b = c.debit_bank!;
                    const line = [
                      c.name,
                      b.account_holder,
                      b.bank_name,
                      b.account_number,
                      b.branch_code,
                      b.account_type,
                    ].join(' · ');
                    return (
                      <tr key={c.id} className="border-t border-slate-200/50">
                        <td className="py-1.5 pr-2 font-bold">
                          {c.name}
                          <span className="block text-[10px] font-normal text-slate-400">
                            {b.account_holder}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2">{b.bank_name}</td>
                        <td className="py-1.5 pr-2">
                          <button
                            type="button"
                            className="font-mono underline"
                            onClick={() => void copyLine(line)}
                            title="Copy debit-order line"
                          >
                            {b.account_number}
                          </button>
                          <span className="ml-1 text-[10px] text-slate-400">
                            {maskAccountNumber(b.account_number)}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 font-mono">
                          {b.branch_code}
                        </td>
                        <td className="py-1.5">{b.account_type}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No debit-order bank details submitted yet.
            </p>
          )}
        </div>
      ) : null}
      <AdvisorMemberAccounts module="fitgraph" />
    </FitgraphWorkbench>
  );
}
