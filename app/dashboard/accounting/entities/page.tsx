'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, X, Star } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { statusClass, type AccountingEntity } from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

export default function EntitiesPage() {
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
  const [entities, setEntities] = useState<AccountingEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    legal_name: '',
    country: 'ZA',
    currency: 'ZAR',
    tax_number: '',
    registration_number: '',
    is_primary: false,
    address: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/entities?${params}`);
      const data = await res.json();
      setEntities(data.entities || []);
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch {
      setEntities([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Entity created');
      setShowModal(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function makePrimary(id: number) {
    try {
      const res = await fetch('/api/accounting/entities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, id, is_primary: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Primary entity updated');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <AccountingPage>
      <AccountingHeader
        title="Legal"
        titleAccent="entities"
        description="Companies, branches, and multi-country entities for multi-entity books."
        action={
          <button type="button" onClick={() => setShowModal(true)} className="btn-primary !py-2.5 !px-5 text-sm">
            <Plus className="w-4 h-4" /> Add entity
          </button>
        }
      />

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : entities.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-neutral-500">
            No entities yet. Seeding the chart of accounts creates a primary HQ entity, or add one here.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {entities.map((e) => (
              <div
                key={e.id}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{e.name}</span>
                    <span className="font-mono text-xs text-neutral-400">{e.code}</span>
                    {e.is_primary && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00b4d8]/10 text-[#0077b6] border border-[#00b4d8]/20">
                        <Star className="w-3 h-3" /> Primary
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(String(e.status || 'active'))}`}
                    >
                      {e.status}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {e.legal_name || e.name}
                    {e.country ? ` · ${e.country}` : ''}
                    {e.currency ? ` · ${e.currency}` : ''}
                    {e.tax_number ? ` · Tax ${e.tax_number}` : ''}
                    {e.registration_number ? ` · Reg ${e.registration_number}` : ''}
                  </div>
                  {e.address && (
                    <div className="text-xs text-neutral-400 mt-0.5">{e.address}</div>
                  )}
                </div>
                {!e.is_primary && (
                  <button
                    type="button"
                    onClick={() => void makePrimary(e.id)}
                    className="btn-secondary !py-2 !px-4 text-xs"
                  >
                    Set primary
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold">New entity</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-neutral-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={create} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  Code
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="HQ"
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Currency
                  <input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
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
                Legal name
                <input
                  value={form.legal_name}
                  onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  Country
                  <input
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Tax number
                  <input
                    value={form.tax_number}
                    onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-neutral-600">
                Registration number
                <input
                  value={form.registration_number}
                  onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <input
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
                />
                Primary entity
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
