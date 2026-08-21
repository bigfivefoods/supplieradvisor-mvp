'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  AccountingStat,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { ChartCard, MixDoughnut } from '@/components/accounting/AccountingCharts';

type Line = {
  member_name: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  amount_zar: number;
  reference: string;
  plan_name?: string;
};

export default function DebitOrdersPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [lines, setLines] = useState<Line[]>([]);
  const [missing, setMissing] = useState<Array<{ id: string; name: string }>>([]);
  const [vat, setVat] = useState<{ exclusive: number; vat: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/core/debit-batch?companyId=${companyId}`);
      const data = await res.json();
      setLines(data.lines || []);
      setMissing(data.missing || []);
      setVat(data.vat_sample || null);
    } catch {
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = lines.reduce((s, l) => s + Number(l.amount_zar || 0), 0);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Debit"
        titleAccent="orders"
        description="Member debit-order file. Amounts are VAT-inclusive. Export CSV, then match the same reference on bank rec."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <a
              href={`/api/core/debit-batch?companyId=${companyId}&download=1`}
              className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-4">
        <AccountingStat label="Members" value={String(lines.length)} />
        <AccountingStat label="Batch total" value={formatMoney(total)} />
        <AccountingStat
          label="VAT (sample)"
          value={vat ? formatMoney(vat.vat) : '—'}
        />
        <AccountingStat
          label="Missing bank"
          value={String(missing.length)}
          warn={missing.length > 0}
        />
      </div>
      {lines.length > 0 ? (
        <div className="mb-4 print:hidden">
          <ChartCard title="By plan" subtitle="Debit amount mix" height={240}>
            <MixDoughnut
              segments={Array.from(
                lines.reduce((m, l) => {
                  const k = String(l.plan_name || 'Plan');
                  m.set(k, (m.get(k) || 0) + Number(l.amount_zar || 0));
                  return m;
                }, new Map<string, number>())
              ).map(([label, value]) => ({ label, value }))}
              centerLabel="Batch"
              centerValue={formatMoney(total)}
            />
          </ChartCard>
        </div>
      ) : null}
      {missing.length ? (
        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {missing.length} member{missing.length === 1 ? '' : 's'} still need debit
          bank details:{' '}
          {missing
            .slice(0, 8)
            .map((m) => m.name)
            .join(', ')}
        </div>
      ) : null}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">Bank</th>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((l) => (
                <tr key={l.reference}>
                  <td className="px-4 py-2">
                    <div className="font-semibold">{l.member_name}</div>
                    <div className="text-[11px] text-slate-500">{l.plan_name}</div>
                  </td>
                  <td className="px-4 py-2">
                    {l.bank_name} · {l.branch_code}
                  </td>
                  <td className="px-4 py-2 font-mono text-[12px]">{l.account_number}</td>
                  <td className="px-4 py-2 font-mono text-[12px]">{l.reference}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-bold">
                    {formatMoney(l.amount_zar)}
                  </td>
                </tr>
              ))}
              {!lines.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No authorised debit-order members this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </AccountingPage>
  );
}
