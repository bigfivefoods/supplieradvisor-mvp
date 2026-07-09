'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Trash2, GraduationCap, Banknote, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';
import type { ContractorRecord, ContainerRecord } from '@/lib/containers/types';

const TRAINING = ['pending', 'in_progress', 'certified', 'expired'] as const;

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteFor, setInviteFor] = useState<number | null>(null);
  const [inviteContainerId, setInviteContainerId] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    id_number: '',
    training_status: 'pending',
    bank_name: '',
    account_number: '',
  });

  const companyId = getSelectedCompanyId();

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [cRes, oRes] = await Promise.all([
      fetch(`/api/containers/contractors?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/containers?companyId=${companyId}`).then((r) => r.json()),
    ]);
    setContractors(cRes.contractors || []);
    setContainers(oRes.containers || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const appoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !form.full_name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/containers/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          id_number: form.id_number,
          training_status: form.training_status,
          bank_details: {
            bank_name: form.bank_name,
            account_number: form.account_number,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Contractor appointed');
      setForm({
        full_name: '',
        email: '',
        phone: '',
        id_number: '',
        training_status: 'pending',
        bank_name: '',
        account_number: '',
      });
      void load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const updateTraining = async (id: number, training_status: string) => {
    const res = await fetch('/api/containers/contractors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, training_status }),
    });
    if (res.ok) {
      toast.success('Training status updated');
      void load();
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Remove this contractor?')) return;
    await fetch(`/api/containers/contractors?id=${id}`, { method: 'DELETE' });
    void load();
  };

  const sendPortalInvite = async (contractor: ContractorRecord) => {
    if (!companyId || !contractor.email) {
      toast.error('Contractor email is required to invite');
      return;
    }
    if (!inviteContainerId) {
      toast.error('Select a container for this operator');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/containers/contractor-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          containerId: Number(inviteContainerId),
          email: contractor.email,
          full_name: contractor.full_name,
          contractor_id: contractor.id,
          companyName: getSelectedCompanyName(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Invite failed');
      toast.success(data.warning || 'Portal invitation emailed — they must accept the contract');
      if (data.inviteLink) {
        toast.message('Invite link', { description: data.inviteLink });
      }
      setInviteFor(null);
      setInviteContainerId('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) {
    return (
      <div className="text-center py-16">
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">Select company</Link>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto">
      <Link href="/dashboard/containers" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Containers
      </Link>
      <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8] mb-2">
        Independent contractors
      </h1>
      <p className="text-neutral-600 mb-8">
        Appoint operators, invite them to accept the Independent Contractor Agreement, and they get a
        restricted portal for only their allocated container (order, sell, stock count).
      </p>

      <div className="grid lg:grid-cols-5 gap-6">
        <form onSubmit={appoint} className="lg:col-span-2 bg-white border border-neutral-200 rounded-3xl p-6 space-y-4 h-fit">
          <h2 className="font-bold text-xl text-slate-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#00b4d8]" /> Appoint contractor
          </h2>
          <div>
            <label className="text-sm font-medium">Full name *</label>
            <input className="input mt-1 w-full !p-3 !text-base" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input type="email" className="input mt-1 w-full !p-3 !text-base" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <input className="input mt-1 w-full !p-3 !text-base" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">ID number</label>
            <input className="input mt-1 w-full !p-3 !text-base" value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Training status</label>
            <select className="input mt-1 w-full !p-3 !text-base" value={form.training_status} onChange={(e) => setForm({ ...form, training_status: e.target.value })}>
              {TRAINING.map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="pt-2 border-t">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Payout banking
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input !p-3 !text-base" placeholder="Bank name" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
              <input className="input !p-3 !text-base" placeholder="Account number" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full !py-3">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Appoint contractor'}
          </button>
        </form>

        <div className="lg:col-span-3 bg-white border border-neutral-200 rounded-3xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-neutral-400">Loading…</div>
          ) : contractors.length === 0 ? (
            <div className="p-12 text-center text-neutral-500">No contractors appointed yet.</div>
          ) : (
            <ul className="divide-y">
              {contractors.map((c) => (
                <li key={c.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <div>
                    <div className="font-semibold text-lg text-slate-900">{c.full_name}</div>
                    <div className="text-sm text-neutral-500">
                      {[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact'}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <GraduationCap className="w-3.5 h-3.5 text-[#00b4d8]" />
                      <select
                        className="border rounded-xl px-2 py-1 capitalize"
                        value={c.training_status || 'pending'}
                        onChange={(e) => void updateTraining(c.id, e.target.value)}
                      >
                        {TRAINING.map((t) => (
                          <option key={t} value={t}>{t.replace('_', ' ')}</option>
                        ))}
                      </select>
                      <span className={`px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100'}`}>
                        {c.status || 'active'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full capitalize ${
                          c.portal_status === 'active'
                            ? 'bg-[#00b4d8]/15 text-[#0077b6]'
                            : c.portal_status === 'invited'
                              ? 'bg-amber-100 text-amber-800'
                              : c.contract_accepted_at
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-neutral-100 text-neutral-600'
                        }`}
                        title={
                          c.contract_accepted_at
                            ? `Contract accepted ${new Date(c.contract_accepted_at).toLocaleDateString()}`
                            : 'Portal access'
                        }
                      >
                        portal: {c.portal_status || (c.contract_accepted_at ? 'active' : 'not invited')}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setInviteFor(inviteFor === c.id ? null : c.id)}
                      className="text-[#00b4d8] text-sm inline-flex items-center gap-1 font-medium"
                    >
                      <Mail className="w-4 h-4" /> Invite to run outlet
                    </button>
                    <button type="button" onClick={() => void remove(c.id)} className="text-red-600 text-sm inline-flex items-center gap-1">
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  </div>
                  {inviteFor === c.id && (
                    <div className="w-full sm:col-span-2 mt-2 p-4 rounded-2xl bg-[#00b4d8]/5 border border-[#00b4d8]/20 space-y-3">
                      <p className="text-xs text-neutral-600">
                        They will accept the Independent Contractor Agreement, then only see the selected
                        container in the operator portal (order, sell, stock count).
                      </p>
                      <select
                        className="input w-full !p-2.5 !text-sm"
                        value={inviteContainerId}
                        onChange={(e) => setInviteContainerId(e.target.value)}
                      >
                        <option value="">Select container to allocate *</option>
                        {containers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} ({o.container_code})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={saving || !c.email}
                        onClick={() => void sendPortalInvite(c)}
                        className="btn-primary w-full !py-2 text-sm"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send contract invitation email'}
                      </button>
                      {!c.email && (
                        <p className="text-xs text-red-600">Add an email on this contractor first.</p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
