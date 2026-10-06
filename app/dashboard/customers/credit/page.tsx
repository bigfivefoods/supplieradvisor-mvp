'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { apiFetch } from '@/lib/client/api-fetch';

type CreditListRow = {
  id: number;
  reference: string | null;
  customer_name: string;
  requested_limit: number | null;
  requested_terms: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function CustomerCreditDeskPage() {
  const companyId = getSelectedCompanyId();
  const { getAccessToken, user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [rows, setRows] = useState<CreditListRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      const res = await apiFetch(`/api/customers/credit-applications?${params.toString()}`, {
        method: 'GET',
        companyId,
        accessToken,
        privyUserId,
      });
      const json = (await res.json()) as { error?: string; applications?: CreditListRow[]; counts?: Record<string, number> };
      if (!res.ok) throw new Error(json.error || 'Could not load credit applications');
      setRows(json.applications || []);
      setCounts(json.counts || {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load credit applications');
    } finally {
      setLoading(false);
    }
  }, [companyId, getAccessToken, privyUserId, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const statuses = useMemo(
    () => ['', 'draft', 'submitted', 'under_review', 'more_info_needed', 'approved', 'declined'],
    []
  );

  return (
    <CompanyRequired>
      <CustomersPage>
        <CustomersHeader
          title="Customer"
          titleAccent="credit"
          description="Review customer credit applications, request more information, and approve or decline with policy terms."
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {statuses.map((s) => (
            <button
              key={s || 'all'}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === s ? 'bg-[#0077b6] text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => setStatus(s)}
            >
              {(s || 'all').replace(/_/g, ' ')} ({counts[s || 'total'] || 0})
            </button>
          ))}
          <input
            className="input ml-auto w-full max-w-sm"
            placeholder="Search name, reference or registration"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>No credit applications yet.</td></tr>
              ) : (
                rows.map((row) => {
                  const submitted = row.submitted_at ? String(row.submitted_at).slice(0, 10) : '—';
                  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000));
                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold">{row.reference || `CA-${row.id}`}</td>
                      <td className="px-4 py-3">{row.customer_name}</td>
                      <td className="px-4 py-3">
                        {(row.requested_limit || 0).toLocaleString()} · {row.requested_terms || '—'}
                      </td>
                      <td className="px-4 py-3">{row.status.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">{submitted}</td>
                      <td className="px-4 py-3">{ageDays}d</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/dashboard/customers/credit/${row.id}`} className="text-[#0077b6] font-semibold hover:underline">Open</Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CustomersPage>
    </CompanyRequired>
  );
}
