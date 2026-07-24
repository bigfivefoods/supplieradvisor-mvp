'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Award, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CERT_TYPES,
  MIGRATION_HINT,
  statusBadge,
} from '@/lib/sustainability/types';

type Cert = {
  id: number;
  name: string;
  standard?: string | null;
  issuer?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  status?: string;
  certificate_type?: string | null;
  verified?: boolean;
  days_until_expiry?: number | null;
  expiry_status?: string;
  file_url?: string | null;
};

export default function GreenCertificatesPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [certs, setCerts] = useState<Cert[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    active: number;
    expiring_soon: number;
    expired: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: '',
    standard: '',
    issuer: '',
    certificate_type: 'other',
    issued_at: '',
    expires_at: '',
    file_url: '',
    scope_notes: '',
  });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) p.set('privyUserId', privyUserId);
      const res = await fetch(`/api/sustainability/certificates?${p}`);
      const json = await res.json();
      setCerts(json.certificates || []);
      setSummary(json.summary || null);
      setWarning(json.warning || json.hint || null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    const res = await fetch('/api/sustainability/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        ...form,
        standard: form.standard || form.name,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || json.hint || 'Failed');
      return;
    }
    toast.success('Certificate added');
    setShow(false);
    setForm({
      name: '',
      standard: '',
      issuer: '',
      certificate_type: 'other',
      issued_at: '',
      expires_at: '',
      file_url: '',
      scope_notes: '',
    });
    await load();
  };

  const setStatus = async (id: number, status: string) => {
    await fetch('/api/sustainability/certificates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, status }),
    });
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sustainability"
        backLabel="Sustainability"
        eyebrow="Assurance · Compliance"
        title="Green"
        titleAccent="certificates"
        description="Track ISO, organic, Fairtrade, carbon claims and more. Expiry windows surface 90 days out."
        action={
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add certificate
          </button>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {warning}
          <span className="mt-1 block font-mono text-xs">{MIGRATION_HINT}</span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">Total</div>
          <div className="text-2xl font-black">{summary?.total ?? 0}</div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">Active</div>
          <div className="text-2xl font-black text-emerald-700">
            {summary?.active ?? 0}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Expiring ≤90d
          </div>
          <div className="text-2xl font-black text-amber-700">
            {summary?.expiring_soon ?? 0}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">Expired</div>
          <div className="text-2xl font-black text-rose-700">
            {summary?.expired ?? 0}
          </div>
        </Panel>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : certs.length === 0 ? (
        <Panel className="p-10 text-center">
          <Award className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="font-semibold">No certificates on file</p>
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2 !px-4 text-sm mt-4"
          >
            Add first certificate
          </button>
        </Panel>
      ) : (
        <ul className="bg-white border rounded-3xl divide-y">
          {certs.map((c) => (
            <li
              key={c.id}
              className="px-4 py-3 flex flex-wrap justify-between gap-3"
            >
              <div>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(c.status)}`}
                  >
                    {c.status}
                  </span>
                  {c.expiry_status === 'expiring_soon' && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-amber-50 text-amber-900 border-amber-200">
                      Expires in {c.days_until_expiry}d
                    </span>
                  )}
                  {c.expiry_status === 'expired' && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-rose-50 text-rose-800 border-rose-200">
                      Expired
                    </span>
                  )}
                </div>
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-[11px] text-neutral-500">
                  {c.standard || c.certificate_type}
                  {c.issuer && ` · ${c.issuer}`}
                  {c.expires_at && ` · until ${c.expires_at}`}
                </div>
                {c.file_url && (
                  <a
                    href={c.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-[#00b4d8]"
                  >
                    View document
                  </a>
                )}
              </div>
              {c.status === 'active' && (
                <button
                  type="button"
                  onClick={() => void setStatus(c.id, 'retired')}
                  className="text-xs text-neutral-500 underline"
                >
                  Retire
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">Add certificate</h3>
            <input
              className="input"
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="input"
              value={form.certificate_type}
              onChange={(e) =>
                setForm({ ...form, certificate_type: e.target.value })
              }
            >
              {CERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Standard / scheme"
              value={form.standard}
              onChange={(e) => setForm({ ...form, standard: e.target.value })}
            />
            <input
              className="input"
              placeholder="Issuer"
              value={form.issuer}
              onChange={(e) => setForm({ ...form, issuer: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                type="date"
                value={form.issued_at}
                onChange={(e) =>
                  setForm({ ...form, issued_at: e.target.value })
                }
              />
              <input
                className="input"
                type="date"
                value={form.expires_at}
                onChange={(e) =>
                  setForm({ ...form, expires_at: e.target.value })
                }
              />
            </div>
            <input
              className="input"
              placeholder="Document URL"
              value={form.file_url}
              onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            />
            <textarea
              className="input min-h-[56px]"
              placeholder="Scope notes"
              value={form.scope_notes}
              onChange={(e) =>
                setForm({ ...form, scope_notes: e.target.value })
              }
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary !py-2 !px-4 text-sm"
                onClick={() => setShow(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary !py-2 !px-4 text-sm"
                onClick={() => void create()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </RelationshipPage>
  );
}
