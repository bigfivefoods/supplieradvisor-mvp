'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  Trash2,
  GraduationCap,
  Banknote,
  Mail,
  ShieldCheck,
  FileUp,
  ExternalLink,
  BadgeCheck,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';
import type { ContractorRecord, ContainerRecord } from '@/lib/containers/types';
import { uploadContractorIdDocument } from '@/lib/containers/uploadIdDocument';
import { isValidSaIdNumber } from '@/lib/verifynow/client';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';

const TRAINING = ['pending', 'in_progress', 'certified', 'expired'] as const;

function verificationBadge(status?: string | null) {
  const s = (status || 'unverified').toLowerCase();
  if (s === 'verified')
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s === 'pending') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (s === 'failed') return 'bg-red-100 text-red-800 border-red-200';
  if (s === 'mismatch') return 'bg-orange-100 text-orange-900 border-orange-200';
  return 'bg-neutral-100 text-neutral-600 border-neutral-200';
}

export default function ContractorsPage() {
  return (
    <CompanyRequired>
      <ContractorsInner />
    </CompanyRequired>
  );
}

function ContractorsInner() {
  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | 'new' | null>(null);
  const [inviteFor, setInviteFor] = useState<number | null>(null);
  const [inviteContainerId, setInviteContainerId] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    id_number: '',
    training_status: 'pending',
    bank_name: '',
    account_number: '',
    consent_identity_check: false,
  });

  const companyId = getSelectedCompanyId()!;

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
      let id_document_url: string | null = null;
      let id_document_name: string | null = null;
      if (idFile) {
        setUploadingId('new');
        const uploaded = await uploadContractorIdDocument(
          idFile,
          companyId,
          form.id_number || form.full_name
        );
        setUploadingId(null);
        if (!uploaded.url) throw new Error(uploaded.error || 'ID upload failed');
        id_document_url = uploaded.url;
        id_document_name = uploaded.fileName || idFile.name;
      }

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
          id_document_url,
          id_document_name,
          consent_identity_check: form.consent_identity_check,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Contractor appointed');

      // Optional: auto-run VerifyNow if ID + consent
      if (form.id_number && form.consent_identity_check && data.contractor?.id) {
        toast.loading('Running VerifyNow SA ID check…', { id: 'vn-auto' });
        try {
          const vRes = await fetch('/api/containers/contractors/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contractorId: data.contractor.id,
              idNumber: form.id_number,
              consent: true,
            }),
          });
          const vData = await vRes.json();
          if (!vRes.ok) throw new Error(vData.error || vData.hint || 'Verify failed');
          toast.success(vData.message || 'Verified with VerifyNow', { id: 'vn-auto' });
        } catch (ve: unknown) {
          toast.error(ve instanceof Error ? ve.message : 'VerifyNow failed', { id: 'vn-auto' });
        }
      }

      setForm({
        full_name: '',
        email: '',
        phone: '',
        id_number: '',
        training_status: 'pending',
        bank_name: '',
        account_number: '',
        consent_identity_check: false,
      });
      setIdFile(null);
      void load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
      setUploadingId(null);
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

  const attachIdDocument = async (contractor: ContractorRecord, file: File) => {
    if (!companyId) return;
    setUploadingId(contractor.id);
    try {
      const uploaded = await uploadContractorIdDocument(
        file,
        companyId,
        contractor.id_number || String(contractor.id)
      );
      if (!uploaded.url) throw new Error(uploaded.error || 'Upload failed');
      const res = await fetch('/api/containers/contractors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: contractor.id,
          id_document_url: uploaded.url,
          id_document_name: uploaded.fileName || file.name,
          id_document_uploaded_at: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('ID document attached');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  const runVerifyNow = async (contractor: ContractorRecord) => {
    if (!contractor.id_number) {
      toast.error('Add an SA ID number first');
      return;
    }
    if (!isValidSaIdNumber(contractor.id_number)) {
      toast.error('ID number failed format/checksum check (must be 13 digits)');
      return;
    }
    if (!contractor.consent_identity_check) {
      const ok = confirm(
        'Confirm POPIA consent: the contractor has authorised an identity verification check via VerifyNow (Home Affairs SA ID). Continue?'
      );
      if (!ok) return;
    }

    setVerifyingId(contractor.id);
    toast.loading('Verifying with VerifyNow…', { id: `vn-${contractor.id}` });
    try {
      const res = await fetch('/api/containers/contractors/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorId: contractor.id,
          idNumber: contractor.id_number,
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'VerifyNow failed');
      }
      toast.success(data.message || 'Verified', { id: `vn-${contractor.id}` });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Verification failed', {
        id: `vn-${contractor.id}`,
      });
    } finally {
      setVerifyingId(null);
    }
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

  return (
    <ContainersPage>
      <ContainersHeader
        title="Independent"
        titleAccent="contractors"
        description={
          <>
            Appoint operators, attach SA ID documents, verify identity via{' '}
            <a
              href="https://www.verifynow.co.za/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00b4d8] font-medium hover:underline inline-flex items-center gap-1"
            >
              VerifyNow <ExternalLink className="w-3 h-3" />
            </a>
            , then invite them to their allocated container portal.
          </>
        }
      />

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
        <form
          onSubmit={appoint}
          className="lg:col-span-2 bg-white border border-neutral-200 rounded-3xl p-6 space-y-4 h-fit"
        >
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#00b4d8]" /> Appoint contractor
          </h2>
          <div>
            <label className="text-sm font-medium">Full name *</label>
            <input
              className="input mt-1 w-full !p-3 !text-base"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                className="input mt-1 w-full !p-3 !text-base"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <input
                className="input mt-1 w-full !p-3 !text-base"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Identity */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Identity (VerifyNow)
            </div>
            <div>
              <label className="text-sm font-medium">SA ID number</label>
              <input
                className="input mt-1 w-full !p-3 !text-base font-mono"
                value={form.id_number}
                onChange={(e) =>
                  setForm({ ...form, id_number: e.target.value.replace(/[^\d\s]/g, '') })
                }
                placeholder="13 digits e.g. 8001015009087"
                maxLength={14}
              />
              {form.id_number && !isValidSaIdNumber(form.id_number) && (
                <p className="text-xs text-amber-700 mt-1">Check ID number format/checksum</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5">
                <FileUp className="w-3.5 h-3.5" /> Attach ID document
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="mt-1 block w-full text-sm text-neutral-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-[#00b4d8]/10 file:text-[#0077b6] file:font-medium"
                onChange={(e) => setIdFile(e.target.files?.[0] || null)}
              />
              {idFile && (
                <p className="text-xs text-neutral-500 mt-1 truncate">Selected: {idFile.name}</p>
              )}
              <p className="text-[11px] text-neutral-500 mt-1">
                JPG, PNG or PDF of smart ID / green book (max 12MB)
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-neutral-300 text-[#00b4d8]"
                checked={form.consent_identity_check}
                onChange={(e) =>
                  setForm({ ...form, consent_identity_check: e.target.checked })
                }
              />
              <span>
                I confirm the contractor has consented to a POPIA-aligned identity check via
                VerifyNow (Home Affairs SA ID verification). If checked with a valid ID, verification
                runs after appoint.
              </span>
            </label>
          </div>

          <div>
            <label className="text-sm font-medium">Training status</label>
            <select
              className="input mt-1 w-full !p-3 !text-base"
              value={form.training_status}
              onChange={(e) => setForm({ ...form, training_status: e.target.value })}
            >
              {TRAINING.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="pt-2 border-t">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Payout banking
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input !p-3 !text-base"
                placeholder="Bank name"
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              />
              <input
                className="input !p-3 !text-base"
                placeholder="Account number"
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" disabled={saving || uploadingId === 'new'} className="btn-primary w-full !py-3">
            {saving || uploadingId === 'new' ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : (
              'Appoint contractor'
            )}
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
                <li key={c.id} className="p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-lg text-slate-900 flex flex-wrap items-center gap-2">
                        {c.full_name}
                        {c.verification_status === 'verified' && (
                          <BadgeCheck className="w-5 h-5 text-emerald-600" aria-label="Verified" />
                        )}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact'}
                      </div>
                      {c.id_number && (
                        <div className="text-xs font-mono text-neutral-500 mt-1">
                          ID: {c.id_number}
                        </div>
                      )}
                      {(c.verified_first_names || c.verified_last_name) && (
                        <div className="text-xs text-emerald-800 mt-1">
                          VerifyNow name:{' '}
                          {[c.verified_first_names, c.verified_last_name].filter(Boolean).join(' ')}
                          {c.verified_dob ? ` · DOB ${c.verified_dob}` : ''}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full border capitalize inline-flex items-center gap-1 ${verificationBadge(c.verification_status)}`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          {c.verification_status || 'unverified'}
                          {c.verified_at
                            ? ` · ${new Date(c.verified_at).toLocaleDateString()}`
                            : ''}
                        </span>
                        <GraduationCap className="w-3.5 h-3.5 text-[#00b4d8]" />
                        <select
                          className="border rounded-xl px-2 py-1 capitalize"
                          value={c.training_status || 'pending'}
                          onChange={(e) => void updateTraining(c.id, e.target.value)}
                        >
                          {TRAINING.map((t) => (
                            <option key={t} value={t}>
                              {t.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            c.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-neutral-100'
                          }`}
                        >
                          {c.status || 'active'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full capitalize ${
                            c.portal_status === 'active'
                              ? 'bg-[#00b4d8]/15 text-[#0077b6]'
                              : c.portal_status === 'invited'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          portal: {c.portal_status || (c.contract_accepted_at ? 'active' : 'not invited')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-stretch sm:items-end gap-2 flex-shrink-0">
                      <button
                        type="button"
                        disabled={verifyingId === c.id || !c.id_number}
                        onClick={() => void runVerifyNow(c)}
                        className="text-emerald-700 text-sm inline-flex items-center gap-1.5 font-medium hover:underline disabled:opacity-40"
                      >
                        {verifyingId === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                        Verify with VerifyNow
                      </button>
                      <label className="text-[#00b4d8] text-sm inline-flex items-center gap-1.5 font-medium cursor-pointer hover:underline">
                        {uploadingId === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileUp className="w-4 h-4" />
                        )}
                        {c.id_document_url ? 'Replace ID document' : 'Attach ID document'}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void attachIdDocument(c, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {c.id_document_url && (
                        <a
                          href={c.id_document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neutral-600 text-sm inline-flex items-center gap-1.5 hover:underline"
                        >
                          <FileText className="w-4 h-4" />
                          View ID doc
                          {c.id_document_name ? ` (${c.id_document_name})` : ''}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setInviteFor(inviteFor === c.id ? null : c.id)}
                        className="text-[#00b4d8] text-sm inline-flex items-center gap-1 font-medium"
                      >
                        <Mail className="w-4 h-4" /> Invite to run outlet
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(c.id)}
                        className="text-red-600 text-sm inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </div>
                  </div>

                  {c.verification_status === 'mismatch' && (
                    <div className="text-xs text-orange-800 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 flex gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      Name from VerifyNow may not match the appointed name — review before
                      allocating an outlet.
                    </div>
                  )}

                  {inviteFor === c.id && (
                    <div className="p-4 rounded-2xl bg-[#00b4d8]/5 border border-[#00b4d8]/20 space-y-3">
                      <p className="text-xs text-neutral-600">
                        They will accept the Independent Contractor Agreement, then only see the
                        selected container in the operator portal (order, sell, stock count).
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
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : (
                          'Send contract invitation email'
                        )}
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
    </ContainersPage>
  );
}
