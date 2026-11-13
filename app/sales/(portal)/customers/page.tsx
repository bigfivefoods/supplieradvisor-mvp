'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import type { CustomerRecord } from '@/lib/customers/types';

export default function SalesCustomersPage() {
  const companyId = getSelectedCompanyId();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    trading_name: '',
    contact_name: '',
    email: '',
    phone: '',
    city: '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (q) params.set('q', q);
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCustomers(data.customers || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [companyId, q, privyUserId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const save = async () => {
    if (!form.trading_name.trim() || !companyId) {
      toast.error('Trading name required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          ...form,
          sales_rep_user_id: privyUserId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Customer saved under your company');
      setShowForm(false);
      setForm({
        trading_name: '',
        contact_name: '',
        email: '',
        phone: '',
        city: '',
        notes: '',
      });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) {
    return (
      <p className="text-center text-neutral-500 py-16">Select a company first.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-amber-600" />
            Customers
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Company-owned accounts · managed only in this sales portal
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white text-sm font-bold"
        >
          <Plus className="w-4 h-4" /> Add customer
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          className="w-full rounded-2xl bg-white/80 border border-neutral-200 pl-11 pr-4 py-3 text-slate-900 text-sm placeholder:text-neutral-500"
          placeholder="Search customers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {showForm && (
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 space-y-3">
          <h2 className="font-bold text-slate-900">New customer</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {(
              [
                ['trading_name', 'Trading name *'],
                ['contact_name', 'Contact name'],
                ['email', 'Email'],
                ['phone', 'Phone'],
                ['city', 'City'],
              ] as const
            ).map(([key, ph]) => (
              <input
                key={key}
                className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
                placeholder={ph}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            ))}
          </div>
          <textarea
            className="w-full rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm min-h-[64px]"
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-2xl border border-neutral-200 text-slate-700 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save customer'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 text-sm space-y-3">
            <p>No customers yet.</p>
            <Link href="/sales/pipeline" className="text-amber-600 font-semibold text-sm">
              Start from a lead →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {customers.map((c) => (
              <li
                key={c.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {c.trading_name || c.legal_name || 'Customer'}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {c.contact_name || '—'} · {c.email || c.phone || 'No contact'}
                    {c.city ? ` · ${c.city}` : ''}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                  {c.status || 'active'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
