'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney, statusClass, type TaxRate } from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

export default function TaxPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [summary, setSummary] = useState<{
    outputVat: number;
    inputVat: number;
    netVat: number;
    invoiceCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    rate: '15',
    tax_type: 'vat',
    is_default: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/tax?${params}`);
      const data = await res.json();
      setRates(data.rates || []);
      setSummary(data.summary || null);
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch {
      setRates([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function seed() {
    try {
      const res = await fetch('/api/accounting/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, seed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.seeded ? `Seeded ${data.seeded} rates` : data.message || 'Done');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          code: form.code,
          name: form.name,
          rate: Number(form.rate),
          tax_type: form.tax_type,
          is_default: form.is_default,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Tax rate created');
      setShowModal(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountingPage>
      <AccountingHeader
        title="Tax &"
        titleAccent="compliance"
        description="Configure VAT and tax codes. Output/input summary is derived from non-draft invoices."
        action={
          <>
            <button type="button" onClick={() => void seed()} className="btn-secondary !py-2.5 !px-5 text-sm">
              <Sparkles className="w-4 h-4" /> Seed ZA VAT
            </button>
            <button type="button" onClick={() => setShowModal(true)} className="btn-primary !py-2.5 !px-5 text-sm">
              <Plus className="w-4 h-4" /> Add rate
            </button>
          </>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Output VAT</div>
            <div className="text-xl font-black tabular-nums">{formatMoney(summary.outputVat)}</div>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Input VAT</div>
            <div className="text-xl font-black tabular-nums">{formatMoney(summary.inputVat)}</div>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Net VAT</div>
            <div className="text-xl font-black tabular-nums text-[#0077b6]">
              {formatMoney(summary.netVat)}
            </div>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Invoices</div>
            <div className="text-xl font-black tabular-nums">{summary.invoiceCount}</div>
          </div>
        </div>
      )}

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : rates.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-neutral-500">
            No tax rates. Seed standard ZA VAT (15% / 0% / exempt) or add custom codes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold text-right">Rate</th>
                  <th className="px-4 py-3 font-semibold">Default</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {rates.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{r.code}</td>
                    <td className="px-4 py-3 text-slate-800">{r.name}</td>
                    <td className="px-4 py-3 text-neutral-500">{r.tax_type}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{r.rate}%</td>
                    <td className="px-4 py-3">{r.is_default ? 'Yes' : '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(String(r.status || 'active'))}`}
                      >
                        {r.status || 'active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold">New tax rate</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-neutral-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={create} className="p-5 space-y-3">
              <label className="block text-xs font-semibold text-neutral-600">
                Code
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Rate %
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Default rate
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AccountingPage>
  );
}
