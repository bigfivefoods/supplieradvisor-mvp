'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
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

type Detail = {
  application: Record<string, unknown>;
  principals: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
};

export default function CustomerCreditDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const companyId = getSelectedCompanyId();
  const { getAccessToken, user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [infoNote, setInfoNote] = useState('');
  const [approvedLimit, setApprovedLimit] = useState('50000');
  const [approvedTerms, setApprovedTerms] = useState('30 days from statement');
  const [reviewDate, setReviewDate] = useState('');
  const [declineReason, setDeclineReason] = useState('');

  const load = useCallback(async () => {
    if (!companyId || !Number.isFinite(id)) return;
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const res = await apiFetch(`/api/customers/credit-applications/${id}`, {
        method: 'GET',
        companyId,
        accessToken,
        privyUserId,
      });
      const json = (await res.json()) as Detail & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load credit application');
      setDetail(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [companyId, getAccessToken, id, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchAction = async (action: string, payload: Record<string, unknown>) => {
    if (!companyId || !detail) return;
    setBusy(action);
    try {
      const accessToken = await getAccessToken();
      const res = await apiFetch(`/api/customers/credit-applications/${id}`, {
        method: 'PATCH',
        companyId,
        accessToken,
        privyUserId,
        jsonBody: { action, ...payload },
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Update failed');
      toast.success('Saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  };

  const sendInvite = async () => {
    if (!companyId || !detail) return;
    const customerId = Number(detail.application.customer_id || 0);
    if (!(customerId > 0)) {
      toast.error('No customer attached to application');
      return;
    }
    try {
      const accessToken = await getAccessToken();
      const res = await apiFetch('/api/customers/credit-applications/invite', {
        method: 'POST',
        companyId,
        accessToken,
        privyUserId,
        jsonBody: { customerId },
      });
      const json = (await res.json()) as { error?: string; link?: string };
      if (!res.ok) throw new Error(json.error || 'Could not send invite');
      if (json.link) {
        try {
          await navigator.clipboard.writeText(json.link);
          toast.success('Invite link copied');
        } catch {
          toast.success('Invite link ready');
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send invite');
    }
  };

  const viewDoc = async (docId: number) => {
    if (!companyId) return;
    try {
      const accessToken = await getAccessToken();
      const res = await apiFetch(`/api/customers/credit-applications/${id}/documents/${docId}`, {
        method: 'GET',
        companyId,
        accessToken,
        privyUserId,
      });
      const json = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !json.url) throw new Error(json.error || 'Could not open document');
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open document');
    }
  };

  if (!Number.isFinite(id)) {
    return <CompanyRequired><CustomersPage><p>Invalid ID</p></CustomersPage></CompanyRequired>;
  }

  return (
    <CompanyRequired>
      <CustomersPage>
        <CustomersHeader
          title="Credit"
          titleAccent="application"
          description="Review customer application details, evidence, and decision actions."
        />

        {loading || !detail ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase font-bold text-slate-500">Reference</p>
              <p className="text-xl font-black">{String(detail.application.reference || `CA-${id}`)}</p>
              <p className="text-sm text-slate-600">Status: {String(detail.application.status || '').replace(/_/g, ' ')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={sendInvite}>Send credit application</button>
                <Link className="btn-secondary" href={`/api/customers/credit-applications/${id}/pdf?companyId=${companyId}`} target="_blank">Download PDF</Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-semibold">Actions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-secondary" type="button" disabled={busy === 'start_review'} onClick={() => void patchAction('start_review', {})}>Start review</button>
                  <button className="btn-secondary" type="button" disabled={busy === 'request_info' || !infoNote.trim()} onClick={() => void patchAction('request_info', { note: infoNote })}>Request info</button>
                  <button className="btn-secondary" type="button" disabled={busy === 'approve'} onClick={() => void patchAction('approve', { approved_limit: Number(approvedLimit), approved_terms: approvedTerms, review_date: reviewDate || null })}>Approve</button>
                  <button className="btn-secondary" type="button" disabled={busy === 'decline' || !declineReason.trim()} onClick={() => void patchAction('decline', { reason: declineReason })}>Decline</button>
                </div>
                <textarea className="input mt-3 min-h-[80px]" placeholder="Info request note" value={infoNote} onChange={(e) => setInfoNote(e.target.value)} />
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <input className="input" placeholder="Approved limit" value={approvedLimit} onChange={(e) => setApprovedLimit(e.target.value)} />
                  <input className="input" placeholder="Approved terms" value={approvedTerms} onChange={(e) => setApprovedTerms(e.target.value)} />
                  <input className="input" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
                </div>
                <textarea className="input mt-3 min-h-[80px]" placeholder="Decline reason" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-semibold">Principals</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {detail.principals.length === 0 ? <li>None</li> : detail.principals.map((p, i) => (
                    <li key={String(p.id || i)}>{String(p.full_name || '—')} · {String(p.role || '—')} · {String(p.id_number_masked || '••••')}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-semibold">Documents</p>
              <ul className="mt-2 space-y-2 text-sm">
                {detail.documents.length === 0 ? <li className="text-slate-500">No documents</li> : detail.documents.map((d) => (
                  <li key={String(d.id)} className="flex items-center justify-between gap-2">
                    <span>{String(d.doc_type || 'document')} · {String(d.file_name || '')}</span>
                    <button type="button" className="text-[#0077b6] hover:underline" onClick={() => void viewDoc(Number(d.id))}>View</button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-semibold">Audit trail</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {detail.timeline.map((e, idx) => (
                  <li key={String(e.id || idx)}>{String(e.created_at || '').slice(0, 19)} · {String(e.action || '')} · {String(e.from_status || '')} → {String(e.to_status || '')}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CustomersPage>
    </CompanyRequired>
  );
}
