'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import { type PartyBookRole, type PartyRoleRow } from '@/lib/accounting/party-roles';

export default function AccountingPartiesPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [rows, setRows] = useState<PartyRoleRow[]>([]);
  const [counts, setCounts] = useState({ customers: 0, suppliers: 0, both: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | PartyBookRole>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/accounting/parties?companyId=${companyId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRows(data.parties || []);
      setCounts(data.counts || { customers: 0, suppliers: 0, both: 0 });
      if (data.warning) toast.message(data.warning);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (role !== 'all' && r.role !== role) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        String(r.ar_account_code || '').toLowerCase().includes(needle) ||
        String(r.ap_account_code || '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, role]);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Customers &"
        titleAccent="suppliers"
        description="Who you sell to lives on Customers (AR). Who you buy from lives on Suppliers (AP). The same firm can be both — they get two unique accounts and you never net them."
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <button
          type="button"
          onClick={() => setRole(role === 'customer' ? 'all' : 'customer')}
          className={`rounded-2xl border px-4 py-3 text-left ${
            role === 'customer' ? 'border-[#00b4d8] bg-sky-50' : 'border-neutral-200 bg-white'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
            Customers · you sell
          </div>
          <div className="text-xl font-bold text-slate-900">{counts.customers}</div>
        </button>
        <button
          type="button"
          onClick={() => setRole(role === 'supplier' ? 'all' : 'supplier')}
          className={`rounded-2xl border px-4 py-3 text-left ${
            role === 'supplier' ? 'border-[#00b4d8] bg-sky-50' : 'border-neutral-200 bg-white'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
            Suppliers · you buy
          </div>
          <div className="text-xl font-bold text-slate-900">{counts.suppliers}</div>
        </button>
        <button
          type="button"
          onClick={() => setRole(role === 'both' ? 'all' : 'both')}
          className={`rounded-2xl border px-4 py-3 text-left ${
            role === 'both' ? 'border-[#00b4d8] bg-sky-50' : 'border-neutral-200 bg-white'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
            Both books
          </div>
          <div className="text-xl font-bold text-slate-900">{counts.both}</div>
        </button>
      </div>

      <p className="text-sm text-neutral-600 mb-4 leading-relaxed">
        Add someone you invoice under{' '}
        <Link href="/dashboard/customers/onboard" className="font-bold text-[#0077b6] underline">
          Customers
        </Link>
        . Add someone you pay under{' '}
        <Link href="/dashboard/suppliers/add" className="font-bold text-[#0077b6] underline">
          Suppliers
        </Link>
        . If they trade both ways, keep them on both books — AR and AP stay separate.
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or account number…"
          className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-neutral-200 text-sm"
        />
      </div>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-neutral-500">
            <Users className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
            No parties on the books yet. Onboard a customer or add a supplier.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">AR account</th>
                  <th className="px-4 py-3 font-semibold">AP account</th>
                  <th className="px-4 py-3 font-semibold text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {visible.map((r) => (
                  <tr key={r.key} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.name}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={r.role} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.ar_account_code || (r.customer_id ? '—' : '')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.ap_account_code || (r.supplier_id ? '—' : '')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        {r.customer_id ? (
                          <Link
                            href="/dashboard/customers/profiles"
                            className="text-xs font-semibold text-[#0077b6] hover:underline"
                          >
                            Customer
                          </Link>
                        ) : null}
                        {r.supplier_id ? (
                          <Link
                            href={`/dashboard/suppliers/network?id=${r.supplier_id}`}
                            className="text-xs font-semibold text-[#0077b6] hover:underline"
                          >
                            Supplier
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AccountingPage>
  );
}

function RoleBadge({ role }: { role: PartyBookRole }) {
  const cls =
    role === 'both'
      ? 'bg-violet-50 text-violet-800 border-violet-100'
      : role === 'supplier'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
        : 'bg-sky-50 text-sky-800 border-sky-100';
  const label =
    role === 'both'
      ? 'Customer + supplier'
      : role === 'supplier'
        ? 'Supplier · buy'
        : 'Customer · sell';
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}
    >
      {label}
    </span>
  );
}
